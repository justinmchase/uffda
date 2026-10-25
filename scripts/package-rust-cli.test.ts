import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rejects, strictEqual, throws } from "node:assert/strict";
import test from "node:test";
import {
  packageRustCli,
  RUST_PREVIEW_TARGETS,
  rustReleaseAsset,
} from "./package-rust-cli.ts";

test("req:data-codec-004 - release assets use uffda names for all native platforms", () => {
  for (const target of RUST_PREVIEW_TARGETS) {
    strictEqual(
      rustReleaseAsset("1.2.3", target),
      `uffda-1.2.3-${target}${target.includes("windows") ? ".exe" : ""}`,
    );
    strictEqual(
      rustReleaseAsset("1.2.3-pre.1", target).startsWith("uffda-1.2.3-pre.1-"),
      true,
    );
  }
  throws(() => rustReleaseAsset("../bad", RUST_PREVIEW_TARGETS[0]));
  throws(() => rustReleaseAsset("1.2.3", "unsupported"));
});

test("req:data-codec-004 - preview packaging copies bytes and emits portable SHA256 files", async () => {
  const temp = await mkdtemp(join(tmpdir(), "uffda-package-cli-"));
  try {
    const source = join(temp, "binary");
    await writeFile(source, "abc");
    const asset = await packageRustCli(
      source,
      "1.2.3",
      RUST_PREVIEW_TARGETS[0],
      join(temp, "dist"),
    );
    strictEqual(await readFile(asset, "utf8"), "abc");
    strictEqual(
      await readFile(asset + ".sha256", "utf8"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  uffda-1.2.3-x86_64-unknown-linux-gnu\n",
    );
    await rejects(
      packageRustCli(
        join(temp, "missing"),
        "1.2.3",
        RUST_PREVIEW_TARGETS[0],
        join(temp, "dist"),
      ),
      (error: NodeJS.ErrnoException) => error.code === "ENOENT",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("req:data-codec-004 - release covers all six native targets; checks cover Linux only", async () => {
  const check = await readFile(
    new URL("../.github/workflows/checks.yml", import.meta.url),
    "utf8",
  );
  const release = await readFile(
    new URL("../.github/workflows/release-binaries.yml", import.meta.url),
    "utf8",
  );
  for (const target of RUST_PREVIEW_TARGETS) {
    strictEqual(
      check.includes(`target: ${target}`),
      target.endsWith("-linux-gnu"),
      `Unexpected check coverage for ${target}`,
    );
    strictEqual(
      release
        .slice(release.indexOf("  compile-rust:"))
        .includes(`target: ${target}`),
      true,
      `Missing release ${target}`,
    );
  }
  for (const workflow of [check, release]) {
    strictEqual(workflow.includes("--test standalone_acceptance"), true);
    strictEqual(workflow.includes("scripts/verify-rust-codec.ts"), false);
  }
});
