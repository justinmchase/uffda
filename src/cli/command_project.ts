import { join } from "@std/path";
import { loadCommandProject, ProjectLoadKind } from "../project/load.ts";
import type { UffdaProject } from "../project/project.ts";
import {
  EMPTY_IMPORT_MAP,
  type ImportMap,
} from "../runtime/resolvers/import_map.ts";
import {
  type ArtifactLayout,
  defaultArtifactLayout,
} from "../runtime/resolvers/artifact_path.ts";
import type { IPackageResolver } from "../runtime/resolvers/resolver.ts";
import { JsrPackages } from "../packages/jsr_packages.ts";
import { Lockfile, LOCKFILE_NAME } from "../packages/lockfile.ts";

/**
 * The packages a project's `jsr:` imports load from, through the lockfile
 * beside its project file (see `project-file.spec.md#lockfile`). Without a
 * project, versions chosen are not recorded.
 */
export async function projectPackages(
  project?: Pick<UffdaProject, "root">,
): Promise<
  { ok: true; packages: JsrPackages } | { ok: false; message: string }
> {
  if (!project) return { ok: true, packages: new JsrPackages() };
  const lockfile = await Lockfile.load(join(project.root, LOCKFILE_NAME));
  return lockfile.ok
    ? { ok: true, packages: new JsrPackages({ lockfile: lockfile.lockfile }) }
    : lockfile;
}

export type CommandProject =
  | {
    ok: true;
    imports: ImportMap;
    artifacts: ArtifactLayout;
    packages: IPackageResolver;
  }
  | { ok: false; message: string };

/**
 * What a command takes from the project it uses (the project file
 * `configPath` names, else the one `start` is in): its import map, its
 * artifact layout (the project root and output directory), and the packages
 * its `jsr:` imports load from, through its lockfile. Without a project there
 * are no imports, the layout is `start` with its `./bin`, and versions chosen
 * are not recorded. An invalid project file or lockfile is reported, every
 * problem on its own line.
 */
export async function commandProject(
  start: string,
  configPath?: string,
): Promise<CommandProject> {
  const loaded = await loadCommandProject(start, configPath);
  switch (loaded.kind) {
    case ProjectLoadKind.Loaded: {
      const { imports, root, outDir } = loaded.project;
      const packages = await projectPackages(loaded.project);
      if (!packages.ok) return packages;
      return {
        ok: true,
        imports,
        artifacts: { root, outDir },
        packages: packages.packages,
      };
    }
    case ProjectLoadKind.Missing:
      return {
        ok: true,
        imports: EMPTY_IMPORT_MAP,
        artifacts: defaultArtifactLayout(start),
        packages: new JsrPackages(),
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
