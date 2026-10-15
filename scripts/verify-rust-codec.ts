import { basename, join, resolve } from "@std/path";
import { codecCorpus } from "../test/perf/data-codec-corpus.ts";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export async function verifyRustCodec(
  cli: string,
  probe: string,
): Promise<void> {
  const temp = await Deno.makeTempDir({ prefix: "uffda-standalone-codec-" });
  try {
    const installedCli = join(temp, basename(cli));
    const installedProbe = join(temp, basename(probe));
    await Deno.copyFile(cli, installedCli);
    await Deno.copyFile(probe, installedProbe);
    if (Deno.build.os !== "windows") {
      await Deno.chmod(installedCli, 0o755);
      await Deno.chmod(installedProbe, 0o755);
    }
    const systemRoot = Deno.build.os === "windows"
      ? Deno.env.get("SystemRoot")
      : undefined;
    if (Deno.build.os === "windows" && !systemRoot) {
      throw new Error("Windows acceptance requires SystemRoot");
    }
    const options = {
      cwd: temp,
      clearEnv: true,
      env: { PATH: "", ...(systemRoot ? { SystemRoot: systemRoot } : {}) },
      stdout: "piped",
      stderr: "piped",
    } as const;
    const cliOutput = async (args: string[], input = ""): Promise<string> => {
      const child = new Deno.Command(installedCli, {
        ...options,
        args,
        stdin: "piped",
      }).spawn();
      const finished = child.output();
      const writer = child.stdin.getWriter();
      try {
        await writer.write(encoder.encode(input));
        await writer.close();
      } finally {
        writer.releaseLock();
      }
      const output = await finished;
      if (!output.success) {
        throw new Error(
          `Standalone CLI failed (${output.code}): ${
            decoder.decode(output.stderr)
          }`,
        );
      }
      if (output.stderr.length !== 0) {
        throw new Error(
          `Unexpected standalone stderr: ${decoder.decode(output.stderr)}`,
        );
      }
      return decoder.decode(output.stdout).trim();
    };
    if (await cliOutput(["exec", "-e", "(add 20 22)"]) !== "42") {
      throw new Error("Standalone expression failed");
    }
    if (
      await cliOutput(["match", "-e", "any", "--input-data", "42n"]) !== "42n"
    ) throw new Error("Native CLI subject lost BigInt");
    const module = "export Main; rule Main = any;";
    if (
      JSON.parse(await cliOutput(["parse", "-e", module])).kind !== "module"
    ) throw new Error("Standalone parse failed");
    if (
      await cliOutput([
        "run",
        "-e",
        module,
        "--entry",
        "Main",
        "--input-data",
        "42n",
      ]) !== "42n"
    ) throw new Error("Standalone native module failed");
    await Deno.writeTextFile(join(temp, "main.uff"), module);
    if (JSON.parse(await cliOutput(["compile", "main.uff"])).ok !== true) {
      throw new Error("Standalone compile failed");
    }
    const artifact = JSON.parse(
      await Deno.readTextFile(join(temp, "bin", "ast", "main.uffda.ast.json")),
    );
    if (artifact.rules[0].name !== "Main") {
      throw new Error("Standalone compiled declaration failed");
    }
    await Deno.remove(join(temp, "bin"), { recursive: true });
    if (
      await cliOutput(["fmt", "-"], "rule Main=any;") !== "rule Main = any;"
    ) throw new Error("Standalone fmt failed");
    const corpusPath = join(temp, "corpus.json");
    await Deno.writeTextFile(corpusPath, JSON.stringify(codecCorpus()));
    const corpusResult = await new Deno.Command(installedProbe, {
      ...options,
      args: ["verify", corpusPath],
    }).output();
    if (
      !corpusResult.success || corpusResult.stderr.length !== 0 ||
      decoder.decode(corpusResult.stdout).trim() !== "codec corpus verified"
    ) {
      throw new Error(
        `Standalone native corpus failed: ${
          decoder.decode(corpusResult.stderr)
        }`,
      );
    }
    const source =
      '# comment\n[42n\n @bytes"AA"]\n{a:"é😀" b:@set[1 2]}\n"\\ud800"\nundefined';
    const expected =
      '[42n @bytes"AA"]\n{"a":"é😀" "b":@set[1 2]}\n"\\ud800"\nundefined\n';
    const stream = async (source: Uint8Array, chunk: number) => {
      const child = new Deno.Command(installedProbe, {
        ...options,
        args: ["stream", String(chunk)],
        stdin: "piped",
      }).spawn();
      const output = child.output();
      const writer = child.stdin.getWriter();
      try {
        for (let offset = 0; offset < source.length; offset += chunk) {
          await writer.write(source.subarray(offset, offset + chunk));
        }
        await writer.close();
      } finally {
        writer.releaseLock();
      }
      return await output;
    };
    for (const chunk of [1, 2, 7, 4096]) {
      const result = await stream(encoder.encode(source), chunk);
      if (!result.success || decoder.decode(result.stdout) !== expected) {
        throw new Error(
          `Standalone chunk ${chunk} mismatch: ${
            decoder.decode(result.stderr)
          } ${decoder.decode(result.stdout)}`,
        );
      }
    }
    for (
      const invalid of [
        ...["42\n[", '42\n"unfinished', "42\n(boom)"].map((value) =>
          encoder.encode(value)
        ),
        new Uint8Array([52, 50, 10, 0xff]),
        new Uint8Array([52, 50, 10, 0xc3]),
      ]
    ) {
      const result = await stream(invalid, 1);
      if (
        result.code !== 2 || decoder.decode(result.stdout) !== "42\n" ||
        !decoder.decode(result.stderr).includes("codec acceptance failure:")
      ) {
        throw new Error(
          "Standalone consumer did not preserve delivery and explicitly fail malformed trailing input",
        );
      }
    }
    const child = new Deno.Command(installedProbe, {
      ...options,
      args: ["stream", "7"],
      stdin: "piped",
    }).spawn();
    const writer = child.stdin.getWriter();
    const reader = child.stdout.getReader();
    const errors = new Response(child.stderr).text();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let exited = false;
    child.status.then(() => {
      exited = true;
    });
    try {
      await writer.write(encoder.encode("42\n"));
      const delivered = await Promise.race([
        (async () => {
          let text = "";
          while (!text.endsWith("\n")) {
            const part = await reader.read();
            if (part.done) throw new Error("EOF before record delivery");
            text += decoder.decode(part.value);
          }
          return text;
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("No record delivered before EOF")),
            10_000,
          );
        }),
      ]);
      if (delivered !== "42\n") {
        throw new Error("Incorrect pre-EOF record delivery");
      }
      await writer.write(encoder.encode("undefined"));
      await writer.close();
      let remaining = "";
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        remaining += decoder.decode(part.value);
      }
      const status = await child.status;
      if (
        !status.success || remaining !== "undefined\n" || await errors !== ""
      ) throw new Error("Final EOF delivery failed");
    } catch (error) {
      if (!exited) child.kill("SIGTERM");
      await child.status;
      await errors;
      throw error;
    } finally {
      clearTimeout(timer);
      writer.releaseLock();
      reader.releaseLock();
    }
    console.log(
      `Standalone all-six CLI/native streaming passed on ${Deno.build.os}/${Deno.build.arch}; byte chunks, pre-EOF delivery, native GC roundtrip, and malformed EOF verified`,
    );
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
}

if (import.meta.main) {
  if (Deno.args.length !== 2) {
    throw new Error(
      "Usage: verify-rust-codec.ts <uffda binary> <codec_probe binary>",
    );
  }
  await verifyRustCodec(resolve(Deno.args[0]), resolve(Deno.args[1]));
}
