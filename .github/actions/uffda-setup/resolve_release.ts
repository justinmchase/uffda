/**
 * Resolve and download an Uffda CLI release asset for GitHub Actions runners.
 *
 * Usage:
 *   deno run -A ./resolve_release.ts \
 *     --repository owner/repo \
 *     --version latest|0.1.2 \
 *     --target x86_64-unknown-linux-gnu \
 *     --token "$GH_TOKEN" \
 *     --outdir "$tmpdir"
 *
 * Prints newline-delimited: tag_name, version, asset_name, asset_path, sums_path
 */
export type ReleaseAsset = {
  name: string;
  url: string;
};

export type Release = {
  tag_name: string;
  assets: ReleaseAsset[];
};

export function argValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx >= 0) return argv[idx + 1];
  const prefix = `${name}=`;
  const match = argv.find((a) => a.startsWith(prefix));
  return match?.slice(prefix.length);
}

export function requireArg(argv: string[], name: string): string {
  const value = argValue(argv, name);
  if (!value) {
    throw new Error(`Missing required argument ${name}`);
  }
  return value;
}

export function assetFileName(version: string, target: string): string {
  const base = `uffda-${version}-${target}`;
  return target.includes("windows") ? `${base}.exe` : base;
}

export function assetUrl(release: Release, name: string): string {
  const asset = release.assets.find((item) => item.name === name);
  if (!asset) {
    throw new Error(`No release asset named ${name}`);
  }
  return asset.url;
}

export function selectReleaseByTag(
  releases: Release[],
  versionInput: string,
): Release {
  const bare = versionInput.replace(/^v/i, "");
  const candidates = new Set([bare, `v${bare}`]);
  const match = releases.find((release) => candidates.has(release.tag_name));
  if (!match) {
    throw new Error(`Unable to resolve release tag ${bare}`);
  }
  return match;
}

async function githubJson<T>(
  url: string,
  token: string | undefined,
): Promise<T | undefined> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, { headers });
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`GitHub API ${url} failed: ${response.status}`);
  }
  return await response.json() as T;
}

async function downloadAsset(
  url: string,
  token: string | undefined,
  dest: string,
): Promise<void> {
  const headers: Record<string, string> = {
    Accept: "application/octet-stream",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`download failed: ${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      await Deno.writeFile(dest, bytes);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to download ${url}`);
}

export async function resolveRelease(
  repository: string,
  versionInput: string,
  token: string | undefined,
): Promise<Release> {
  const api = `https://api.github.com/repos/${repository}/releases`;
  if (versionInput === "latest") {
    const latest = await githubJson<Release>(`${api}/latest`, token);
    if (!latest) {
      throw new Error(`Unable to resolve latest release for ${repository}`);
    }
    return latest;
  }

  const bare = versionInput.replace(/^v/i, "");
  for (const tag of [bare, `v${bare}`]) {
    const byTag = await githubJson<Release>(`${api}/tags/${tag}`, token);
    if (byTag) return byTag;
  }

  // Draft releases are not exposed by /releases/tags/{tag}.
  const releases = await githubJson<Release[]>(`${api}?per_page=100`, token);
  if (!releases) {
    throw new Error(`Unable to list releases for ${repository}`);
  }
  return selectReleaseByTag(releases, bare);
}

async function main(): Promise<void> {
  const argv = Deno.args;
  const repository = requireArg(argv, "--repository");
  const versionInput = requireArg(argv, "--version");
  const target = requireArg(argv, "--target");
  const outdir = requireArg(argv, "--outdir");
  const token = argValue(argv, "--token");

  await Deno.mkdir(outdir, { recursive: true });
  const release = await resolveRelease(repository, versionInput, token);
  const tagName = release.tag_name;
  const version = tagName.replace(/^v/i, "");
  const name = assetFileName(version, target);

  const assetPath = `${outdir}/${name}`;
  const sumsPath = `${outdir}/SHA256SUMS`;
  await downloadAsset(assetUrl(release, name), token, assetPath);
  await downloadAsset(assetUrl(release, "SHA256SUMS"), token, sumsPath);

  console.log([tagName, version, name, assetPath, sumsPath].join("\n"));
}

if (import.meta.main) {
  await main();
}
