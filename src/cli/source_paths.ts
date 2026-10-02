import { expandGlob } from "@std/fs/expand-glob";
import { isAbsolute, resolve } from "@std/path";
import { isGlob } from "@std/path/is-glob";
import { toStableSourcePath } from "../runtime/resolvers/artifact_path.ts";

export enum SourcePathFailureCode {
  NotFound = "notFound",
  NotReadable = "notReadable",
}

export type SourcePathFailure = {
  code: SourcePathFailureCode;
  /** The path or glob as given, or its cwd-relative form for a file path. */
  sourcePath: string;
  message: string;
};

export type ExpandedSourcePaths = {
  /** Absolute file paths, deduplicated and sorted. */
  files: string[];
  /** The files named by a path rather than matched by a glob. */
  explicit: Set<string>;
  failures: SourcePathFailure[];
};

async function expandGlobPattern(
  cwd: string,
  pattern: string,
  exclude: string[],
): Promise<string[]> {
  const files: string[] = [];
  for await (
    const entry of expandGlob(pattern, {
      root: cwd,
      includeDirs: false,
      exclude,
    })
  ) {
    if (entry.isFile) {
      files.push(entry.path);
    }
  }
  return files;
}

/**
 * Expands command-line file paths and globs relative to `cwd`. A glob that
 * matches nothing, a missing path, or a path that is not a file is a failure.
 * Globs never descend into a directory matching an `exclude` glob.
 */
export async function expandSourcePaths(
  cwd: string,
  sourcePaths: string[],
  exclude: string[] = [],
): Promise<ExpandedSourcePaths> {
  const files: string[] = [];
  const explicit = new Set<string>();
  const failures: SourcePathFailure[] = [];

  for (const sourcePath of sourcePaths) {
    if (isGlob(sourcePath)) {
      const matched = await expandGlobPattern(cwd, sourcePath, exclude);
      if (matched.length === 0) {
        failures.push({
          code: SourcePathFailureCode.NotFound,
          sourcePath,
          message: `Glob matched no files: ${sourcePath}`,
        });
        continue;
      }
      files.push(...matched);
      continue;
    }

    const absolutePath = isAbsolute(sourcePath)
      ? sourcePath
      : resolve(cwd, sourcePath);
    try {
      const stat = await Deno.stat(absolutePath);
      if (stat.isFile) {
        files.push(absolutePath);
        explicit.add(absolutePath);
      } else if (stat.isDirectory) {
        failures.push({
          code: SourcePathFailureCode.NotReadable,
          sourcePath: toStableSourcePath(cwd, absolutePath),
          message:
            `Directories are not supported as inputs; use a glob pattern (for example '${
              sourcePath.replace(/\/$/, "")
            }/**/*.uff')`,
        });
      } else {
        failures.push({
          code: SourcePathFailureCode.NotReadable,
          sourcePath: toStableSourcePath(cwd, absolutePath),
          message: `Source path is not a file: ${absolutePath}`,
        });
      }
    } catch (error) {
      failures.push({
        code: SourcePathFailureCode.NotFound,
        sourcePath: toStableSourcePath(cwd, absolutePath),
        message: `Source path does not exist: ${absolutePath} (${error})`,
      });
    }
  }

  return {
    files: [...new Set(files)].sort((a, b) => a.localeCompare(b)),
    explicit,
    failures,
  };
}
