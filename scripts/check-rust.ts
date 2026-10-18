/**
 * Local Rust Checks gate (Format, Clippy, Test), matching
 * `.github/workflows/checks.yml`.
 *
 * Usage:
 *   deno task check:rust           # fmt --check, clippy -D warnings, test
 *   deno task check:rust -- fix    # cargo fmt, then the same verification
 *   deno task fmt:rust             # cargo fmt --all
 *   deno run -A ./scripts/check-rust.ts [fmt|fmt-check|clippy|test|check|fix]
 */

const MANIFEST = ["--manifest-path", "rust/Cargo.toml"];

async function run(command: string, args: string[]): Promise<void> {
  console.log(`$ ${command} ${args.join(" ")}`);
  const child = new Deno.Command(command, {
    args,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();
  const status = await child.status;
  if (!status.success) {
    Deno.exit(status.code === 0 ? 1 : status.code);
  }
}

async function fmtWrite(): Promise<void> {
  await run("cargo", ["fmt", ...MANIFEST, "--all"]);
}

async function fmtCheck(): Promise<void> {
  await run("cargo", ["fmt", ...MANIFEST, "--all", "--check"]);
}

async function clippy(): Promise<void> {
  await run("cargo", [
    "clippy",
    ...MANIFEST,
    "--workspace",
    "--all-targets",
    "--locked",
    "--",
    "-D",
    "warnings",
  ]);
}

async function test(): Promise<void> {
  await run("cargo", ["test", ...MANIFEST, "--workspace", "--locked"]);
}

/** Checks workflow: fmt --check, clippy -D warnings, test. */
async function check(): Promise<void> {
  await fmtCheck();
  await clippy();
  await test();
}

/** Write formatting, then run the Checks-equivalent gate. */
async function fix(): Promise<void> {
  await fmtWrite();
  await check();
}

if (import.meta.main) {
  const command = Deno.args[0] ?? "check";
  switch (command) {
    case "fmt":
      await fmtWrite();
      break;
    case "fmt-check":
      await fmtCheck();
      break;
    case "clippy":
      await clippy();
      break;
    case "test":
      await test();
      break;
    case "check":
      await check();
      break;
    case "fix":
      await fix();
      break;
    default:
      console.error(
        `Unknown command ${command}. Use: fmt | fmt-check | clippy | test | check | fix`,
      );
      Deno.exit(2);
  }
}
