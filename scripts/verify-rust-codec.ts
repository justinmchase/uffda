import {
  chmod,
  copyFile,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { codecCorpus } from "../tests/perf/data-codec-corpus.ts";

type ProcessResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
};

function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    stream.once("error", reject);
    stream.once("end", () => resolve(Buffer.concat(chunks)));
  });
}

function waitForProcess(child: ChildProcess): Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
}> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
}

function writeInput(
  stream: NodeJS.WritableStream,
  bytes: Uint8Array,
): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(bytes, (error?: Error | null) =>
      error ? reject(error) : resolve(),
    );
  });
}

async function run(
  executable: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
  inputs: Uint8Array[] = [],
): Promise<ProcessResult> {
  const child = spawn(executable, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdout = collect(child.stdout!);
  const stderr = collect(child.stderr!);
  const status = waitForProcess(child);
  for (const input of inputs) await writeInput(child.stdin!, input);
  child.stdin!.end();
  const [result, out, err] = await Promise.all([status, stdout, stderr]);
  return { ...result, stdout: out, stderr: err };
}

export async function verifyRustCodec(
  cli: string,
  probe: string,
): Promise<void> {
  const temp = await mkdtemp(join(tmpdir(), "uffda-standalone-codec-"));
  try {
    const installedCli = join(temp, basename(cli));
    const installedProbe = join(temp, basename(probe));
    await copyFile(cli, installedCli);
    await copyFile(probe, installedProbe);
    if (process.platform !== "win32") {
      await chmod(installedCli, 0o755);
      await chmod(installedProbe, 0o755);
    }
    const systemRoot =
      process.platform === "win32" ? process.env.SystemRoot : undefined;
    if (process.platform === "win32" && !systemRoot) {
      throw new Error("Windows acceptance requires SystemRoot");
    }
    const options = {
      cwd: temp,
      env: { PATH: "", ...(systemRoot ? { SystemRoot: systemRoot } : {}) },
    } as const;
    const cliOutput = async (args: string[], input = ""): Promise<string> => {
      const output = await run(installedCli, args, options, [
        Buffer.from(input),
      ]);
      if (output.code !== 0) {
        throw new Error(
          `Standalone CLI failed (${output.code ?? output.signal}): ${output.stderr.toString()}`,
        );
      }
      if (output.stderr.length !== 0) {
        throw new Error(
          `Unexpected standalone stderr: ${output.stderr.toString()}`,
        );
      }
      return output.stdout.toString().trim();
    };
    if ((await cliOutput(["exec", "-e", "(add 20 22)"])) !== "42") {
      throw new Error("Standalone expression failed");
    }
    if (
      (await cliOutput(["match", "-e", "any", "--input-data", "42n"])) !== "42n"
    )
      throw new Error("Native CLI subject lost BigInt");
    const module = "export Main; rule Main = any;";
    if (JSON.parse(await cliOutput(["parse", "-e", module])).kind !== "module")
      throw new Error("Standalone parse failed");
    if (
      (await cliOutput([
        "run",
        "-e",
        module,
        "--entry",
        "Main",
        "--input-data",
        "42n",
      ])) !== "42n"
    )
      throw new Error("Standalone native module failed");
    await writeFile(join(temp, "main.uff"), module);
    if (JSON.parse(await cliOutput(["compile", "main.uff"])).ok !== true) {
      throw new Error("Standalone compile failed");
    }
    const artifact = await readFile(
      join(temp, "bin", "ast", "main.uff.ast"),
      "utf8",
    );
    if (!artifact.includes('rules:[{name:"Main"')) {
      throw new Error("Standalone compiled declaration failed");
    }
    await rm(join(temp, "bin"), { recursive: true, force: true });
    if (
      (await cliOutput(["fmt", "-"], "rule Main=any;")) !== "rule Main = any;"
    )
      throw new Error("Standalone fmt failed");
    const corpusPath = join(temp, "corpus.json");
    await writeFile(corpusPath, JSON.stringify(codecCorpus()));
    const corpusResult = await run(
      installedProbe,
      ["verify", corpusPath],
      options,
    );
    if (
      corpusResult.code !== 0 ||
      corpusResult.stderr.length !== 0 ||
      corpusResult.stdout.toString().trim() !== "codec corpus verified"
    ) {
      throw new Error(
        `Standalone native corpus failed: ${corpusResult.stderr.toString()}`,
      );
    }
    const source =
      '# comment\n[42n\n @bytes"AA"]\n{a:"é😀" b:@set[1 2]}\n"\\ud800"\nundefined';
    const expected =
      '[42n @bytes"AA"]\n{"a":"é😀" "b":@set[1 2]}\n"\\ud800"\nundefined\n';
    const stream = async (input: Uint8Array, chunk: number) => {
      const chunks: Buffer[] = [];
      for (let offset = 0; offset < input.length; offset += chunk) {
        chunks.push(Buffer.from(input.subarray(offset, offset + chunk)));
      }
      return await run(
        installedProbe,
        ["stream", String(chunk)],
        options,
        chunks,
      );
    };
    for (const chunk of [1, 2, 7, 4096]) {
      const result = await stream(Buffer.from(source), chunk);
      if (result.code !== 0 || result.stdout.toString() !== expected) {
        throw new Error(
          `Standalone chunk ${chunk} mismatch: ${result.stderr.toString()} ${result.stdout.toString()}`,
        );
      }
    }
    for (const invalid of [
      ...["42\n[", '42\n"unfinished', "42\n(boom)"].map((value) =>
        Buffer.from(value),
      ),
      Buffer.from([52, 50, 10, 0xff]),
      Buffer.from([52, 50, 10, 0xc3]),
    ]) {
      const result = await stream(invalid, 1);
      if (
        result.code !== 2 ||
        result.stdout.toString() !== "42\n" ||
        !result.stderr.toString().includes("codec acceptance failure:")
      ) {
        throw new Error(
          "Standalone consumer did not preserve delivery and explicitly fail malformed trailing input",
        );
      }
    }
    const child = spawn(installedProbe, ["stream", "7"], {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdoutLines = createInterface({
      input: child.stdout!,
      crlfDelay: Infinity,
    })[Symbol.asyncIterator]();
    const errors = collect(child.stderr!).then((value) => value.toString());
    const status = waitForProcess(child);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      child.stdin!.write("42\n");
      const delivered = await Promise.race([
        stdoutLines.next(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("No record delivered before EOF")),
            10_000,
          );
        }),
      ]);
      if (delivered.done || delivered.value !== "42") {
        throw new Error("Incorrect pre-EOF record delivery");
      }
      child.stdin!.end("undefined");
      const finalRecord = await stdoutLines.next();
      const end = await stdoutLines.next();
      const result = await status;
      if (
        result.code !== 0 ||
        finalRecord.done ||
        finalRecord.value !== "undefined" ||
        !end.done ||
        (await errors) !== ""
      )
        throw new Error("Final EOF delivery failed");
    } catch (error) {
      child.kill("SIGTERM");
      await status.catch(() => undefined);
      await errors;
      throw error;
    } finally {
      clearTimeout(timer);
    }
    console.log(
      `Standalone all-six CLI/native streaming passed on ${process.platform}/${process.arch}; byte chunks, pre-EOF delivery, native GC roundtrip, and malformed EOF verified`,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    throw new Error(
      "Usage: verify-rust-codec.ts <uffda binary> <codec_probe binary>",
    );
  }
  await verifyRustCodec(resolve(args[0]), resolve(args[1]));
}
