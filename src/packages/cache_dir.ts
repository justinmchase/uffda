import { join } from "@std/path";

/**
 * The directory uffda keeps downloads in: `<cache>/uffda`, where `<cache>` is
 * `XDG_CACHE_HOME`, else `LOCALAPPDATA`, else `$HOME/.cache` (see
 * `modules.spec.md#packages`).
 */
export function uffdaCacheDir(
  env: (name: string) => string | undefined = (name) => Deno.env.get(name),
): string {
  const cache = env("XDG_CACHE_HOME") ?? env("LOCALAPPDATA") ??
    join(env("HOME") ?? ".", ".cache");
  return join(cache, "uffda");
}
