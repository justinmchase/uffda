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

/**
 * URL of the compiled artifact of a `.uff` module addressed by URL, under
 * `packageRoot`'s output directory, or `undefined` when `moduleUrl` is not
 * under `packageRoot`.
 *
 * Mirrors {@link artifactPathForUffUrl} but over URLs rather than filesystem
 * paths, so a package's `.uff` modules load wherever the package lives: a
 * `file:` checkout or compiled-binary extract root, or an `https:` package a
 * consumer imports over the network. uffda loads its own built-in languages
 * this way, and any DSL built on uffda can load its published grammar the same
 * way (see https://github.com/justinmchase/uffda/issues/271).
 *
 * `outDir` is the package-relative output directory artifacts were compiled to
 * (a project's `uffda.jsonc` `outDir`), defaulting to {@link DEFAULT_OUT_DIR}.
 */
export function packageArtifactUrl(
  packageRoot: URL,
  moduleUrl: URL,
  outDir: string = DEFAULT_OUT_DIR,
): URL | undefined {
  const root = packageRoot.href.endsWith("/")
    ? packageRoot.href
    : `${packageRoot.href}/`;
  if (!moduleUrl.href.startsWith(root)) return undefined;
  const rel = moduleUrl.href.slice(root.length);
  if (rel === "") return undefined;
  const out = outDir.replace(/^\.?\//, "").replace(/\/$/, "");
  return new URL(`${out}/ast/${outputNameForSource(rel)}`, root);
}
