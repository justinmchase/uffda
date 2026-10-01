import { dirname, isAbsolute, join } from "@std/path";
import { isClean, isSuccess, type Match, MatchKind } from "../match.ts";
import {
  analyzeMatchFailure,
  formatMatchFailureSummary,
} from "../match.visualize.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import {
  outputNameForSource,
  toStableSourcePath,
} from "../runtime/resolvers/artifact_path.ts";
import { compileUffdaSource } from "../lang/uffda/execute.ts";
import { CliLanguage } from "./contract.ts";
import {
  type CliStreamFailureLocation,
  parseFailureLocation,
  recoveryFailures,
} from "./stream.ts";
import {
  expandSourcePaths,
  type SourcePathFailure,
  SourcePathFailureCode,
} from "./source_paths.ts";
import { valueOf } from "../match.ts";

export enum CliCompileFailureCode {
  InvalidContext = "CLI_COMPILE_INVALID_CONTEXT",
  SourceNotFound = "CLI_COMPILE_SOURCE_NOT_FOUND",
  SourceNotReadable = "CLI_COMPILE_SOURCE_NOT_READABLE",
  OutputCollision = "CLI_COMPILE_OUTPUT_COLLISION",
  OutputExists = "CLI_COMPILE_OUTPUT_EXISTS",
  ParseFailure = "CLI_COMPILE_PARSE_FAILURE",
  /** Source the parse skipped by recovering; see error-recovery.spec.md. */
  Recovered = "CLI_COMPILE_PARSE_RECOVERED",
  WriteFailure = "CLI_COMPILE_WRITE_FAILURE",
}

export type CliCompileFailure = {
  code: CliCompileFailureCode;
  sourcePath: string;
  outputPath?: string;
  message: string;
  /** Source position of a `ParseFailure` or `Recovered` diagnostic. */
  location?: CliStreamFailureLocation;
};

export type CliCompileUnitSuccess = {
  sourcePath: string;
  outputPath: string;
  /** ModuleDeclaration written to the artifact. */
  module: ModuleDeclaration;
};

export type CliCompileUnitResult =
  | {
    ok: true;
    sourcePath: string;
    outputPath: string;
    module: ModuleDeclaration;
  }
  | {
    ok: false;
    sourcePath: string;
    outputPath?: string;
    /** The unit's failure, or the first recovery of a recovered parse. */
    failure: CliCompileFailure;
    /**
     * Every parse diagnostic of the unit, in document order: one per
     * recovery, then the parse failure when the parse failed.
     */
    diagnostics?: CliCompileFailure[];
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

async function parseFailureMessage(match: Match): Promise<string> {
  if (match.kind === MatchKind.Error) {
    return `${match.code}: ${match.message}`;
  }
  if (match.kind === MatchKind.Fail) {
    const analysis = await analyzeMatchFailure(match);
    if (analysis) return formatMatchFailureSummary(analysis);
    return "parse failed";
  }
  if (match.kind === MatchKind.LR) {
    return "parse failed with left recursion outcome";
  }
  return "unexpected parser outcome";
}

function toCompileFailure(failure: SourcePathFailure): CliCompileFailure {
  const { code, sourcePath, message } = failure;
  switch (code) {
    case SourcePathFailureCode.NotFound:
      return {
        code: CliCompileFailureCode.SourceNotFound,
        sourcePath,
        message,
      };
    case SourcePathFailureCode.NotReadable:
      return {
        code: CliCompileFailureCode.SourceNotReadable,
        sourcePath,
        message,
      };
  }
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
    ...expanded.failures.map(toCompileFailure),
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

    const compiled = await compileUffdaSource(sourceText);
    if (!isClean(compiled)) {
      const diagnostics: CliCompileFailure[] = (await recoveryFailures(
        compiled,
        CliLanguage.FullUffda,
        plan.sourcePath,
        sourceText,
      )).map(({ message, location }) => ({
        code: CliCompileFailureCode.Recovered,
        sourcePath: plan.sourcePath,
        outputPath: plan.outputPath,
        message,
        location,
      }));
      if (!isSuccess(compiled)) {
        diagnostics.push({
          code: CliCompileFailureCode.ParseFailure,
          sourcePath: plan.sourcePath,
          outputPath: plan.outputPath,
          message: await parseFailureMessage(compiled),
          location: await parseFailureLocation(compiled, sourceText),
        });
      }
      const failure = isSuccess(compiled)
        ? diagnostics[0]
        : diagnostics.at(-1)!;
      failures.push(...diagnostics);
      units.push({
        ok: false,
        sourcePath: plan.sourcePath,
        outputPath: plan.outputPath,
        failure,
        diagnostics,
      });
      continue;
    }
    const module = valueOf(compiled);

    try {
      await Deno.writeTextFile(
        plan.outputPath,
        `${JSON.stringify(module, null, 2)}\n`,
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
      module,
    };
    successes.push(success);
    units.push({
      ok: true,
      sourcePath: success.sourcePath,
      outputPath: success.outputPath,
      module: success.module,
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
