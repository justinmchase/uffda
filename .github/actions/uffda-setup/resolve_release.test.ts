import { strictEqual, throws } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  assertAssetChecksum,
  assetFileName,
  assetUrl,
  checksumForAsset,
  releaseHasCliAssets,
  requireArg,
  selectLatestInstallableRelease,
  selectReleaseByTag,
  sha256Hex,
} from "./resolve_release.ts";

describe("req:cli-distribution-004 - uffda-setup resolve_release helpers", () => {
  it("names Windows assets with .exe", () => {
    strictEqual(
      assetFileName("0.1.2", "x86_64-pc-windows-msvc"),
      "uffda-0.1.2-x86_64-pc-windows-msvc.exe",
    );
  });

  it("names non-Windows assets without .exe", () => {
    strictEqual(
      assetFileName("0.1.2", "x86_64-unknown-linux-gnu"),
      "uffda-0.1.2-x86_64-unknown-linux-gnu",
    );
  });

  it("selects draft tags with bare or v-prefixed input", () => {
    const releases = [
      {
        tag_name: "0.1.2",
        assets: [{ name: "SHA256SUMS", url: "https://example.test/sums" }],
      },
    ];
    strictEqual(selectReleaseByTag(releases, "0.1.2").tag_name, "0.1.2");
    strictEqual(selectReleaseByTag(releases, "v0.1.2").tag_name, "0.1.2");
  });

  it("requires CLI args", () => {
    strictEqual(requireArg(["--version", "0.1.2"], "--version"), "0.1.2");
    throws(
      () => requireArg([], "--version"),
      Error,
      "Missing required argument --version",
    );
  });

  it("looks up asset URLs", () => {
    const release = {
      tag_name: "0.1.2",
      assets: [{ name: "SHA256SUMS", url: "https://example.test/sums" }],
    };
    strictEqual(assetUrl(release, "SHA256SUMS"), "https://example.test/sums");
    throws(
      () => assetUrl(release, "missing"),
      Error,
      "No release asset named missing",
    );
  });

  it("treats asset-less published tags as not installable", () => {
    strictEqual(releaseHasCliAssets({ tag_name: "0.9.5", assets: [] }), false);
    strictEqual(
      releaseHasCliAssets({
        tag_name: "0.9.4",
        assets: [
          { name: "SHA256SUMS", url: "https://example.test/sums" },
          {
            name: "uffda-0.9.4-x86_64-unknown-linux-gnu",
            url: "https://example.test/cli",
          },
        ],
      }),
      true,
    );
  });

  it("latest skips empty releases in favor of installable ones", () => {
    const empty = { tag_name: "0.9.5", assets: [] };
    const prior = {
      tag_name: "0.9.4",
      assets: [
        { name: "SHA256SUMS", url: "https://example.test/sums" },
        {
          name: "uffda-0.9.4-x86_64-unknown-linux-gnu",
          url: "https://example.test/cli",
        },
      ],
    };
    strictEqual(
      selectLatestInstallableRelease(empty, [empty, prior]).tag_name,
      "0.9.4",
    );
    strictEqual(
      selectLatestInstallableRelease(prior, [prior]).tag_name,
      "0.9.4",
    );
    throws(
      () => selectLatestInstallableRelease(empty, [empty]),
      Error,
      "Unable to resolve an installable latest release",
    );
  });

  it("req:cli-distribution-004 - hashes asset bytes that contain CR", () => {
    const bytes = new Uint8Array([0x61, 0x0d, 0x0a, 0x62]);
    strictEqual(
      sha256Hex(bytes),
      "18745f36a05e29072709042d6062ce54f1b08ff36c27ba80c39f81fb010c8ce2",
    );
    const name = "uffda-0.1.2-x86_64-pc-windows-msvc.exe";
    const sums = `${sha256Hex(bytes)}  ${name}\r\n`;
    strictEqual(checksumForAsset(sums, name), sha256Hex(bytes));
    assertAssetChecksum(bytes, sums, name);
    throws(
      () => assertAssetChecksum(bytes, `deadbeef  ${name}\n`, name),
      Error,
      `Checksum mismatch for ${name}`,
    );
  });

  it("req:cli-distribution-004 - install script stays on Bash 3.2", () => {
    const action = readFileSync(
      new URL("./action.yml", import.meta.url),
      "utf8",
    );
    const commands = action
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"));
    strictEqual(
      commands.some((line) => /\bmapfile\b/.test(line)),
      false,
    );
    strictEqual(
      commands.some((line) => /\bsha256sum\b/.test(line)),
      false,
    );
  });
});
