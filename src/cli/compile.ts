import { dirname, isAbsolute, join, resolve } from "@std/path";
import { type Match, MatchKind } from "../match.ts";
import {
  uffdaGrammar,
  type UffdaSyntaxModule,
} from "../lang/uffda/uffda.lang.ts";
import {
  outputNameForSource,
  toStableSourcePath,
} from "../runtime/resolvers/artifact_path.ts";

export enum CliCompileFailureCode {
  InvalidContext = "CLI_COMPILE_INVALID_CONTEXT",
  SourceNotFound = "CLI_COMPILE_SOURCE_NOT_FOUND",
  SourceNotReadable = "CLI_COMPILE_SOURCE_NOT_READABLE",
  OutputCollision = "CLI_COMPILE_OUTPUT_COLLISION",
  OutputExists = "CLI_COMPILE_OUTPUT_EXISTS",
  ParseFailure = "CLI_COMPILE_PARSE_FAILURE",
  WriteFailure = "CLI_COMPILE_WRITE_FAILURE",
}

export type CliCompileFailure = {
  code: CliCompileFailureCode;
  sourcePath: string;
  outputPath?: string;
  message: string;
};

export type CliCompileUnitSuccess = {
  sourcePath: string;
  outputPath: string;
  ast: UffdaSyntaxModule;
};

export type CliCompileUnitResult =
  | {
    ok: true;
    sourcePath: string;
    outputPath: string;
    ast: UffdaSyntaxModule;
  }
  | {
    ok: false;
    sourcePath: string;
    outputPath?: string;
    failure: CliCompileFailure;
  };

export type CliCompileRequest = {
  cwd: string;
  sourcePaths: string[];
  outputDir: string;
  overwrite?: boolean;
};

export type CliCompileResult = {
  ok: boolean;
  units: CliCompileUnitResult[];
  successes: CliCompileUnitSuccess[];
  failures: CliCompileFailure[];
};

type PlannedSource = {
  absolutePath: string;
  sourcePath: string;
  outputPath: string;
};

function parseFailureMessage(match: Match): string {
  if (match.kind === MatchKind.Error) {
    return `${match.code}: ${match.message}`;
  }
  if (match.kind === MatchKind.Fail) {
    return `parse failed at ${match.span.start.toString()}`;
  }
  if (match.kind === MatchKind.LR) {
    return "parse failed with left recursion outcome";
  }
  return "unexpected parser outcome";
}

async function collectFiles(path: string): Promise<string[]> {
  const files: string[] = [];
  const entries: Deno.DirEntry[] = [];
  for await (const entry of Deno.readDir(path)) {
    entries.push(entry);
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const nextPath = join(path, entry.name);
    if (entry.isFile) {
      files.push(nextPath);
    } else if (entry.isDirectory) {
      files.push(...(await collectFiles(nextPath)));
    }
  }

  return files;
}

async function expandSourcePaths(
  cwd: string,
  sourcePaths: string[],
): Promise<{ files: string[]; failures: CliCompileFailure[] }> {
  const files: string[] = [];
  const failures: CliCompileFailure[] = [];

  const resolved = sourcePaths.map((sourcePath) =>
    isAbsolute(sourcePath) ? sourcePath : resolve(cwd, sourcePath)
  ).sort((a, b) => a.localeCompare(b));

  for (const absolutePath of resolved) {
    try {
      const stat = await Deno.stat(absolutePath);
      if (stat.isFile) {
        files.push(absolutePath);
      } else if (stat.isDirectory) {
        files.push(...(await collectFiles(absolutePath)));
      } else {
        failures.push({
          code: CliCompileFailureCode.SourceNotReadable,
          sourcePath: toStableSourcePath(cwd, absolutePath),
          message: `Source path is neither file nor directory: ${absolutePath}`,
        });
      }
    } catch (error) {
      failures.push({
        code: CliCompileFailureCode.SourceNotFound,
        sourcePath: toStableSourcePath(cwd, absolutePath),
        message: `Source path does not exist: ${absolutePath} (${error})`,
      });
    }
  }

  return {
    files: [...new Set(files)].sort((a, b) => a.localeCompare(b)),
    failures,
  };
}

function planOutputs(
  cwd: string,
  outputDir: string,
  files: string[],
): { plans: PlannedSource[]; failures: CliCompileFailure[] } {
  const failures: CliCompileFailure[] = [];
  const plans: PlannedSource[] = [];
  const seenOutputPaths = new Map<string, string>();

  for (const absolutePath of files) {
    const sourcePath = toStableSourcePath(cwd, absolutePath);
    const outputPath = join(outputDir, outputNameForSource(sourcePath));

    const collision = seenOutputPaths.get(outputPath);
    if (collision && collision !== sourcePath) {
      failures.push({
        code: CliCompileFailureCode.OutputCollision,
        sourcePath,
        outputPath,
        message:
          `Output collision at ${outputPath} between '${collision}' and '${sourcePath}'`,
      });
      continue;
    }

    seenOutputPaths.set(outputPath, sourcePath);
    plans.push({ absolutePath, sourcePath, outputPath });
  }

  return { plans, failures };
}

async function ensureWritableOutput(
  outputPath: string,
  overwrite: boolean,
): Promise<CliCompileFailure | undefined> {
  try {
    const stat = await Deno.stat(outputPath);
    if (stat.isFile && !overwrite) {
      return {
        code: CliCompileFailureCode.OutputExists,
        sourcePath: "",
        outputPath,
        message: `Output already exists and overwrite=false: ${outputPath}`,
      };
    }
  } catch {
    // Output does not exist yet.
  }

  try {
    await Deno.mkdir(dirname(outputPath), { recursive: true });
  } catch (error) {
    return {
      code: CliCompileFailureCode.WriteFailure,
      sourcePath: "",
      outputPath,
      message: `Unable to create output directory for ${outputPath}: ${error}`,
    };
  }

  return undefined;
}

export async function compileSourcesToAstArtifacts(
  request: CliCompileRequest,
): Promise<CliCompileResult> {
  const { cwd, outputDir, sourcePaths, overwrite = false } = request;

  if (!isAbsolute(cwd) || !isAbsolute(outputDir)) {
    const sourcePath = sourcePaths[0] ?? "";
    return {
      ok: false,
      units: [{
        ok: false,
        sourcePath,
        failure: {
          code: CliCompileFailureCode.InvalidContext,
          sourcePath,
          message: "cwd and outputDir must be absolute paths",
        },
      }],
      successes: [],
      failures: [{
        code: CliCompileFailureCode.InvalidContext,
        sourcePath,
        message: "cwd and outputDir must be absolute paths",
      }],
    };
  }

  const expanded = await expandSourcePaths(cwd, sourcePaths);
  const planned = planOutputs(cwd, outputDir, expanded.files);

  const units: CliCompileUnitResult[] = [];
  const failures: CliCompileFailure[] = [
    ...expanded.failures,
    ...planned.failures,
  ];
  const successes: CliCompileUnitSuccess[] = [];

  for (const failure of failures) {
    units.push({
      ok: false,
      sourcePath: failure.sourcePath,
      outputPath: failure.outputPath,
      failure,
    });
  }

  for (const plan of planned.plans) {
    const writeFailure = await ensureWritableOutput(plan.outputPath, overwrite);
    if (writeFailure) {
      const failure = {
        ...writeFailure,
        sourcePath: plan.sourcePath,
      };
      failures.push(failure);
      units.push({
        ok: false,
        sourcePath: plan.sourcePath,
        outputPath: plan.outputPath,
        failure,
      });
      continue;
    }

    let sourceText: string;
    try {
      sourceText = await Deno.readTextFile(plan.absolutePath);
    } catch (error) {
      const failure: CliCompileFailure = {
        code: CliCompileFailureCode.SourceNotReadable,
        sourcePath: plan.sourcePath,
        outputPath: plan.outputPath,
        message: `Unable to read source file ${plan.absolutePath}: ${error}`,
      };
      failures.push(failure);
      units.push({
        ok: false,
        sourcePath: plan.sourcePath,
        outputPath: plan.outputPath,
        failure,
      });
      continue;
    }

    const parsed = await uffdaGrammar(sourceText);
    if (parsed.kind !== MatchKind.Ok) {
      const failure: CliCompileFailure = {
        code: CliCompileFailureCode.ParseFailure,
        sourcePath: plan.sourcePath,
        outputPath: plan.outputPath,
        message: parseFailureMessage(parsed),
      };
      failures.push(failure);
      units.push({
        ok: false,
        sourcePath: plan.sourcePath,
        outputPath: plan.outputPath,
        failure,
      });
      continue;
    }

    try {
      await Deno.writeTextFile(
        plan.outputPath,
        `${JSON.stringify(parsed.value, null, 2)}\n`,
      );
    } catch (error) {
      const failure: CliCompileFailure = {
        code: CliCompileFailureCode.WriteFailure,
        sourcePath: plan.sourcePath,
        outputPath: plan.outputPath,
        message: `Unable to write artifact ${plan.outputPath}: ${error}`,
      };
      failures.push(failure);
      units.push({
        ok: false,
        sourcePath: plan.sourcePath,
        outputPath: plan.outputPath,
        failure,
      });
      continue;
    }

    const success: CliCompileUnitSuccess = {
      sourcePath: plan.sourcePath,
      outputPath: plan.outputPath,
      ast: parsed.value,
    };
    successes.push(success);
    units.push({
      ok: true,
      sourcePath: success.sourcePath,
      outputPath: success.outputPath,
      ast: success.ast,
    });
  }

  units.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  successes.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  failures.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

  return {
    ok: failures.length === 0,
    units,
    successes,
    failures,
  };
}
