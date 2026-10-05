import { loadCommandProject, ProjectLoadKind } from "../project/load.ts";
import {
  EMPTY_IMPORT_MAP,
  type ImportMap,
} from "../runtime/resolvers/import_map.ts";
import {
  type ArtifactLayout,
  defaultArtifactLayout,
} from "../runtime/resolvers/artifact_path.ts";

export type CommandProject =
  | { ok: true; imports: ImportMap; artifacts: ArtifactLayout }
  | { ok: false; message: string };

/**
 * What a command takes from the project it uses (the project file
 * `configPath` names, else the one `start` is in): its import map and its
 * artifact layout (the project root and output directory). Without a project
 * there are no imports and the layout is `start` with its `./bin`. An invalid
 * project file is reported, every problem on its own line.
 */
export async function commandProject(
  start: string,
  configPath?: string,
): Promise<CommandProject> {
  const loaded = await loadCommandProject(start, configPath);
  switch (loaded.kind) {
    case ProjectLoadKind.Loaded: {
      const { imports, root, outDir } = loaded.project;
      return { ok: true, imports, artifacts: { root, outDir } };
    }
    case ProjectLoadKind.Missing:
      return {
        ok: true,
        imports: EMPTY_IMPORT_MAP,
        artifacts: defaultArtifactLayout(start),
      };
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
