import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { join } from "@std/path";
import {
  packageRustCli,
  RUST_PREVIEW_TARGETS,
  rustPreviewAsset,
} from "./package-rust-cli.ts";

Deno.test("req:data-codec-004 - preview assets retain separate names for all native platforms", () => {
  for (const target of RUST_PREVIEW_TARGETS) {
    assertEquals(
      rustPreviewAsset("1.2.3", target),
      `uffdar-1.2.3-${target}${target.includes("windows") ? ".exe" : ""}`,
    );
    assertEquals(
      rustPreviewAsset("1.2.3-pre.1", target).startsWith("uffdar-1.2.3-pre.1-"),
      true,
    );
  }
  assertThrows(() => rustPreviewAsset("../bad", RUST_PREVIEW_TARGETS[0]));
  assertThrows(() => rustPreviewAsset("1.2.3", "unsupported"));
});

Deno.test("req:data-codec-004 - preview packaging copies bytes and emits portable SHA256 files", async () => {
  const temp = await Deno.makeTempDir();
  try {
    const source = join(temp, "binary");
    await Deno.writeTextFile(source, "abc");
    const asset = await packageRustCli(
      source,
      "1.2.3",
      RUST_PREVIEW_TARGETS[0],
      join(temp, "dist"),
    );
    assertEquals(await Deno.readTextFile(asset), "abc");
    assertEquals(
      await Deno.readTextFile(asset + ".sha256"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  uffdar-1.2.3-x86_64-unknown-linux-gnu\n",
    );
    await assertRejects(
      () =>
        packageRustCli(
          join(temp, "missing"),
          "1.2.3",
          RUST_PREVIEW_TARGETS[0],
          join(temp, "dist"),
        ),
      Deno.errors.NotFound,
    );
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
});

Deno.test("req:data-codec-004 - release covers all six native targets; checks cover Linux only", async () => {
  const check = await Deno.readTextFile(
    new URL("../.github/workflows/checks.yml", import.meta.url),
  );
  const release = await Deno.readTextFile(
    new URL("../.github/workflows/release-binaries.yml", import.meta.url),
  );
  for (const target of RUST_PREVIEW_TARGETS) {
    assertEquals(
      check.includes(`target: ${target}`),
      target.endsWith("-linux-gnu"),
      `Unexpected check coverage for ${target}`,
    );
    assertEquals(
      release.slice(release.indexOf("  compile-rust:")).includes(
        `target: ${target}`,
      ),
      true,
      `Missing release ${target}`,
    );
  }
  for (const workflow of [check, release]) {
    assertEquals(workflow.includes("scripts/verify-rust-codec.ts"), true);
  }
});
