import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { assetNameForTarget, binaryFileName, resolveTarget } from "./platform";

const REPO = "justinmchase/uffda";
const GITHUB_API = "https://api.github.com";

export class DownloadError extends Error {}

interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  assets: GithubReleaseAsset[];
}

/**
 * Downloads the platform-matching compiled `uffda` binary from the project's
 * published GitHub Release artifacts, verifies it against its published
 * `.sha256` checksum, and caches it under `storageDir` for reuse across
 * sessions (requirement cli-language-server-007's automatic-download
 * fallback).
 *
 * `version` is a minimum-version-compatible release tag to fetch (usually
 * "latest"); pass an explicit tag (e.g. "0.2.7") to pin a specific release.
 */
export async function downloadUffdaBinary(
  storageDir: string,
  version = "latest",
): Promise<string> {
  const target = resolveTarget(process.platform, process.arch);
  if (!target) {
    throw new DownloadError(
      `No published uffda binary is available for this platform (${process.platform}/${process.arch}).`,
    );
  }

  const release = await fetchRelease(version);
  const releaseVersion = release.tag_name.replace(/^v/, "");
  const assetName = assetNameForTarget(releaseVersion, target);
  const asset = release.assets.find((a) => a.name === assetName);
  const sumsAsset = release.assets.find((a) => a.name === "SHA256SUMS") ??
    release.assets.find((a) => a.name === `${assetName}.sha256`);
  if (!asset) {
    throw new DownloadError(
      `Release ${release.tag_name} has no asset named ${assetName}.`,
    );
  }
  if (!sumsAsset) {
    throw new DownloadError(
      `Release ${release.tag_name} has no checksum asset to verify ${assetName} against.`,
    );
  }

  const cacheDir = path.join(storageDir, "uffda-bin", releaseVersion, target);
  const binaryName = binaryFileName(target);
  const binaryPath = path.join(cacheDir, binaryName);
  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }

  await fsp.mkdir(cacheDir, { recursive: true });

  const [assetBytes, sumsText] = await Promise.all([
    fetchBytes(asset.browser_download_url),
    fetchText(sumsAsset.browser_download_url),
  ]);

  const expected = findChecksum(sumsText, assetName);
  if (!expected) {
    throw new DownloadError(
      `No checksum entry for ${assetName} in ${sumsAsset.name}.`,
    );
  }
  const actual = crypto.createHash("sha256").update(assetBytes).digest("hex");
  if (actual !== expected) {
    throw new DownloadError(
      `Checksum mismatch for ${assetName}: expected ${expected}, got ${actual}.`,
    );
  }

  const tmpPath = `${binaryPath}.download`;
  await fsp.writeFile(tmpPath, assetBytes, { mode: 0o755 });
  await fsp.rename(tmpPath, binaryPath);
  await fsp.chmod(binaryPath, 0o755);
  return binaryPath;
}

function findChecksum(sumsText: string, assetName: string): string | undefined {
  for (const line of sumsText.split("\n")) {
    const [sum, name] = line.trim().split(/\s+/);
    if (name === assetName || name === `*${assetName}`) return sum;
  }
  return undefined;
}

async function fetchRelease(version: string): Promise<GithubRelease> {
  const url = version === "latest"
    ? `${GITHUB_API}/repos/${REPO}/releases/latest`
    : `${GITHUB_API}/repos/${REPO}/releases/tags/${version.replace(/^v/, "")}`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    throw new DownloadError(
      `Failed to look up uffda release ${version} (${res.status} ${res.statusText}).`,
    );
  }
  return await res.json() as GithubRelease;
}

async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new DownloadError(`Failed to download ${url} (${res.status} ${res.statusText}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new DownloadError(`Failed to download ${url} (${res.status} ${res.statusText}).`);
  }
  return await res.text();
}
