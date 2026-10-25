import { strictEqual, throws } from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assetFileName,
  assetUrl,
  releaseHasCliAssets,
  requireArg,
  selectLatestInstallableRelease,
  selectReleaseByTag,
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
});
