import { assertEquals, assertThrows } from "@std/assert";
import {
  assetFileName,
  assetUrl,
  requireArg,
  selectReleaseByTag,
} from "./resolve_release.ts";

Deno.test("uffda-setup resolve_release helpers", async (t) => {
  await t.step("names Windows assets with .exe", () => {
    assertEquals(
      assetFileName("0.1.2", "x86_64-pc-windows-msvc"),
      "uffda-0.1.2-x86_64-pc-windows-msvc.exe",
    );
  });

  await t.step("names non-Windows assets without .exe", () => {
    assertEquals(
      assetFileName("0.1.2", "x86_64-unknown-linux-gnu"),
      "uffda-0.1.2-x86_64-unknown-linux-gnu",
    );
  });

  await t.step("selects draft tags with bare or v-prefixed input", () => {
    const releases = [
      {
        tag_name: "0.1.2",
        assets: [{ name: "SHA256SUMS", url: "https://example.test/sums" }],
      },
    ];
    assertEquals(selectReleaseByTag(releases, "0.1.2").tag_name, "0.1.2");
    assertEquals(selectReleaseByTag(releases, "v0.1.2").tag_name, "0.1.2");
  });

  await t.step("requires CLI args", () => {
    assertEquals(requireArg(["--version", "0.1.2"], "--version"), "0.1.2");
    assertThrows(
      () => requireArg([], "--version"),
      Error,
      "Missing required argument --version",
    );
  });

  await t.step("looks up asset URLs", () => {
    const release = {
      tag_name: "0.1.2",
      assets: [{ name: "SHA256SUMS", url: "https://example.test/sums" }],
    };
    assertEquals(assetUrl(release, "SHA256SUMS"), "https://example.test/sums");
    assertThrows(
      () => assetUrl(release, "missing"),
      Error,
      "No release asset named missing",
    );
  });
});
