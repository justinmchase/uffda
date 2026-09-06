import {
  extname,
  fromFileUrl,
  join,
  relative,
  resolve,
  toFileUrl,
} from "@std/path";

/** Default product artifact root for self-hosting / bootstrap layouts. */
export const DEFAULT_ARTIFACT_ROOT = "./bin";

/**
 * Cwd-relative, forward-slash path used for deterministic artifact placement.
 */
export function toStableSourcePath(cwd: string, absolutePath: string): string {
  const rel = relative(cwd, absolutePath);
  return rel === "" ? "." : rel.replaceAll("\\", "/");
}

/**
 * Maps a stable source path to its syntax-AST artifact basename under `ast/`.
 * Example: `src/foo.uff` → `src/foo.uffda.ast.json`
 */
export function outputNameForSource(sourcePath: string): string {
  const ext = extname(sourcePath);
  return ext === ""
    ? `${sourcePath}.uffda.ast.json`
    : `${sourcePath.slice(0, -ext.length)}.uffda.ast.json`;
}

/**
 * Absolute filesystem path for the compiled AST artifact of a source file.
 * Layout: `<artifactRoot>/ast/<stable-source-without-ext>.uffda.ast.json`
 */
export function astArtifactPathForSource(
  cwd: string,
  artifactRoot: string,
  absoluteSourcePath: string,
): string {
  const stable = toStableSourcePath(cwd, absoluteSourcePath);
  return join(resolve(cwd, artifactRoot), "ast", outputNameForSource(stable));
}

/**
 * Absolute artifact path for a logical `.uff` module URL.
 */
export function astArtifactPathForUffUrl(
  cwd: string,
  artifactRoot: string,
  moduleUrl: URL,
): string {
  return astArtifactPathForSource(cwd, artifactRoot, fromFileUrl(moduleUrl));
}

/**
 * File URL for the compiled AST artifact of a logical `.uff` module URL.
 */
export function astArtifactUrlForUffUrl(
  cwd: string,
  artifactRoot: string,
  moduleUrl: URL,
): URL {
  return toFileUrl(astArtifactPathForUffUrl(cwd, artifactRoot, moduleUrl));
}
