/**
 * Stateless `uffda_experiment`: parse once, then run named cases in memory
 * with compact assertion feedback (see
 * `.agents/requirements/mcp-server/014-in-memory-experiment-tool.requirement.md`).
 */

import { Type, type } from "@justinmchase/type";
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CliLanguage } from "./contract.ts";
import { InputNormalizationMode } from "../input.ts";
import { unwrap } from "../wrapped.ts";
import {
  CliExecFailureCode,
  type CliExecResult,
  executeCliModule,
  isUffdaSyntaxModule,
} from "./exec.ts";
import {
  type CliMatchFailure,
  CliMatchFailureCode,
  isCliMatchFailure,
  parseCliMatchInput,
} from "./match.ts";
import { analyzeMatchFailure } from "./diagnostics.ts";
import { type CliStreamFailure, parseSourceToAst } from "./stream.ts";
import { isExpression } from "../runtime/expressions/mod.ts";
import { isPattern, type Pattern } from "../runtime/patterns/pattern.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import { evaluateExpression } from "../runtime/evaluate_expression.ts";
import { Scope } from "../runtime/scope.ts";
import { globals } from "../runtime/runtime.ts";
import {
  getRightmostFailure,
  isClean,
  isSuccess,
  type Match,
  MatchErrorCode,
  MatchKind,
  valueOf,
} from "../match.ts";
import { matchWithRecovery } from "../runtime/recovery.ts";
import { diagnoseRecoveries } from "./diagnostics.ts";

const languageSchema = z.nativeEnum(CliLanguage).describe(
  "Grammar for `source`: 'pattern', 'expression', or 'uffda' (full module).",
);

const caseSchema = z.object({
  name: z.string().describe("Stable case id used in failure reporting."),
  input: z.string().describe(
    "Subject for this case (text, or JSON text when inputIsJson is true).",
  ),
  inputIsJson: z.boolean().optional().describe(
    "When true, `input` is parsed as JSON (scalar subject). Defaults to the " +
      "request-level inputIsJson, else false (text / character iterable).",
  ),
  expect: z.unknown().optional().describe(
    "Expected JSON value after a successful match/eval. Mutually exclusive " +
      "with expectNonMatch.",
  ),
  expectNonMatch: z.boolean().optional().describe(
    "When true, the case passes only if the pattern/module does not match.",
  ),
}).describe("One named experiment case with optional assertion.");

export const experimentToolInputShape = {
  language: languageSchema,
  source: z.string().describe(
    "Uffda / pattern / expression snippet to parse and run in memory.",
  ),
  cases: z.array(caseSchema).optional().describe(
    "Named test cases. Prefer this for batch assertions. Each case runs " +
      "independently after a single parse/compile.",
  ),
  input: z.string().optional().describe(
    "Legacy single sample when `cases` is omitted. Prefer `cases`.",
  ),
  inputs: z.array(z.string()).optional().describe(
    "Legacy sample list when `cases` is omitted. Prefer `cases`.",
  ),
  inputIsJson: z.boolean().optional().describe(
    "Default text-vs-JSON flag for cases that omit their own inputIsJson, " +
      "and for legacy input/inputs.",
  ),
  rule: z.string().optional().describe(
    "For language=uffda: exported rule to invoke. Defaults to the module's " +
      "first export.",
  ),
  variables: z.record(z.unknown()).optional().describe(
    "For language=expression: local bindings visible while evaluating.",
  ),
  verbose: z.boolean().optional().describe(
    "When true, include bounded per-case diagnostics (still omits ASTs and " +
      "full match trees). Default false: compact summary + failures only.",
  ),
};
const experimentToolInputSchema = z.object(experimentToolInputShape);
export type ExperimentToolInput = z.infer<typeof experimentToolInputSchema>;
export type ExperimentCaseInput = z.infer<typeof caseSchema>;

export enum ExperimentFailureCode {
  InvalidSource = "MCP_EXPERIMENT_INVALID_SOURCE",
  Unsupported = "MCP_EXPERIMENT_UNSUPPORTED",
  Assertion = "MCP_EXPERIMENT_ASSERTION",
  InvalidCase = "MCP_EXPERIMENT_INVALID_CASE",
}

export type ExperimentFailureKind =
  | "assertion"
  | "match"
  | "runtime"
  | "input"
  | "unsupported"
  | "validate"
  | "parse";

export type ExperimentFailureDetail = {
  kind: ExperimentFailureKind;
  code: string;
  phase: string;
  message: string;
  /** Case name when the failure is per-case. */
  case?: string;
  span?: unknown;
  inputPosition?: string;
  actual?: unknown;
  actualType?: string;
  expected?: unknown;
  expectedType?: string;
  pattern?: string;
  rules?: string[];
  hint?: string;
};

export type ExperimentCaseResult = {
  name: string;
  ok: boolean;
  kind?: ExperimentFailureKind;
  /** Present on success when verbose, or when needed to show assertion actuals. */
  value?: unknown;
  error?: ExperimentFailureDetail;
};

export type ExperimentSummary = {
  total: number;
  passed: number;
  failed: number;
  parseOk: boolean;
};

export type ExperimentToolResult = {
  ok: boolean;
  language: CliLanguage;
  summary: ExperimentSummary;
  /** Present only when parse/compile failed. */
  parseError?: ExperimentFailureDetail | CliStreamFailure;
  parseDiagnostics?: unknown[];
  /** Compact failure list (default). Successful cases omitted. */
  failures?: ExperimentCaseResult[];
  /** When verbose: every case outcome. */
  cases?: ExperimentCaseResult[];
  unsupported?: ExperimentFailureDetail;
};

type NormalizedCase = {
  name: string;
  input: string;
  inputIsJson: boolean;
  expect?: unknown;
  hasExpect: boolean;
  expectNonMatch: boolean;
};

function describeType(value: unknown): string {
  return type(unwrap(value))[0];
}

/**
 * JSON-facing clone. `undefined` is omitted from objects (absent key) and
 * becomes `null` inside arrays — the same distinction `JSON.stringify` uses,
 * with `actualType` / `expectedType` carrying Type.Undefined vs Type.Null.
 */
export function serializeExperimentValue(value: unknown): unknown {
  const [t, v] = type(unwrap(value));
  switch (t) {
    case Type.Undefined:
      return undefined;
    case Type.Null:
    case Type.Boolean:
    case Type.Number:
    case Type.String:
      return v;
    case Type.Array:
      return (v as unknown[]).map((child) => {
        const serialized = serializeExperimentValue(child);
        return serialized === undefined ? null : serialized;
      });
    case Type.Object: {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(v as Record<string, unknown>)) {
        const serialized = serializeExperimentValue(child);
        if (serialized !== undefined) out[key] = serialized;
      }
      return out;
    }
    default:
      return String(v);
  }
}

function withOptionalValue<T extends Record<string, unknown>>(
  base: T,
  key: "value" | "actual" | "expected",
  value: unknown,
): T {
  const serialized = serializeExperimentValue(value);
  if (serialized === undefined) return base;
  return { ...base, [key]: serialized };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  const [ta, va] = type(a);
  const [tb, vb] = type(b);
  if (ta !== tb) return false;
  switch (ta) {
    case Type.Array: {
      const left = va as unknown[];
      const right = vb as unknown[];
      if (left.length !== right.length) return false;
      for (let i = 0; i < left.length; i++) {
        if (!valuesEqual(left[i], right[i])) return false;
      }
      return true;
    }
    case Type.Object: {
      const left = va as Record<string, unknown>;
      const right = vb as Record<string, unknown>;
      const aKeys = Object.keys(left).sort();
      const bKeys = Object.keys(right).sort();
      if (aKeys.length !== bKeys.length) return false;
      for (let i = 0; i < aKeys.length; i++) {
        if (aKeys[i] !== bKeys[i]) return false;
        if (!valuesEqual(left[aKeys[i]], right[bKeys[i]])) return false;
      }
      return true;
    }
    default:
      return false;
  }
}

function normalizeCases(input: ExperimentToolInput): NormalizedCase[] {
  const defaultJson = input.inputIsJson ?? false;
  if (input.cases !== undefined) {
    return input.cases.map((c, index) => {
      const hasExpect = Object.prototype.hasOwnProperty.call(c, "expect");
      return {
        name: c.name.trim() || `case-${index}`,
        input: c.input,
        inputIsJson: c.inputIsJson ?? defaultJson,
        ...(hasExpect ? { expect: c.expect } : {}),
        hasExpect,
        expectNonMatch: c.expectNonMatch === true,
      };
    });
  }
  if (input.inputs !== undefined) {
    return input.inputs.map((sample, index) => ({
      name: `input-${index}`,
      input: sample,
      inputIsJson: defaultJson,
      hasExpect: false,
      expectNonMatch: false,
    }));
  }
  if (input.input !== undefined) {
    return [{
      name: "input-0",
      input: input.input,
      inputIsJson: defaultJson,
      hasExpect: false,
      expectNonMatch: false,
    }];
  }
  return [];
}

function hasImportDeclarations(ast: unknown): boolean {
  if (!isUffdaSyntaxModule(ast)) return false;
  return ast.declarations.some((declaration) => declaration.kind === "import");
}

function childrenOf(match: Match): Match[] {
  if (isSuccess(match) || match.kind === MatchKind.Fail) return match.matches;
  return [];
}

function pipelineStageHint(match: Match): string | undefined {
  if (match.kind === MatchKind.Error) {
    if (match.code === MatchErrorCode.IterableExpected) {
      return "Pipeline stages receive a single scalar item. Wrap the next " +
        "stage in `[Pattern]` (`into`) when that item is an array/string you " +
        "intend to match element-wise.";
    }
    return undefined;
  }
  let sawPipeline = false;
  let sawIntoError = false;
  let scalarIntoCharLike = false;
  const walk = (m: Match): void => {
    if (m.pattern.kind === PatternKind.Pipeline) sawPipeline = true;
    if (
      m.kind === MatchKind.Error &&
      m.code === MatchErrorCode.IterableExpected
    ) {
      sawIntoError = true;
    }
    if (m.kind === MatchKind.Fail) {
      const kind = m.pattern.kind;
      if (
        kind === PatternKind.Equal ||
        kind === PatternKind.Type ||
        kind === PatternKind.Character ||
        kind === PatternKind.Between ||
        kind === PatternKind.Any
      ) {
        // Fail under a pipeline without into often means a whole array/string
        // was offered as one scalar to a character-oriented matcher.
        if (sawPipeline) scalarIntoCharLike = true;
      }
    }
    for (const child of childrenOf(m)) walk(child);
  };
  walk(match);
  if (sawIntoError) {
    return "The current pipeline item was not iterable. Use `[Pattern]` " +
      "(`into`) only on array/string/iterable values; otherwise keep matching " +
      "the scalar item directly.";
  }
  if (sawPipeline && scalarIntoCharLike) {
    return "A pipeline stage feeds one scalar item into the next pattern. " +
      "If the previous stage produced an array or string and the next stage " +
      "expects characters/items, wrap it in `[Pattern]` (`into`).";
  }
  return undefined;
}

async function enrichMatchFailure(
  match: Match,
  source: string | undefined,
  base: CliMatchFailure,
): Promise<ExperimentFailureDetail> {
  const analysis = await analyzeMatchFailure(match);
  const hint = pipelineStageHint(match);
  let actual: unknown = undefined;
  let actualType: string | undefined;
  let atEnd = false;
  if (match.kind === MatchKind.Fail) {
    const rightmost = getRightmostFailure(match);
    const done = await rightmost.scope.stream.done();
    if (done) {
      atEnd = true;
      actualType = "end-of-input";
    } else {
      const stepped = await rightmost.scope.stream.step();
      if (stepped) {
        actual = stepped.value;
        actualType = describeType(stepped.value);
      }
    }
  } else if (match.kind === MatchKind.Error) {
    actualType = match.code;
  }

  const detail: ExperimentFailureDetail = {
    kind: "match",
    code: base.code,
    phase: base.phase,
    message: base.message,
    ...(base.inputPosition ? { inputPosition: base.inputPosition } : {}),
    ...(analysis
      ? {
        pattern: analysis.pattern,
        rules: analysis.rules.slice(0, 8),
        expected: analysis.expected.slice(0, 12),
        ...(analysis.location ? { span: analysis.location } : {}),
      }
      : {}),
    ...(actualType ? { actualType } : {}),
    ...(atEnd ? {} : {}),
    ...(hint ? { hint } : {}),
    ...(source !== undefined && base.sourceOffset !== undefined
      ? { span: { sourceOffset: base.sourceOffset } }
      : {}),
  };
  return atEnd || actual === undefined
    ? detail
    : withOptionalValue(detail, "actual", actual);
}

async function matchFailureDetail(
  result: Match,
  source?: string,
): Promise<{ base: CliMatchFailure; detail: ExperimentFailureDetail }> {
  let base: CliMatchFailure;
  switch (result.kind) {
    case MatchKind.Error:
      base = {
        code: CliMatchFailureCode.MatchFailure,
        phase: "match",
        message: `${result.code}: ${result.message}`,
      };
      break;
    case MatchKind.Fail: {
      const rightmost = getRightmostFailure(result);
      base = {
        code: CliMatchFailureCode.MatchFailure,
        phase: "match",
        message:
          `Pattern '${rightmost.pattern.kind}' did not match input at ${rightmost.span.start.toString()}`,
        inputPosition: rightmost.span.start.toString(),
        inputDescription: await rightmost.scope.stream.done()
          ? "end of input"
          : "a value that did not match",
        source,
      };
      break;
    }
    case MatchKind.LR:
      base = {
        code: CliMatchFailureCode.MatchFailure,
        phase: "match",
        message: "match failed with left recursion outcome",
      };
      break;
    default:
      throw new Error("Expected match failure");
  }
  return { base, detail: await enrichMatchFailure(result, source, base) };
}

async function runPatternCase(
  patternAst: Pattern,
  sample: NormalizedCase,
  source: string,
): Promise<ExperimentCaseResult> {
  const parsedInput = parseCliMatchInput(sample.input, sample.inputIsJson);
  if (!parsedInput.ok) {
    return {
      name: sample.name,
      ok: false,
      kind: "input",
      error: {
        kind: "input",
        code: parsedInput.error.code,
        phase: parsedInput.error.phase,
        message: parsedInput.error.message,
        case: sample.name,
      },
    };
  }

  const match = await matchWithRecovery(
    patternAst,
    Scope.From(parsedInput.value, {
      kind: sample.inputIsJson
        ? InputNormalizationMode.Scalar
        : InputNormalizationMode.Iterable,
    }),
  );

  if (isClean(match)) {
    const value = valueOf(match);
    return assertCase(sample, true, value);
  }

  if (isSuccess(match)) {
    // Recovered success counts as match failure for experiment asserts.
    const recoveries = await diagnoseRecoveries(match);
    const first = recoveries[0];
    if (sample.expectNonMatch) {
      return { name: sample.name, ok: true };
    }
    return {
      name: sample.name,
      ok: false,
      kind: "match",
      value: valueOf(match),
      error: {
        kind: "match",
        code: CliMatchFailureCode.Recovered,
        phase: "match",
        message: first?.message ?? "match succeeded only by recovering",
        case: sample.name,
      },
    };
  }

  const { detail } = await matchFailureDetail(match, source);
  if (sample.expectNonMatch) {
    return { name: sample.name, ok: true };
  }
  return {
    name: sample.name,
    ok: false,
    kind: "match",
    error: { ...detail, case: sample.name },
  };
}

function assertCase(
  sample: NormalizedCase,
  matched: boolean,
  value: unknown,
): ExperimentCaseResult {
  if (sample.expectNonMatch) {
    if (!matched) return { name: sample.name, ok: true };
    return withOptionalValue(
      {
        name: sample.name,
        ok: false,
        kind: "assertion" as const,
        error: withOptionalValue(
          {
            kind: "assertion" as const,
            code: ExperimentFailureCode.Assertion,
            phase: "match",
            message:
              `expected non-match for case '${sample.name}', but matched`,
            case: sample.name,
            expectedType: "non-match",
            actualType: describeType(value),
          },
          "actual",
          value,
        ),
      },
      "value",
      value,
    );
  }
  if (!sample.hasExpect) {
    return withOptionalValue(
      {
        name: sample.name,
        ok: true,
      },
      "value",
      value,
    );
  }
  if (!valuesEqual(value, sample.expect)) {
    return withOptionalValue(
      {
        name: sample.name,
        ok: false,
        kind: "assertion" as const,
        error: withOptionalValue(
          withOptionalValue(
            {
              kind: "assertion" as const,
              code: ExperimentFailureCode.Assertion,
              phase: "match",
              message: `assertion failed for case '${sample.name}'`,
              case: sample.name,
              expectedType: describeType(sample.expect),
              actualType: describeType(value),
            },
            "expected",
            sample.expect,
          ),
          "actual",
          value,
        ),
      },
      "value",
      value,
    );
  }
  return withOptionalValue(
    {
      name: sample.name,
      ok: true,
    },
    "value",
    value,
  );
}

function runFromExec(
  sample: NormalizedCase,
  result: CliExecResult,
): ExperimentCaseResult {
  if (result.ok) {
    return assertCase(sample, true, result.value);
  }
  if (sample.expectNonMatch) {
    return { name: sample.name, ok: true };
  }
  const err = result.error as {
    code?: string;
    phase?: string;
    message?: string;
  };
  const phase = err.phase ?? "execute";
  const kind: ExperimentFailureKind = phase === "input"
    ? "input"
    : phase === "match"
    ? "match"
    : "runtime";
  return {
    name: sample.name,
    ok: false,
    kind,
    error: withOptionalValue(
      {
        kind,
        code: err.code ?? CliExecFailureCode.ExecutionFailure,
        phase,
        message: err.message ?? "execution failed",
        case: sample.name,
      },
      "actual",
      result.value,
    ),
  };
}

async function runModuleCase(
  moduleAst: unknown,
  rule: string | undefined,
  sample: NormalizedCase,
): Promise<ExperimentCaseResult> {
  const parsedInput = parseCliMatchInput(sample.input, sample.inputIsJson);
  if (!parsedInput.ok) {
    return {
      name: sample.name,
      ok: false,
      kind: "input",
      error: {
        kind: "input",
        code: parsedInput.error.code,
        phase: parsedInput.error.phase,
        message: parsedInput.error.message,
        case: sample.name,
      },
    };
  }
  try {
    const result = await executeCliModule(moduleAst, rule, {
      input: parsedInput.value,
      inputKind: sample.inputIsJson
        ? InputNormalizationMode.Scalar
        : InputNormalizationMode.Iterable,
    });
    return runFromExec(sample, result);
  } catch (error) {
    if (isCliMatchFailure(error)) {
      return {
        name: sample.name,
        ok: false,
        kind: "match",
        error: {
          kind: "match",
          code: error.code,
          phase: error.phase,
          message: error.message,
          case: sample.name,
        },
      };
    }
    return {
      name: sample.name,
      ok: false,
      kind: "runtime",
      error: {
        kind: "runtime",
        code: CliExecFailureCode.ExecutionFailure,
        phase: "execute",
        message: error instanceof Error ? error.message : String(error),
        case: sample.name,
      },
    };
  }
}

function validateCases(
  cases: NormalizedCase[],
): ExperimentFailureDetail | undefined {
  for (const c of cases) {
    if (c.hasExpect && c.expectNonMatch) {
      return {
        kind: "validate",
        code: ExperimentFailureCode.InvalidCase,
        phase: "validate",
        message: `case '${c.name}' cannot set both expect and expectNonMatch`,
        case: c.name,
      };
    }
  }
  return undefined;
}

function compactResult(
  language: CliLanguage,
  summary: ExperimentSummary,
  caseResults: ExperimentCaseResult[],
  verbose: boolean,
  extras: {
    parseError?: ExperimentFailureDetail | CliStreamFailure;
    parseDiagnostics?: unknown[];
    unsupported?: ExperimentFailureDetail;
  } = {},
): ExperimentToolResult {
  const failures = caseResults.filter((c) => !c.ok).map((c) => {
    // Compact: omit successful-match values on non-assertion failures.
    if (c.error?.kind === "assertion") return c;
    const { value: _value, ...rest } = c;
    return rest;
  });
  return {
    ok: summary.parseOk && summary.failed === 0 && !extras.unsupported &&
      !extras.parseError,
    language,
    summary,
    ...(extras.parseError ? { parseError: extras.parseError } : {}),
    ...(extras.parseDiagnostics
      ? { parseDiagnostics: extras.parseDiagnostics }
      : {}),
    ...(extras.unsupported ? { unsupported: extras.unsupported } : {}),
    ...(failures.length > 0 ? { failures } : {}),
    ...(verbose ? { cases: caseResults } : {}),
  };
}

/**
 * Parses `source` once and runs named cases in memory. Never writes files or
 * opens a persistent session.
 */
export async function experimentToolHandler(
  input: ExperimentToolInput,
): Promise<ExperimentToolResult> {
  const verbose = input.verbose === true;
  const source = input.source;
  if (source.trim().length === 0) {
    const parseError: ExperimentFailureDetail = {
      kind: "validate",
      code: ExperimentFailureCode.InvalidSource,
      phase: "validate",
      message: "source must be a non-empty Uffda snippet",
    };
    return compactResult(
      input.language,
      {
        total: 0,
        passed: 0,
        failed: 0,
        parseOk: false,
      },
      [],
      verbose,
      { parseError },
    );
  }

  const cases = normalizeCases(input);
  const caseError = validateCases(cases);
  if (caseError) {
    return compactResult(
      input.language,
      {
        total: 0,
        passed: 0,
        failed: 0,
        parseOk: false,
      },
      [],
      verbose,
      { parseError: caseError },
    );
  }

  const parsed = await parseSourceToAst(source, input.language);
  if (!parsed.ok) {
    const err = parsed.error as {
      code?: string;
      phase?: string;
      message?: string;
    };
    return compactResult(
      input.language,
      {
        total: cases.length,
        passed: 0,
        failed: 0,
        parseOk: false,
      },
      [],
      verbose,
      {
        parseError: {
          kind: "parse",
          code: String(err.code ?? "CLI_PARSE_FAILURE"),
          phase: err.phase ?? "parse",
          message: err.message ?? "parse failed",
        },
        ...(parsed.diagnostics ? { parseDiagnostics: parsed.diagnostics } : {}),
      },
    );
  }

  switch (input.language) {
    case CliLanguage.Pattern: {
      if (!isPattern(parsed.ast)) {
        return compactResult(
          input.language,
          {
            total: 0,
            passed: 0,
            failed: 0,
            parseOk: false,
          },
          [],
          verbose,
          {
            parseError: {
              kind: "parse",
              code: ExperimentFailureCode.InvalidSource,
              phase: "parse",
              message: "Expected a raw pattern AST",
            },
          },
        );
      }
      if (cases.length === 0) {
        return compactResult(
          input.language,
          {
            total: 0,
            passed: 0,
            failed: 0,
            parseOk: true,
          },
          [],
          verbose,
        );
      }
      const caseResults: ExperimentCaseResult[] = [];
      for (const sample of cases) {
        caseResults.push(
          await runPatternCase(parsed.ast, sample, source),
        );
      }
      const passed = caseResults.filter((c) => c.ok).length;
      return compactResult(
        input.language,
        {
          total: caseResults.length,
          passed,
          failed: caseResults.length - passed,
          parseOk: true,
        },
        caseResults,
        verbose,
      );
    }

    case CliLanguage.Expression: {
      if (!isExpression(parsed.ast)) {
        return compactResult(
          input.language,
          {
            total: 0,
            passed: 0,
            failed: 0,
            parseOk: false,
          },
          [],
          verbose,
          {
            parseError: {
              kind: "parse",
              code: ExperimentFailureCode.InvalidSource,
              phase: "parse",
              message: "Expected a raw expression AST",
            },
          },
        );
      }
      let caseResult: ExperimentCaseResult;
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
        const sample: NormalizedCase = cases[0] ?? {
          name: "expression",
          input: "",
          inputIsJson: false,
          hasExpect: false,
          expectNonMatch: false,
        };
        // Expression path: if caller supplied cases with expects, assert;
        // otherwise treat as a single eval.
        if (cases.length === 0) {
          caseResult = withOptionalValue(
            {
              name: "expression",
              ok: true,
            },
            "value",
            value,
          );
        } else if (cases.length === 1) {
          caseResult = assertCase(sample, true, value);
        } else {
          caseResult = {
            name: "expression",
            ok: false,
            kind: "unsupported",
            error: {
              kind: "unsupported",
              code: ExperimentFailureCode.Unsupported,
              phase: "execute",
              message:
                "language=expression evaluates once; supply at most one case",
            },
          };
        }
      } catch (error) {
        caseResult = {
          name: cases[0]?.name ?? "expression",
          ok: false,
          kind: "runtime",
          error: {
            kind: "runtime",
            code: CliExecFailureCode.ExecutionFailure,
            phase: "execute",
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
      const passed = caseResult.ok ? 1 : 0;
      return compactResult(
        input.language,
        {
          total: 1,
          passed,
          failed: 1 - passed,
          parseOk: true,
        },
        [caseResult],
        verbose,
      );
    }

    case CliLanguage.FullUffda: {
      if (!isUffdaSyntaxModule(parsed.ast)) {
        return compactResult(
          input.language,
          {
            total: 0,
            passed: 0,
            failed: 0,
            parseOk: false,
          },
          [],
          verbose,
          {
            parseError: {
              kind: "parse",
              code: ExperimentFailureCode.InvalidSource,
              phase: "parse",
              message: "Expected a raw Uffda module AST",
            },
          },
        );
      }
      if (cases.length === 0) {
        return compactResult(
          input.language,
          {
            total: 0,
            passed: 0,
            failed: 0,
            parseOk: true,
          },
          [],
          verbose,
        );
      }
      if (hasImportDeclarations(parsed.ast)) {
        const unsupported: ExperimentFailureDetail = {
          kind: "unsupported",
          code: ExperimentFailureCode.Unsupported,
          phase: "compile",
          message:
            "uffda_experiment cannot run modules that import other files " +
            "without writing compiled artifacts. Use a self-contained module " +
            "(no import declarations), or uffda_session_load for project " +
            "modules.",
        };
        return compactResult(
          input.language,
          {
            total: cases.length,
            passed: 0,
            failed: 0,
            parseOk: true,
          },
          [],
          verbose,
          { unsupported },
        );
      }
      const caseResults: ExperimentCaseResult[] = [];
      for (const sample of cases) {
        caseResults.push(
          await runModuleCase(parsed.ast, input.rule, sample),
        );
      }
      const passed = caseResults.filter((c) => c.ok).length;
      return compactResult(
        input.language,
        {
          total: caseResults.length,
          passed,
          failed: caseResults.length - passed,
          parseOk: true,
        },
        caseResults,
        verbose,
      );
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
