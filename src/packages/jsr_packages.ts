import { encodeHex } from "@std/encoding/hex";
import { dirname, join, relative } from "@std/path";
import * as posix from "@std/path/posix";
import { format, maxSatisfying, parse, parseRange } from "@std/semver";
import { Type, type } from "@justinmchase/type";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { outputNameForSource } from "../runtime/resolvers/artifact_path.ts";
import {
  type IPackageResolver,
  moduleDeclarationResolutionResult,
  type ModuleDeclarationResult,
  moduleDeclarationResult,
  type ModuleResolutionContext,
  moduleResolutionError,
  type PackageResolution,
} from "../runtime/resolvers/resolver.ts";
import { parseProject, PROJECT_FILE_NAME } from "../project/project.ts";
import { uffdaCacheDir } from "./cache_dir.ts";
import {
  fileUrl,
  type JsrPackage,
  type JsrSpecifier,
  packageName,
  parseFileUrl,
  parseJsrSpecifier,
  specifierKey,
} from "./jsr_specifier.ts";
import { Lockfile } from "./lockfile.ts";

export const JSR_REGISTRY: URL = new URL("https://jsr.io/");

export type JsrFetch = (url: URL) => Promise<Response>;

export type JsrPackagesOptions = {
  /** The registry packages are read from. Defaults to `https://jsr.io/`. */
  registry?: URL;
  /** The cache directory, `<cache>/uffda`. Defaults to `uffdaCacheDir()`. */
  cacheDir?: string;
  /** The versions and integrities to resolve through and record. */
  lockfile?: Lockfile;
  fetch?: JsrFetch;
};

type Result<T> = { ok: true; value: T } | { ok: false; message: string };

/** What a package version's `<version>_meta.json` and `uffda.jsonc` say. */
type PackageVersion = {
  file: JsrPackage & { version: string };
  /** Package paths (no leading `/`) to their sha256 hex. */
  manifest: Map<string, string>;
  /** Export names to package paths. */
  exports: Map<string, string>;
  /** The package path of the output directory. */
  outDir: string;
};

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  return encodeHex(
    await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>),
  );
}

/** A package path from a `./`-relative one, or `undefined` if it escapes. */
function packagePath(path: string): string | undefined {
  const normal = posix.normalize(path);
  return normal === "." || normal === ".." || normal.startsWith("../")
    ? undefined
    : normal;
}

function readVersions(value: unknown): Result<string[]> {
  const [t, v] = type(value);
  const versions = t === Type.Object
    ? (v as Record<string, unknown>).versions
    : undefined;
  const [vt, vv] = type(versions);
  if (vt !== Type.Object) return fail("its meta.json lists no versions");
  return {
    ok: true,
    value: Object.entries(vv as Record<string, unknown>)
      .filter(([, info]) =>
        (info as { yanked?: unknown } | undefined)?.yanked !== true
      )
      .map(([version]) => version),
  };
}

function readManifest(value: unknown): Result<Map<string, string>> {
  const [t, v] = type(value);
  const manifest = t === Type.Object
    ? (v as Record<string, unknown>).manifest
    : undefined;
  const [mt, mv] = type(manifest);
  if (mt !== Type.Object) return fail("its version meta has no manifest");
  const files = new Map<string, string>();
  for (const [path, entry] of Object.entries(mv as Record<string, unknown>)) {
    const checksum = (entry as { checksum?: unknown } | undefined)?.checksum;
    if (
      !path.startsWith("/") || type(checksum)[0] !== Type.String ||
      !(checksum as string).startsWith("sha256-")
    ) {
      return fail(`its version meta lists ${path} without a sha256 checksum`);
    }
    files.set(path.slice(1), (checksum as string).slice("sha256-".length));
  }
  return { ok: true, value: files };
}

/**
 * Loads `jsr:` modules from a JSR registry (see `modules.spec.md#packages`):
 * chooses versions through the lockfile and the registry's `meta.json`, maps
 * exports through each package version's `uffda.jsonc`, and reads compiled
 * artifacts from its output directory, verified against its manifest and kept
 * in a cache.
 */
export class JsrPackages implements IPackageResolver {
  private readonly registry: URL;
  private readonly lockfile: Lockfile;
  private readonly fetch: JsrFetch;
  private cacheDirOption?: string;
  /** Versions chosen so far, by package name. */
  private readonly chosen = new Map<string, string[]>();
  private readonly metas = new Map<string, Promise<Result<string[]>>>();
  private readonly versions = new Map<
    string,
    Promise<Result<PackageVersion>>
  >();

  constructor(options: JsrPackagesOptions = {}) {
    this.registry = options.registry ?? JSR_REGISTRY;
    this.lockfile = options.lockfile ?? new Lockfile();
    this.fetch = options.fetch ?? ((url) => fetch(url));
    this.cacheDirOption = options.cacheDir;
  }

  async resolve(specifier: string): Promise<PackageResolution> {
    try {
      return await this.resolveSpecifier(specifier);
    } catch (error) {
      return fail(messageOf(error));
    }
  }

  private async resolveSpecifier(
    specifier: string,
  ): Promise<PackageResolution> {
    const jsr = parseJsrSpecifier(specifier);
    if (!jsr) return fail(`"${specifier}" is not a jsr: specifier`);
    const version = await this.chooseVersion(jsr);
    if (!version.ok) return version;
    const file = { scope: jsr.scope, name: jsr.name, version: version.value };
    const info = await this.packageVersion(file);
    if (!info.ok) return info;
    const path = info.value.exports.get(jsr.exportName);
    const label = `${packageName(jsr)}@${version.value}`;
    if (path === undefined) {
      return fail(
        `${label} does not export "${jsr.exportName}" (its ${PROJECT_FILE_NAME} exports ${
          [...info.value.exports.keys()].map((name) => `"${name}"`).join(
            ", ",
          ) || "nothing"
        })`,
      );
    }
    if (posix.extname(path) !== ".uff") {
      return fail(
        `${label} exports "${jsr.exportName}" as ${path}, which is not a .uff module`,
      );
    }
    return { ok: true, url: fileUrl(this.registry, { ...file, path }) };
  }

  packageOf(url: URL): string | undefined {
    const file = parseFileUrl(this.registry, url);
    return file && `${packageName(file)}@${file.version}`;
  }

  async load(
    url: URL,
    context: ModuleResolutionContext,
  ): Promise<ModuleDeclarationResult> {
    let result: Result<ModuleDeclaration>;
    try {
      result = await this.loadDeclaration(url);
    } catch (error) {
      result = fail(messageOf(error));
    }
    return result.ok
      ? moduleDeclarationResult(result.value)
      : moduleDeclarationResolutionResult(
        moduleResolutionError(
          `Unable to load ${url.href}: ${result.message}`,
          context,
        ),
      );
  }

  private async loadDeclaration(url: URL): Promise<Result<ModuleDeclaration>> {
    const file = parseFileUrl(this.registry, url);
    if (!file) return fail("it is not a file of a package version");
    if (posix.extname(file.path) !== ".uff") {
      return fail("a package supplies .uff modules only");
    }
    const info = await this.packageVersion(file);
    if (!info.ok) return info;
    const artifact = posix.join(
      info.value.outDir,
      "ast",
      outputNameForSource(file.path),
    );
    const bytes = await this.packageFile(info.value, artifact);
    if (!bytes.ok) return bytes;
    try {
      return {
        ok: true,
        value: JSON.parse(new TextDecoder().decode(bytes.value)),
      };
    } catch (error) {
      return fail(
        `its compiled artifact ${artifact} is not JSON: ${messageOf(error)}`,
      );
    }
  }

  private async chooseVersion(jsr: JsrSpecifier): Promise<Result<string>> {
    const key = specifierKey(jsr);
    const locked = this.lockfile.version(key);
    if (locked !== undefined) return { ok: true, value: locked };
    let range;
    try {
      range = parseRange(jsr.range ?? "*");
    } catch {
      return fail(`"${jsr.range}" is not a version range`);
    }
    const name = packageName(jsr);
    const chosen = this.chosen.get(name) ?? [];
    let version = maxSatisfying(chosen.map((v) => parse(v)), range);
    if (!version) {
      const versions = await this.packageVersions(jsr);
      if (!versions.ok) return versions;
      version = maxSatisfying(
        versions.value.flatMap((v) => {
          try {
            return [parse(v)];
          } catch {
            return [];
          }
        }),
        range,
      );
      if (!version) {
        return fail(
          `${name} has no version matching "${jsr.range ?? "*"}"`,
        );
      }
    }
    const value = format(version);
    if (!chosen.includes(value)) this.chosen.set(name, [...chosen, value]);
    await this.lockfile.setVersion(key, value);
    return { ok: true, value };
  }

  /** The non-yanked versions of a package, from its `meta.json`. */
  private packageVersions(pkg: JsrPackage): Promise<Result<string[]>> {
    const name = packageName(pkg);
    let versions = this.metas.get(name);
    if (!versions) {
      versions = this.readPackageVersions(pkg);
      this.metas.set(name, versions);
    }
    return versions;
  }

  private async readPackageVersions(
    pkg: JsrPackage,
  ): Promise<Result<string[]>> {
    const path = `${packageName(pkg)}/meta.json`;
    let bytes = await this.download(path);
    if (bytes.ok) {
      await this.writeCache(path, bytes.value);
    } else {
      const cached = await this.readCache(path);
      if (!cached) return fail(`${packageName(pkg)}: ${bytes.message}`);
      bytes = { ok: true, value: cached };
    }
    try {
      return readVersions(JSON.parse(new TextDecoder().decode(bytes.value)));
    } catch (error) {
      return fail(`${packageName(pkg)}'s meta.json: ${messageOf(error)}`);
    }
  }

  private packageVersion(
    file: JsrPackage & { version: string },
  ): Promise<Result<PackageVersion>> {
    const key = `${packageName(file)}@${file.version}`;
    let info = this.versions.get(key);
    if (!info) {
      info = this.readPackageVersion(file, key);
      this.versions.set(key, info);
    }
    return info;
  }

  private async readPackageVersion(
    file: JsrPackage & { version: string },
    key: string,
  ): Promise<Result<PackageVersion>> {
    const path = `${packageName(file)}/${file.version}_meta.json`;
    const locked = this.lockfile.integrity(key);
    let bytes: Uint8Array | undefined = await this.readCache(path);
    if (bytes && locked !== undefined && await sha256(bytes) !== locked) {
      bytes = undefined;
    }
    if (!bytes) {
      const downloaded = await this.download(path);
      if (!downloaded.ok) return fail(`${key}: ${downloaded.message}`);
      bytes = downloaded.value;
    }
    const integrity = await sha256(bytes);
    if (locked !== undefined && integrity !== locked) {
      return fail(
        `${key}'s version meta does not match the integrity the lockfile records`,
      );
    }
    await this.writeCache(path, bytes);
    await this.lockfile.setIntegrity(key, integrity);
    let manifest: Result<Map<string, string>>;
    try {
      manifest = readManifest(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (error) {
      return fail(`${key}'s version meta: ${messageOf(error)}`);
    }
    if (!manifest.ok) return fail(`${key}: ${manifest.message}`);
    const partial = {
      file,
      manifest: manifest.value,
      exports: new Map(),
      outDir: "",
    };
    const text = await this.packageFile(partial, PROJECT_FILE_NAME);
    if (!text.ok) return text;
    const parsed = await parseProject(
      new TextDecoder().decode(text.value),
      `/${PROJECT_FILE_NAME}`,
    );
    if (!parsed.ok) {
      return fail(
        `${key}'s ${PROJECT_FILE_NAME} is not valid: ${
          parsed.problems.map((problem) => problem.message).join(" ")
        }`,
      );
    }
    const { project } = parsed;
    const exports = new Map<string, string>();
    for (const [name, target] of project.exports) {
      const path = packagePath(target);
      if (path === undefined) {
        return fail(
          `${key}'s ${PROJECT_FILE_NAME} exports "${name}" as ${target}, outside the package`,
        );
      }
      exports.set(name, path);
    }
    return {
      ok: true,
      value: {
        file,
        manifest: manifest.value,
        exports,
        outDir: relative(project.root, project.outDir).replaceAll("\\", "/"),
      },
    };
  }

  /** A file of a package version, from the cache or the registry, verified. */
  private async packageFile(
    info: Pick<PackageVersion, "file" | "manifest">,
    path: string,
  ): Promise<Result<Uint8Array>> {
    const label = `${packageName(info.file)}@${info.file.version}`;
    const checksum = info.manifest.get(path);
    if (checksum === undefined) {
      return fail(`${label} has no file ${path}`);
    }
    const registryPath = `${
      packageName(info.file)
    }/${info.file.version}/${path}`;
    const cached = await this.readCache(registryPath);
    if (cached && await sha256(cached) === checksum) {
      return { ok: true, value: cached };
    }
    const downloaded = await this.download(registryPath);
    if (!downloaded.ok) return fail(`${label}: ${downloaded.message}`);
    if (await sha256(downloaded.value) !== checksum) {
      return fail(`${label}'s ${path} does not match its manifest checksum`);
    }
    await this.writeCache(registryPath, downloaded.value);
    return downloaded;
  }

  private async download(path: string): Promise<Result<Uint8Array>> {
    const url = new URL(path, this.registry);
    let response: Response;
    try {
      response = await this.fetch(url);
    } catch (error) {
      return fail(`unable to fetch ${url.href}: ${messageOf(error)}`);
    }
    if (!response.ok) {
      await response.body?.cancel();
      return fail(
        response.status === 404
          ? `${url.href} was not found`
          : `fetching ${url.href} failed with ${response.status} ${response.statusText}`,
      );
    }
    return { ok: true, value: new Uint8Array(await response.arrayBuffer()) };
  }

  private cachePath(path: string): string {
    this.cacheDirOption ??= uffdaCacheDir();
    return join(this.cacheDirOption, "jsr", ...path.split("/"));
  }

  private async readCache(path: string): Promise<Uint8Array | undefined> {
    try {
      return await Deno.readFile(this.cachePath(path));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return undefined;
      throw error;
    }
  }

  /** Writes a cache file whole, so a reader never sees part of it. */
  private async writeCache(path: string, bytes: Uint8Array): Promise<void> {
    const target = this.cachePath(path);
    await Deno.mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${crypto.randomUUID()}.tmp`;
    await Deno.writeFile(temp, bytes);
    await Deno.rename(temp, target);
  }
}
