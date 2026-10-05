import { loadCommandProject, ProjectLoadKind } from "../project/load.ts";
import {
  EMPTY_IMPORT_MAP,
  type ImportMap,
} from "../runtime/resolvers/import_map.ts";

export type ProjectImports =
  | { ok: true; imports: ImportMap }
  | { ok: false; message: string };

/**
 * The import map of the project a command uses (the project file
 * `configPath` names, else the one `start` is in): its `imports`, or none
 * without a project. An invalid project file is reported, every problem on
 * its own line.
 */
export async function projectImports(
  start: string,
  configPath?: string,
): Promise<ProjectImports> {
  const loaded = await loadCommandProject(start, configPath);
  switch (loaded.kind) {
    case ProjectLoadKind.Loaded:
      return { ok: true, imports: loaded.project.imports };
    case ProjectLoadKind.Missing:
      return { ok: true, imports: EMPTY_IMPORT_MAP };
    case ProjectLoadKind.Invalid:
      return {
        ok: false,
        message: loaded.problems
          .map(({ message }) => `${loaded.path}: ${message}`)
          .join("\n"),
      };
    default:
      throw new Error(`Unknown project load result: ${JSON.stringify(loaded)}`);
  }
}
