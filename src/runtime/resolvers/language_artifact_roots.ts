import { dirname, fromFileUrl, join, resolve } from "@std/path";
import { DEFAULT_ARTIFACT_ROOT } from "./artifact_path.ts";

/**
 * Working directory + artifact root used to remap logical `.uff` language URLs.
 *
 * Published CLI binaries embed `./bin` via `deno compile --include`. In
 * standalone mode, remapping must use the binary extract root (not the user's
 * cwd) so included AST JSON is found. In-tree runs keep using `Deno.cwd()`.
 */
export function languageArtifactRoots(fromImportMetaUrl: string): {
  cwd: string;
  artifactRoot: string;
} {
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
    return {
      cwd: packageRoot,
      artifactRoot: join(packageRoot, "bin"),
    };
  }

  const cwd = Deno.cwd();
  return {
    cwd,
    artifactRoot: resolve(cwd, DEFAULT_ARTIFACT_ROOT),
  };
}
