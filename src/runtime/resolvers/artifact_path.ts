import {
  extname,
  fromFileUrl,
  isAbsolute,
  join,
  relative,
  resolve,
  SEPARATOR,
} from "@std/path";

/** The output directory of a project that does not name one. */
export const DEFAULT_OUT_DIR = "./bin";

/**
 * Where compiled artifacts live (see
 * `.agents/specifications/languages/project-file.spec.md#output-directory`): a source
 * at `<root>/<path>.uff` compiles to
 * `<outDir>/ast/<path>.uffda.ast.json`.
 */
export type ArtifactLayout = {
  /**
   * Absolute path of the directory source paths are taken from: the project
   * root, or the working directory without a project.
   */
  root: string;
  /** Absolute path of the output directory. */
  outDir: string;
};

/** The layout of `root` with the default output directory. */
export function defaultArtifactLayout(root: string): ArtifactLayout {
  root = resolve(root);
  return { root, outDir: resolve(root, DEFAULT_OUT_DIR) };
}

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
 * Absolute path of the compiled artifact of a source file, or `undefined`
 * when the source is not inside the layout's root and so has none.
 */
export function artifactPathForSource(
  layout: ArtifactLayout,
  absoluteSourcePath: string,
): string | undefined {
  const rel = relative(layout.root, absoluteSourcePath);
  if (rel === "" || isAbsolute(rel) || rel.split(SEPARATOR)[0] === "..") {
    return undefined;
  }
  return join(
    layout.outDir,
    "ast",
    outputNameForSource(rel.replaceAll("\\", "/")),
  );
}

/** Absolute artifact path of a logical `.uff` module URL. */
export function artifactPathForUffUrl(
  layout: ArtifactLayout,
  moduleUrl: URL,
): string | undefined {
  return artifactPathForSource(layout, fromFileUrl(moduleUrl));
}
