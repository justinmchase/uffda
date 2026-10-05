/** A JSR package: `@scope/name`. */
export type JsrPackage = { scope: string; name: string };

/** A `jsr:@scope/name@range/export` specifier, taken apart. */
export type JsrSpecifier = JsrPackage & {
  /** The version range, or `undefined` when the specifier names none. */
  range?: string;
  /** The export name: `.`, or `./<export>`. */
  exportName: string;
};

/** A file of a package version: `https://jsr.io/@scope/name/<version>/<path>`. */
export type JsrFile = JsrPackage & { version: string; path: string };

const SEGMENT = /^[A-Za-z0-9_.-]+$/;

function isSegment(text: string): boolean {
  return SEGMENT.test(text) && text !== "." && text !== "..";
}

/** `@scope/name`. */
export function packageName({ scope, name }: JsrPackage): string {
  return `@${scope}/${name}`;
}

/** The lockfile key of a specifier's package and range: `jsr:@scope/name@range`. */
export function specifierKey(specifier: JsrSpecifier): string {
  const { range } = specifier;
  return `jsr:${packageName(specifier)}${
    range === undefined ? "" : `@${range}`
  }`;
}

/**
 * Takes apart a `jsr:` specifier (see
 * `.agents/specifications/uffda-syntax/imports.spec.md#module-specifiers`), or
 * returns `undefined` when it is not one.
 */
export function parseJsrSpecifier(text: string): JsrSpecifier | undefined {
  if (!text.startsWith("jsr:@")) return undefined;
  const [scope, rest, ...more] = text.slice("jsr:@".length).split("/");
  if (scope === undefined || rest === undefined || !isSegment(scope)) {
    return undefined;
  }
  const at = rest.indexOf("@");
  const name = at < 0 ? rest : rest.slice(0, at);
  const range = at < 0 ? undefined : rest.slice(at + 1);
  if (!isSegment(name) || range === "") return undefined;
  if (!more.every(isSegment)) return undefined;
  return {
    scope,
    name,
    range,
    exportName: more.length === 0 ? "." : `./${more.join("/")}`,
  };
}

/** The registry URL of a package version's file. */
export function fileUrl(registry: URL, file: JsrFile): URL {
  return new URL(
    `${packageName(file)}/${file.version}/${file.path}`,
    registry,
  );
}

/**
 * The package version file a registry URL names, or `undefined` when the URL
 * is not a file of a package version on `registry`.
 */
export function parseFileUrl(registry: URL, url: URL): JsrFile | undefined {
  if (!url.href.startsWith(registry.href)) return undefined;
  const [scope, name, version, ...path] = decodeURIComponent(
    url.href.slice(registry.href.length),
  ).split("/");
  if (
    !scope?.startsWith("@") || !isSegment(scope.slice(1)) ||
    name === undefined || !isSegment(name) ||
    version === undefined || !isSegment(version) ||
    path.length === 0 || !path.every(isSegment)
  ) {
    return undefined;
  }
  return { scope: scope.slice(1), name, version, path: path.join("/") };
}
