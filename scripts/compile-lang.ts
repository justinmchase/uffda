import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function compileLanguages(
  root: string,
  run: (cwd: string, command: string, args: string[]) => Promise<void>,
): Promise<void> {
  await rm(join(root, "bin"), { recursive: true, force: true });
  await run(root, "uffda", ["compile", "src/lang/**/*.uff"]);
}

async function run(
  cwd: string,
  command: string,
  args: string[],
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed (${code ?? signal})`));
    });
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await compileLanguages(process.cwd(), run);
}
