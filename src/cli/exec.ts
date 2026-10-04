import {
  compileUffdaSyntaxModule,
  type UffdaSyntaxModule,
} from "../lang/uffda/uffda.lang.ts";
import {
  isClean,
  isSuccess,
  type Match,
  MatchKind,
  type SourceSpan,
} from "../match.ts";
import { diagnoseRecoveries } from "./diagnostics.ts";
import { executeModuleDeclaration } from "../runtime/module.execute.ts";
import { type Expression, isExpression } from "../runtime/expressions/mod.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import { globals } from "../runtime/runtime.ts";
import { isAbsolute, join, toFileUrl } from "@std/path";
import { valueOf } from "../match.ts";

export enum CliExecFailureCode {
  InvalidJson = "CLI_EXEC_INVALID_JSON",
  UnsupportedAst = "CLI_EXEC_UNSUPPORTED_AST",
  CompilationFailure = "CLI_EXEC_COMPILATION_FAILURE",
  ExecutionFailure = "CLI_EXEC_EXECUTION_FAILURE",
  /** Input the execution skipped by recovering; see error-recovery.spec.md. */
  Recovered = "CLI_EXEC_RECOVERED",
}

export type CliExecFailure = {
  code: CliExecFailureCode;
  phase: "parse" | "compile" | "execute";
  message: string;
  /** Source offsets of the input a recovery skipped. */
  span?: SourceSpan;
};

export type CliExecResult =
  | { ok: true; value: unknown }
  | {
    ok: false;
    /** The failure, or the first recovery of a recovered execution. */
    error: CliExecFailure;
    /**
     * Every diagnostic of an execution that ran, in document order: one per
     * recovery, then the execution failure when it failed.
     */
    diagnostics?: CliExecFailure[];
    /** The value of an execution that succeeded only by recovering. */
    value?: unknown;
  };

export type CliAstParseResult =
  | { ok: true; ast: unknown }
  | { ok: false; error: CliExecFailure };

export function isUffdaSyntaxModule(
  value: unknown,
): value is UffdaSyntaxModule {
  return value != null && typeof value === "object" &&
    (value as { kind?: unknown }).kind === "module" &&
    Array.isArray((value as { declarations?: unknown }).declarations);
}

function expressionModule(expression: Expression): UffdaSyntaxModule {
  return {
    kind: "module",
    declarations: [
      { kind: "export", name: "Main" },
      {
        kind: "rule",
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Ok },
        projection: expression,
        attributes: [],
      },
    ],
  };
}

function defaultEntryRuleName(
  syntaxModule: UffdaSyntaxModule,
): string | undefined {
  return syntaxModule.declarations.find((declaration) =>
    declaration.kind === "export"
  )?.name;
}

function executionFailure(match: Match): CliExecFailure {
  switch (match.kind) {
    case MatchKind.Error:
      return {
        code: CliExecFailureCode.ExecutionFailure,
        phase: "execute",
        message: `${match.code}: ${match.message}`,
      };
    case MatchKind.Fail:
      return {
        code: CliExecFailureCode.ExecutionFailure,
        phase: "execute",
        message: `execution failed at ${match.span.start.toString()}`,
      };
    case MatchKind.LR:
      return {
        code: CliExecFailureCode.ExecutionFailure,
        phase: "execute",
        message: "execution failed with left recursion outcome",
      };
    case MatchKind.Ok:
    case MatchKind.Skip:
      throw new Error("Expected execution failure");
  }
}

async function executionResult(execution: Match): Promise<CliExecResult> {
  if (isClean(execution)) {
    return { ok: true, value: valueOf(execution) };
  }
  const recoveries: CliExecFailure[] = (await diagnoseRecoveries(execution))
    .map(({ span, message }) => ({
      code: CliExecFailureCode.Recovered,
      phase: "execute",
      message,
      span,
    }));
  if (isSuccess(execution)) {
    return {
      ok: false,
      error: recoveries[0],
      diagnostics: recoveries,
      value: valueOf(execution),
    };
  }
  const failure = executionFailure(execution);
  return { ok: false, error: failure, diagnostics: [...recoveries, failure] };
}

export type CliExecOptions = {
  cwd?: string;
  artifactRoot?: string;
  /** Logical module URL for relative import resolution. */
  moduleUrl?: URL;
};

/**
 * Where CLI module/expression source came from. Used to pick a stable module
 * URL for relative `import "./foo.uff"` resolution.
 *
 * - `file`: real absolute source path (relative imports resolve next to it)
 * - `stdin` / `eval`: ephemeral sources with no directory; relative imports
 *   resolve against `cwd` via a distinct synthetic file URL under that cwd
 */
export type CliModuleOrigin =
  | { kind: "file"; absolutePath: string }
  | { kind: "stdin" }
  | { kind: "eval" };

/**
 * Map a CLI source origin to the module URL used for relative imports.
 */
export function moduleUrlForCliOrigin(
  cwd: string,
  origin: CliModuleOrigin,
): URL {
  switch (origin.kind) {
    case "file": {
      if (!isAbsolute(origin.absolutePath)) {
        throw new TypeError(
          `CliModuleOrigin.file requires an absolute path, got: ${origin.absolutePath}`,
        );
      }
      return toFileUrl(origin.absolutePath);
    }
    case "stdin":
      // No source directory; cwd is the only meaningful import base.
      return toFileUrl(join(cwd, "__stdin__.uff"));
    case "eval":
      return toFileUrl(join(cwd, "__eval__.uff"));
  }
}

export async function executeCliAst(
  value: unknown,
  options?: CliExecOptions,
): Promise<CliExecResult> {
  const syntaxModule = isUffdaSyntaxModule(value)
    ? value
    : isExpression(value)
    ? expressionModule(value)
    : undefined;
  if (!syntaxModule) {
    return {
      ok: false,
      error: {
        code: CliExecFailureCode.UnsupportedAst,
        phase: "parse",
        message: "Expected a raw Uffda module or expression AST",
      },
    };
  }

  let declaration;
  try {
    declaration = await compileUffdaSyntaxModule(syntaxModule);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: CliExecFailureCode.CompilationFailure,
        phase: "compile",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const execution = await executeModuleDeclaration(declaration, {
    entryRuleName: defaultEntryRuleName(syntaxModule),
    moduleUrl: options?.moduleUrl,
    cwd: options?.cwd,
    artifactRoot: options?.artifactRoot,
    scopeOptions: {
      globals: new Map([...globals, ["echo", (output: unknown) => output]]),
    },
  });
  return await executionResult(execution);
}

export async function executeCliExpression(
  value: unknown,
  options?: CliExecOptions,
): Promise<CliExecResult> {
  if (!isExpression(value)) {
    return {
      ok: false,
      error: {
        code: CliExecFailureCode.UnsupportedAst,
        phase: "parse",
        message: "Expected a raw expression AST",
      },
    };
  }
  return await executeCliAst(value, options);
}

export async function executeCliModule(
  value: unknown,
  entryRuleName?: string,
  options?: CliExecOptions,
): Promise<CliExecResult> {
  if (!isUffdaSyntaxModule(value)) {
    return {
      ok: false,
      error: {
        code: CliExecFailureCode.UnsupportedAst,
        phase: "parse",
        message: "Expected a raw Uffda module AST",
      },
    };
  }

  let declaration;
  try {
    declaration = await compileUffdaSyntaxModule(value);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: CliExecFailureCode.CompilationFailure,
        phase: "compile",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const execution = await executeModuleDeclaration(declaration, {
    entryRuleName: entryRuleName ?? defaultEntryRuleName(value),
    moduleUrl: options?.moduleUrl,
    cwd: options?.cwd,
    artifactRoot: options?.artifactRoot,
    scopeOptions: {
      globals: new Map([...globals, ["echo", (output: unknown) => output]]),
    },
  });
  return await executionResult(execution);
}

export function parseCliAst(source: string): CliAstParseResult {
  try {
    return { ok: true, ast: JSON.parse(source) };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: CliExecFailureCode.InvalidJson,
        phase: "parse",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
