import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CliLanguage } from "./contract.ts";
import { InputNormalizationMode } from "../input.ts";
import {
  CliExecFailureCode,
  type CliExecResult,
  executeCliModule,
  isUffdaSyntaxModule,
} from "./exec.ts";
import {
  type CliMatchResult,
  isCliMatchFailure,
  matchCliPattern,
  parseCliMatchInput,
} from "./match.ts";
import { type CliStreamFailure, parseSourceToAst } from "./stream.ts";
import { isExpression } from "../runtime/expressions/mod.ts";
import { isPattern } from "../runtime/patterns/pattern.ts";
import { evaluateExpression } from "../runtime/evaluate_expression.ts";
import { Scope } from "../runtime/scope.ts";
import { globals } from "../runtime/runtime.ts";

/**
 * Stateless `uffda_experiment`: parse + optional in-memory match/eval for
 * authoring loops without sessions or artifact writes (see
 * `.agents/requirements/mcp-server/014-in-memory-experiment-tool.requirement.md`).
 */

const languageSchema = z.nativeEnum(CliLanguage).describe(
  "Grammar for `source`: 'pattern', 'expression', or 'uffda' (full module).",
);

export const experimentToolInputShape = {
  language: languageSchema,
  source: z.string().describe("Uffda snippet to parse and optionally run."),
  input: z.string().optional().describe(
    "A single sample subject (text, or JSON when inputIsJson is true). " +
      "Ignored when `inputs` is provided.",
  ),
  inputs: z.array(z.string()).optional().describe(
    "Independent sample subjects. Each is matched/run separately; results " +
      "are returned in the same order. Prefer this over repeating the tool.",
  ),
  inputIsJson: z.boolean().optional().describe(
    "When true, each sample is parsed as JSON (scalar subject). Defaults to " +
      "false (text / character iterable).",
  ),
  rule: z.string().optional().describe(
    "For language=uffda: exported rule to invoke. Defaults to the module's " +
      "first export.",
  ),
  variables: z.record(z.unknown()).optional().describe(
    "For language=expression: local bindings visible while evaluating.",
  ),
};
const experimentToolInputSchema = z.object(experimentToolInputShape);
export type ExperimentToolInput = z.infer<typeof experimentToolInputSchema>;

export enum ExperimentFailureCode {
  InvalidSource = "MCP_EXPERIMENT_INVALID_SOURCE",
  Unsupported = "MCP_EXPERIMENT_UNSUPPORTED",
}

export type ExperimentFailure = {
  code: ExperimentFailureCode | string;
  phase: "validate" | "parse" | "compile" | "input" | "match" | "execute";
  message: string;
  span?: unknown;
  inputSpan?: unknown;
};

export type ExperimentParseResult =
  | { ok: true; ast: unknown }
  | {
    ok: false;
    error: ExperimentFailure | CliStreamFailure;
    diagnostics?: unknown[];
  };

export type ExperimentRunResult = {
  /** Index into the normalized sample list (0-based). */
  index: number;
  /** The sample string as supplied. */
  input: string;
  inputIsJson: boolean;
  ok: boolean;
  value?: unknown;
  error?: ExperimentFailure | Record<string, unknown>;
  diagnostics?: unknown[];
};

export type ExperimentToolResult = {
  /**
   * True only when parse succeeded and every requested run succeeded.
   * Parse-only calls are ok when parse succeeds.
   */
  ok: boolean;
  language: CliLanguage;
  parse: ExperimentParseResult;
  /** Present when runs were attempted (inputs for pattern/uffda, or expression). */
  runs?: ExperimentRunResult[];
  /** Set when a run was requested but cannot be performed without disk writes. */
  unsupported?: ExperimentFailure;
};

function normalizeSamples(input: ExperimentToolInput): string[] {
  if (input.inputs !== undefined) return [...input.inputs];
  if (input.input !== undefined) return [input.input];
  return [];
}

function hasImportDeclarations(ast: unknown): boolean {
  if (!isUffdaSyntaxModule(ast)) return false;
  return ast.declarations.some((declaration) => declaration.kind === "import");
}

function runFromMatch(result: CliMatchResult): Omit<
  ExperimentRunResult,
  "index" | "input" | "inputIsJson"
> {
  if (result.ok) return { ok: true, value: result.value };
  return {
    ok: false,
    error: result.error as ExperimentFailure,
    ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
    ...(result.value !== undefined ? { value: result.value } : {}),
  };
}

function runFromExec(result: CliExecResult): Omit<
  ExperimentRunResult,
  "index" | "input" | "inputIsJson"
> {
  if (result.ok) return { ok: true, value: result.value };
  return {
    ok: false,
    error: result.error as ExperimentFailure,
    ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
    ...(result.value !== undefined ? { value: result.value } : {}),
  };
}

async function matchOne(
  patternAst: unknown,
  sample: string,
  inputIsJson: boolean,
  source: string,
): Promise<Omit<ExperimentRunResult, "index" | "input" | "inputIsJson">> {
  const parsedInput = parseCliMatchInput(sample, inputIsJson);
  if (!parsedInput.ok) {
    return { ok: false, error: parsedInput.error as ExperimentFailure };
  }
  try {
    return runFromMatch(
      await matchCliPattern(patternAst, parsedInput.value, inputIsJson, source),
    );
  } catch (error) {
    if (isCliMatchFailure(error)) {
      return { ok: false, error: error as ExperimentFailure };
    }
    throw error;
  }
}

async function runModuleOne(
  moduleAst: unknown,
  rule: string | undefined,
  sample: string,
  inputIsJson: boolean,
): Promise<Omit<ExperimentRunResult, "index" | "input" | "inputIsJson">> {
  const parsedInput = parseCliMatchInput(sample, inputIsJson);
  if (!parsedInput.ok) {
    return { ok: false, error: parsedInput.error as ExperimentFailure };
  }
  return runFromExec(
    await executeCliModule(moduleAst, rule, {
      input: parsedInput.value,
      inputKind: inputIsJson
        ? InputNormalizationMode.Scalar
        : InputNormalizationMode.Iterable,
    }),
  );
}

/**
 * Parses `source` and optionally matches/evaluates it in memory. Never writes
 * files or opens a session.
 */
export async function experimentToolHandler(
  input: ExperimentToolInput,
): Promise<ExperimentToolResult> {
  const source = input.source;
  if (source.trim().length === 0) {
    return {
      ok: false,
      language: input.language,
      parse: {
        ok: false,
        error: {
          code: ExperimentFailureCode.InvalidSource,
          phase: "validate",
          message: "source must be a non-empty Uffda snippet",
        },
      },
    };
  }

  const parsed = await parseSourceToAst(source, input.language);
  if (!parsed.ok) {
    return {
      ok: false,
      language: input.language,
      parse: {
        ok: false,
        error: parsed.error,
        ...(parsed.diagnostics ? { diagnostics: parsed.diagnostics } : {}),
      },
    };
  }

  const parseOk: ExperimentParseResult = { ok: true, ast: parsed.ast };
  const inputIsJson = input.inputIsJson ?? false;
  const samples = normalizeSamples(input);

  switch (input.language) {
    case CliLanguage.Pattern: {
      if (!isPattern(parsed.ast)) {
        return {
          ok: false,
          language: input.language,
          parse: {
            ok: false,
            error: {
              code: ExperimentFailureCode.InvalidSource,
              phase: "parse",
              message: "Expected a raw pattern AST",
            },
          },
        };
      }
      if (samples.length === 0) {
        return { ok: true, language: input.language, parse: parseOk };
      }
      const runs: ExperimentRunResult[] = [];
      for (let index = 0; index < samples.length; index++) {
        const sample = samples[index];
        const run = await matchOne(parsed.ast, sample, inputIsJson, source);
        runs.push({ index, input: sample, inputIsJson, ...run });
      }
      return {
        ok: runs.every((run) => run.ok),
        language: input.language,
        parse: parseOk,
        runs,
      };
    }

    case CliLanguage.Expression: {
      if (!isExpression(parsed.ast)) {
        return {
          ok: false,
          language: input.language,
          parse: {
            ok: false,
            error: {
              code: ExperimentFailureCode.InvalidSource,
              phase: "parse",
              message: "Expected a raw expression AST",
            },
          },
        };
      }
      // Expressions evaluate once via the public evaluator so `variables`
      // resolve as ordinary references (executeCliExpression wraps a rule
      // projection that does not surface outer locals).
      let run: Omit<ExperimentRunResult, "index" | "input" | "inputIsJson">;
      try {
        const value = await evaluateExpression(parsed.ast, {
          variables: input.variables,
          scope: Scope.Default().withOptions({
            globals: new Map([...globals, [
              "echo",
              (output: unknown) => output,
            ]]),
          }),
        });
        run = { ok: true, value };
      } catch (error) {
        const failure: ExperimentFailure = {
          code: CliExecFailureCode.ExecutionFailure,
          phase: "execute",
          message: error instanceof Error ? error.message : String(error),
        };
        run = { ok: false, error: failure, diagnostics: [failure] };
      }
      const runs: ExperimentRunResult[] = [{
        index: 0,
        input: "",
        inputIsJson: false,
        ...run,
      }];
      return {
        ok: run.ok,
        language: input.language,
        parse: parseOk,
        runs,
      };
    }

    case CliLanguage.FullUffda: {
      if (!isUffdaSyntaxModule(parsed.ast)) {
        return {
          ok: false,
          language: input.language,
          parse: {
            ok: false,
            error: {
              code: ExperimentFailureCode.InvalidSource,
              phase: "parse",
              message: "Expected a raw Uffda module AST",
            },
          },
        };
      }
      if (samples.length === 0) {
        return { ok: true, language: input.language, parse: parseOk };
      }
      if (hasImportDeclarations(parsed.ast)) {
        const unsupported: ExperimentFailure = {
          code: ExperimentFailureCode.Unsupported,
          phase: "compile",
          message:
            "uffda_experiment cannot run modules that import other files " +
            "without writing compiled artifacts. Use a self-contained module " +
            "(no import declarations), or uffda_session_load for project " +
            "modules.",
        };
        return {
          ok: false,
          language: input.language,
          parse: parseOk,
          unsupported,
        };
      }
      const runs: ExperimentRunResult[] = [];
      for (let index = 0; index < samples.length; index++) {
        const sample = samples[index];
        const run = await runModuleOne(
          parsed.ast,
          input.rule,
          sample,
          inputIsJson,
        );
        runs.push({ index, input: sample, inputIsJson, ...run });
      }
      return {
        ok: runs.every((run) => run.ok),
        language: input.language,
        parse: parseOk,
        runs,
      };
    }
  }
}

function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

export function experimentToolResult(
  value: ExperimentToolResult,
): CallToolResult {
  return jsonResult(value);
}
