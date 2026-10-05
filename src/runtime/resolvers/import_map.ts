/**
 * Module names (aliases), each mapped to the `jsr:` specifier it stands for,
 * as the project file's `imports` declares them (see
 * `.agents/specifications/modules.spec.md#import-maps`).
 */
export type ImportMap = ReadonlyMap<string, string>;

export const EMPTY_IMPORT_MAP: ImportMap = new Map();

export type UnfurledSpecifier =
  | { ok: true; specifier: string }
  | { ok: false; message: string };

/** Whether `name` is `alias` or one of its exports (`alias/...`). */
export function isUnderAlias(name: string, alias: string): boolean {
  return name === alias || name.startsWith(`${alias}/`);
}

/** The alias of `imports` that `name` falls under, if any. */
export function aliasOf(
  imports: ImportMap,
  name: string,
): string | undefined {
  return [...imports.keys()].find((alias) => isUnderAlias(name, alias));
}

/**
 * `specifier` with its alias written out in full: a module name (`@...`)
 * becomes the `jsr:` specifier its alias stands for, followed by the rest of
 * the name (`@acme/kv/tokens` with `@acme/kv` mapped to
 * `jsr:@acme/kv@^1.2.0` becomes `jsr:@acme/kv@^1.2.0/tokens`). Any other
 * specifier is already in full and stays as written. A module name no alias
 * covers is reported.
 */
export function unfurlSpecifier(
  imports: ImportMap,
  specifier: string,
): UnfurledSpecifier {
  if (!specifier.startsWith("@")) return { ok: true, specifier };
  const alias = aliasOf(imports, specifier);
  if (alias === undefined) {
    return {
      ok: false,
      message:
        `"${specifier}" is not a module name the project file's \`imports\` declares`,
    };
  }
  return {
    ok: true,
    specifier: `${imports.get(alias)}${specifier.slice(alias.length)}`,
  };
}
