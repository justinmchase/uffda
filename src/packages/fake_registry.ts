import { encodeHex } from "@std/encoding/hex";
import { outputNameForSource } from "../runtime/resolvers/artifact_path.ts";
import { type JsrFetch, JsrPackages } from "./jsr_packages.ts";
import type { Lockfile } from "./lockfile.ts";

export type FakeVersion = {
  /** Package paths (no leading `/`) to their text. */
  files: Record<string, string>;
  yanked?: boolean;
};

/** Package names (`@scope/name`) to their versions. */
export type FakePackages = Record<string, Record<string, FakeVersion>>;

export type FakeRegistry = {
  registry: URL;
  fetch: JsrFetch;
  /** The registry paths fetched, in order. */
  requests: string[];
};

async function sha256(text: string): Promise<string> {
  return encodeHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  );
}

/**
 * A registry serving `packages` the way JSR does (`meta.json`,
 * `<version>_meta.json` with a sha256 manifest, and the files), for tests.
 */
export async function fakeRegistry(
  packages: FakePackages,
  registry = new URL("https://registry.test/"),
): Promise<FakeRegistry> {
  const served = new Map<string, string>();
  for (const [name, versions] of Object.entries(packages)) {
    const meta: Record<string, { yanked?: boolean }> = {};
    for (const [version, { files, yanked }] of Object.entries(versions)) {
      meta[version] = yanked ? { yanked } : {};
      const manifest: Record<string, { size: number; checksum: string }> = {};
      for (const [path, text] of Object.entries(files)) {
        manifest[`/${path}`] = {
          size: text.length,
          checksum: `sha256-${await sha256(text)}`,
        };
        served.set(`${name}/${version}/${path}`, text);
      }
      served.set(`${name}/${version}_meta.json`, JSON.stringify({ manifest }));
    }
    const [scope, pkg] = name.slice(1).split("/");
    served.set(
      `${name}/meta.json`,
      JSON.stringify({ scope, name: pkg, versions: meta }),
    );
  }
  const requests: string[] = [];
  return {
    registry,
    requests,
    fetch: (url) => {
      const path = url.href.slice(registry.href.length);
      requests.push(path);
      const text = served.get(path);
      return Promise.resolve(
        text === undefined
          ? new Response("not found", { status: 404 })
          : new Response(text),
      );
    },
  };
}

/** `JsrPackages` reading `packages` from a fake registry, with its own cache. */
export async function fakeJsrPackages(
  packages: FakePackages,
  lockfile?: Lockfile,
): Promise<FakeRegistry & { packages: JsrPackages }> {
  const fake = await fakeRegistry(packages);
  return {
    ...fake,
    packages: new JsrPackages({
      registry: fake.registry,
      fetch: fake.fetch,
      cacheDir: await Deno.makeTempDir({ prefix: "uffda-jsr-cache-" }),
      lockfile,
    }),
  };
}

/**
 * A package version whose `uffda.jsonc` exports `exports` (export names to
 * `.uff` paths), each compiled into `./bin` as a module exporting one rule
 * matching anything, named by `rules` (export names to rule names).
 */
export function fakeUffPackage(
  exports: Record<string, string>,
  rules: Record<string, string>,
): FakeVersion {
  const files: Record<string, string> = {
    "uffda.jsonc": JSON.stringify({ exports }),
  };
  for (const [name, path] of Object.entries(exports)) {
    const rule = rules[name];
    files[`bin/ast/${outputNameForSource(path.slice("./".length))}`] = JSON
      .stringify({
        imports: [],
        exports: [{ kind: "rule", name: rule }],
        rules: [{ name: rule, parameters: [], pattern: { kind: "any" } }],
      });
  }
  return { files };
}
