import { dirname, fromFileUrl, resolve } from "@std/path";
import { type ArtifactLayout, defaultArtifactLayout } from "./artifact_path.ts";

/**
 * Artifact layout the built-in `.uff` languages are read from.
 *
 * Published CLI binaries embed `./bin` via `deno compile --include`. In
 * standalone mode the layout's root is the binary extract root (not the
 * user's cwd) so included AST JSON is found. In-tree runs keep using
 * `Deno.cwd()`.
 */
export function languageArtifactLayout(
  fromImportMetaUrl: string,
): ArtifactLayout {
  if (Deno.build.standalone) {
    // fromImportMetaUrl is under `<extract>/src/...`; package root is the
    // directory that contains `src/` (e.g. `src/lang/grammar.ts` → extract root).
    const modulePath = fromFileUrl(fromImportMetaUrl);
    const idx = modulePath.lastIndexOf("/src/");
    const winIdx = modulePath.lastIndexOf("\\src\\");
    const cut = Math.max(idx, winIdx);
    const packageRoot = cut >= 0
      ? modulePath.slice(0, cut)
      : resolve(dirname(modulePath), "../..");
    return defaultArtifactLayout(packageRoot);
  }

  return defaultArtifactLayout(Deno.cwd());
}
