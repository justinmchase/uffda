import { dirname, join, resolve } from "@std/path";
import { codecCorpus, transport } from "./data-codec-corpus.ts";
import { verifyRustCodec } from "../../scripts/verify-rust-codec.ts";

type Sample = {
  workload: string;
  format: string;
  operation: string;
  compression: string;
  records: number;
  bytes: number;
  chunkBytes: number;
  elapsedMs: number;
  peakRssKiB: number;
};

export const decodeMethodology =
  "Decode: grammar-independent native codec parser to DataDocument; JSON/JSONL serde_json to Value. Encode: prepared DataDocument or JSON Value. Native materialization/GC roundtrip is verified separately, not included in timed decode.";

async function command(executable: string, args: string[]): Promise<string> {
  const result = await new Deno.Command(executable, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) {
    throw new Error(
      `${executable} ${args.join(" ")} failed (${result.code}): ${
        new TextDecoder().decode(result.stderr)
      }`,
    );
  }
  return new TextDecoder().decode(result.stdout).trim();
}

async function gzip(bytes: Uint8Array, decode = false): Promise<Uint8Array> {
  const stream = new Blob([bytes.slice()]).stream().pipeThrough(
    decode ? new DecompressionStream("gzip") : new CompressionStream("gzip"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function median(values: number[]): number {
  if (
    values.length === 0 ||
    values.some((value) => !Number.isFinite(value) || value < 0)
  ) {
    throw new Error("Median requires nonnegative finite samples");
  }
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

async function main(): Promise<void> {
  if (Deno.build.os !== "linux") {
    throw new Error(
      "RSS measurement requires Linux GNU /usr/bin/time; use verify-rust-codec.ts for portable acceptance",
    );
  }
  const probe = resolve(
    Deno.args[0] ?? "rust/target/release/examples/codec_probe",
  );
  const cli = resolve(Deno.args[1] ?? "rust/target/release/uffda");
  const output = resolve(Deno.args[2] ?? ".tmp/data-codec-report.json");
  const corpus = codecCorpus();
  const temp = await Deno.makeTempDir({ prefix: "uffda-codec-measure-" });
  try {
    const corpusPath = join(temp, "corpus.json");
    const rssPath = join(temp, "rss.txt");
    await Deno.writeTextFile(corpusPath, JSON.stringify(corpus));
    await command(probe, ["verify", corpusPath]);
    await verifyRustCodec(cli, probe);
    const sizes = [];
    for (const workload of corpus) {
      for (const format of ["codec", "json", "jsonl"]) {
        const bytes = new TextEncoder().encode(transport(workload, format));
        const zipped = await gzip(bytes);
        const expanded = await gzip(zipped, true);
        if (
          expanded.length !== bytes.length ||
          expanded.some((byte, i) => byte !== bytes[i])
        ) {
          throw new Error("Gzip roundtrip changed transport bytes");
        }
        const compress = [];
        const decompress = [];
        for (let sample = 0; sample < 5; sample++) {
          const start = performance.now();
          await gzip(bytes);
          compress.push(performance.now() - start);
          const decodeStart = performance.now();
          await gzip(zipped, true);
          decompress.push(performance.now() - decodeStart);
        }
        sizes.push({
          workload: workload.name,
          format,
          records: workload.records.length,
          rawBytes: bytes.length,
          gzipBytes: zipped.length,
          gzipEncodeMs: median(compress),
          gzipDecodeMs: median(decompress),
          gzipSamples: 5,
        });
      }
    }
    const samples: Sample[] = [];
    const memoryScaling: Sample[] = [];
    const measure = async (
      workload: string,
      format: string,
      operation: string,
      rounds: number,
      chunk: number,
      compression: string,
    ): Promise<Sample> => {
      const text = await command("/usr/bin/time", [
        "-f",
        "%M",
        "-o",
        rssPath,
        probe,
        "bench",
        corpusPath,
        workload,
        format,
        operation,
        String(rounds),
        String(chunk),
        compression,
      ]);
      const result: Omit<Sample, "peakRssKiB"> = JSON.parse(text);
      const peakRssKiB = Number((await Deno.readTextFile(rssPath)).trim());
      if (
        !Number.isSafeInteger(peakRssKiB) || peakRssKiB <= 0 ||
        result.workload !== workload || result.format !== format ||
        result.operation !== operation || result.compression !== compression ||
        (operation !== "baseline" &&
          (result.records !== 32 * rounds || result.elapsedMs <= 0))
      ) {
        throw new Error(`Invalid measurement: ${text}, RSS ${peakRssKiB}`);
      }
      return { ...result, peakRssKiB };
    };
    const timedMeasure = async (
      workload: string,
      format: string,
      operation: string,
      compression: string,
    ): Promise<Sample> => {
      let rounds = 8;
      for (let attempt = 0; attempt < 4; attempt++) {
        const result = await measure(
          workload,
          format,
          operation,
          rounds,
          4096,
          compression,
        );
        if (result.elapsedMs >= 100) return result;
        rounds = Math.max(
          rounds * 2,
          Math.ceil(rounds * 125 / result.elapsedMs),
        );
      }
      throw new Error(
        `Unable to obtain a 100ms sample for ${workload}/${format}/${operation}/${compression}`,
      );
    };
    for (const workload of corpus) {
      for (const format of ["codec", "json", "jsonl"]) {
        for (const compression of ["raw", "gzip"]) {
          for (let sample = 0; sample < 3; sample++) {
            samples.push(
              await measure(
                workload.name,
                format,
                "baseline",
                1,
                4096,
                compression,
              ),
            );
            for (const operation of ["decode", "encode"]) {
              samples.push(
                await timedMeasure(
                  workload.name,
                  format,
                  operation,
                  compression,
                ),
              );
            }
          }
        }
      }
    }
    for (const workload of [corpus[0], corpus[3]]) {
      for (const format of ["codec", "json", "jsonl"]) {
        for (const compression of ["raw", "gzip"]) {
          for (const rounds of [1, 128]) {
            memoryScaling.push(
              await measure(
                workload.name,
                format,
                "stream-memory",
                rounds,
                4096,
                compression,
              ),
            );
          }
        }
      }
    }
    const report = {
      generatedAt: new Date().toISOString(),
      host: {
        os: Deno.build.os,
        arch: Deno.build.arch,
        deno: Deno.version.deno,
        rustc: await command("rustc", ["--version"]),
        kernel: await command("uname", ["-srmo"]),
      },
      methodology: [
        "32 deterministic records per workload; three independent parser subprocess samples, one untimed warm pass then at least eight timed corpus passes (256 records). Fast pipelines increase repetitions until at least 100ms is measured; actual byte/record totals are retained per sample.",
        decodeMethodology,
        "Native JSON is an explicit $type/value surrogate, not native reconstruction. Ordinary values compare semantically; all native fixtures compare tags and roundtrip through a collected arena.",
        "Codec decode feeds 4096-byte chunks and drops each document on delivery; JSONL drops each parsed line, JSON retains a whole array per pass. Sources and fixture comparison values are caller-owned resident data.",
        "Peak RSS is GNU time %M for each complete child, including startup, fixture loading, verification/preparation, warmup and embedded grammars. Initialized baseline parses fixtures but performs no codec/JSON decode; do not subtract peaks as live heap deltas.",
        "Memory scaling feeds repeated resident corpus bytes as one continuous codec/JSONL stream for 32 or 4096 records, resetting once at its start and finishing once at EOF. JSON reads one 32-record array per batch, not a single 4096-record array. Gzip uses concatenated corpus members. This measures duration growth, not larger-record, larger-array, or caller-retained-output memory.",
        "Transport size/gzip-only timings use Deno Web CompressionStream default settings, five warm byte-only samples. Rust raw/gzip parser pipelines separately measure flate2 rust_backend default compression, including gzip finalization in encode and decompression in decode; measured bytes are recorded per sample and may differ between implementations.",
        "Raw/gzip pipeline RSS includes resident corpus, prepared input, gzip setup, and all timed work. Native arena materialization is excluded from the parser pipeline, so do not advertise the rates as fully materialized compressed-native throughput.",
        "No speed/size threshold: measurements are informational on a shared host.",
      ],
      sizes,
      samples,
      memoryScaling,
    };
    await Deno.mkdir(dirname(output), { recursive: true });
    await Deno.writeTextFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(`Report written to ${output}`);
    console.log(
      "| Workload | Format | Pipeline | Raw / gzip bytes | Encode / decode records/s | Decode / idle RSS KiB | Gzip-only encode / decode ms |",
    );
    console.log("| --- | --- | --- | ---: | ---: | ---: | ---: |");
    for (const size of sizes) {
      for (const compression of ["raw", "gzip"]) {
        const selected = samples.filter((sample) =>
          sample.workload === size.workload && sample.format === size.format &&
          sample.compression === compression
        );
        const rate = (operation: string) =>
          median(
            selected.filter((sample) => sample.operation === operation).map((
              sample,
            ) => sample.records * 1000 / sample.elapsedMs),
          ).toFixed(0);
        const rss = (operation: string) =>
          median(
            selected.filter((sample) => sample.operation === operation).map((
              sample,
            ) => sample.peakRssKiB),
          ).toFixed(0);
        console.log(
          `| ${size.workload} | ${size.format} | ${compression} | ${size.rawBytes} / ${size.gzipBytes} | ${
            rate("encode")
          } / ${rate("decode")} | ${rss("decode")} / ${rss("baseline")} | ${
            size.gzipEncodeMs.toFixed(3)
          } / ${size.gzipDecodeMs.toFixed(3)} |`,
        );
      }
    }
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
}

if (import.meta.main) await main();
