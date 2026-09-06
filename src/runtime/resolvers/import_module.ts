/**
 * Dynamically import a module by runtime specifier (typically a consumer
 * `file:` / `http:` URL).
 *
 * Specifiers are never package-local paths JSR could rewrite at publish time.
 * An indirect `import` keeps `deno publish` / `jsr publish` from emitting
 * `unanalyzable-dynamic-import` warnings for this intentional loader.
 */
export function importModule(
  specifier: string,
  options?: ImportCallOptions,
): Promise<{ default?: unknown }> {
  const load = new Function(
    "specifier",
    "options",
    "return options === undefined ? import(specifier) : import(specifier, options)",
  ) as (
    specifier: string,
    options?: ImportCallOptions,
  ) => Promise<{ default?: unknown }>;
  return load(specifier, options);
}
