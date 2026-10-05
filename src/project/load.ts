import { dirname, join, resolve } from "@std/path";
import {
  parseProject,
  PROJECT_FILE_NAME,
  type ProjectProblem,
  ProjectProblemCode,
  type UffdaProject,
} from "./project.ts";

export enum ProjectLoadKind {
  /** The project file was found and is valid. */
  Loaded = "loaded",
  /** No directory from the start upward holds a project file. */
  Missing = "missing",
  /** The project file was found but cannot be used. */
  Invalid = "invalid",
}

export type ProjectLoadResult =
  | { kind: ProjectLoadKind.Loaded; project: UffdaProject }
  | { kind: ProjectLoadKind.Missing }
  | { kind: ProjectLoadKind.Invalid; path: string; problems: ProjectProblem[] };

async function isFile(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isFile;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

/**
 * The project file of the project `start` is in: the nearest directory from
 * `start` upward holding one, or `undefined` when none does.
 */
export async function findProjectFile(
  start: string,
): Promise<string | undefined> {
  let directory = resolve(start);
  while (true) {
    const path = join(directory, PROJECT_FILE_NAME);
    if (await isFile(path)) return path;
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

/** Finds and reads the project `start` is in. */
export async function loadProject(start: string): Promise<ProjectLoadResult> {
  const path = await findProjectFile(start);
  if (!path) return { kind: ProjectLoadKind.Missing };
  return await loadProjectFile(path);
}

/**
 * Reads the project file at `path`, named explicitly (for example by
 * `--config`), so a missing file is a problem rather than no project.
 */
export async function loadProjectFile(
  path: string,
): Promise<ProjectLoadResult> {
  path = resolve(path);
  let text: string;
  try {
    text = await Deno.readTextFile(path);
  } catch (error) {
    return {
      kind: ProjectLoadKind.Invalid,
      path,
      problems: [{
        code: ProjectProblemCode.ReadFailure,
        message: error instanceof Error ? error.message : String(error),
      }],
    };
  }
  const parsed = await parseProject(text, path);
  return parsed.ok
    ? { kind: ProjectLoadKind.Loaded, project: parsed.project }
    : { kind: ProjectLoadKind.Invalid, path, problems: parsed.problems };
}

/**
 * The project a command uses: the project file `configPath` names (from
 * `--config`) when given, otherwise the project `start` is in.
 */
export async function loadCommandProject(
  start: string,
  configPath?: string,
): Promise<ProjectLoadResult> {
  return configPath === undefined
    ? await loadProject(start)
    : await loadProjectFile(configPath);
}
