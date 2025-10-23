import { isPipeline, type Pattern } from "./runtime/patterns/pattern.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import type { Scope } from "./runtime/scope.ts";
import { type Span, spanFrom } from "./span.ts";
import { getType, Type } from "@justinmchase/type";

export enum MatchErrorCode {
  UnknownReference = "E_UNKNOWN_REFERENCE",
  UnknownParameter = "E_UNKNOWN_PARAMETER",
  PatternExpected = "E_PATTERN_EXPECTED",
  IterableExpected = "E_ITERABLE_EXPECTED",
  Type = "E_TYPE",
  NullValue = "E_NULL_VALUE",
  InvalidArgument = "E_INVALID_ARGUMENT",
  DuplicateVariable = "E_DUPLICATE_VARIABLE",
  IndirectLeftRecursion = "E_INDIRECT_LEFT_RECURSION",
}

export enum MatchKind {
  LR = "lr",
  Ok = "ok",
  Fail = "fail",
  Error = "error",
}

export type Match = MatchLR | MatchOk | MatchFail | MatchError;

export type MatchLR = {
  kind: MatchKind.LR;
  pattern: Pattern;
  scope: Scope;
};

export type MatchOk = {
  kind: MatchKind.Ok;
  pattern: Pattern;
  scope: Scope;
  span: Span;
  matches: Match[];
  value: unknown;
};

export type MatchFail = {
  kind: MatchKind.Fail;
  pattern: Pattern;
  scope: Scope;
  span: Span;
  matches: Match[];
};

export type MatchError = {
  kind: MatchKind.Error;
  pattern: Pattern;
  scope: Scope;
  span: Span;
  code: MatchErrorCode;
  message: string;
};

export function lr(scope: Scope, pattern: Pattern): MatchLR {
  return {
    kind: MatchKind.LR,
    pattern,
    scope,
  };
}

export function error(
  scope: Scope,
  pattern: Pattern,
  code: MatchErrorCode,
  message: string,
): MatchError {
  return {
    kind: MatchKind.Error,
    span: spanFrom(scope, scope),
    pattern,
    scope,
    code,
    message,
  };
}

export function ok(
  start: Scope,
  end: Scope,
  pattern: Pattern,
  value: unknown = undefined,
  matches: Match[] = [],
): MatchOk {
  return {
    kind: MatchKind.Ok,
    span: spanFrom(start, end),
    pattern,
    scope: end,
    value,
    matches,
  };
}

export function fail(
  scope: Scope,
  pattern: Pattern,
  matches: Match[] = [],
): MatchFail {
  return {
    kind: MatchKind.Fail,
    span: spanFrom(scope, scope),
    scope,
    pattern,
    matches,
  };
}

/**
 * Finds the "rightmost" failure in a MatchFail tree.
 * The rightmost failure is defined as the failure with the greatest start span.
 * This is useful for debugging match failures, as the rightmost failure typically
 * indicates where the problem occurred.
 *
 * @param match The MatchFail to search
 * @returns The rightmost MatchFail in the tree
 *
 * @example
 * ```ts
 * const result = match(pattern, scope);
 * if (result.kind === MatchKind.Fail) {
 *   const rightmost = getRightmostFailure(result);
 *   console.log(`Parse failed at position ${rightmost.span.start}`);
 * }
 * ```
 */
export function getRightmostFailure(match: MatchFail): MatchFail {
  let rightmost = match;

  // Recursively search through all child matches
  for (const child of match.matches) {
    if (child.kind === MatchKind.Fail) {
      // Recursively get the rightmost failure from this child
      const childRightmost = getRightmostFailure(child);

      // Compare start positions and keep the rightmost one
      if (childRightmost.span.start.compareTo(rightmost.span.start) > 0) {
        rightmost = childRightmost;
      }
    }
  }

  return rightmost;
}

/**
 * Visualizes a match failure in a human-readable format for debugging.
 * Displays hierarchical pattern structure, values matched/not matched,
 * pipeline steps, and source location information.
 *
 * @param match The Match to visualize (typically a MatchFail)
 * @returns A formatted string representation of the failure
 *
 * @example
 * ```ts
 * const result = match(pattern, scope);
 * if (result.kind === MatchKind.Fail) {
 *   console.log(visualizeMatchFailure(result));
 * }
 * ```
 */
export function visualizeMatchFailure(match: Match): string {
  const output: string[] = [];
  const visited = new WeakSet<Match>();

  output.push("=== Match Failure Visualization ===\n");

  // Get module and file information if available
  if (match.scope) {
    const moduleUrl = match.scope.module?.moduleUrl;
    if (moduleUrl) {
      output.push(`Module: ${moduleUrl}\n`);
    }
  }

  // Find and highlight the rightmost failure
  let rightmostFailure: MatchFail | undefined;
  if (match.kind === MatchKind.Fail) {
    rightmostFailure = getRightmostFailure(match);
    const pos = rightmostFailure.span.start.toString();
    output.push(`\n🔴 Parse failed at position: ${pos}\n`);
  }

  output.push("\n--- Match Tree ---\n");

  function visualizeMatch(m: Match, indent = 0, label = ""): void {
    // Prevent infinite loops from circular references
    if (visited.has(m)) {
      output.push(`${"  ".repeat(indent)}${label}[circular reference]\n`);
      return;
    }
    visited.add(m);

    const prefix = "  ".repeat(indent);
    const isRightmost = m === rightmostFailure;
    const marker = isRightmost ? "👉 " : "";

    // Get pattern name/kind
    const patternName = getPatternName(m.pattern);

    switch (m.kind) {
      case MatchKind.Ok: {
        const valueStr = formatValue(m.value);
        output.push(
          `${prefix}${marker}✓ ${label}${patternName} → ${valueStr}\n`,
        );
        // Don't drill into successful matches - only show failures
        break;
      }
      case MatchKind.Fail: {
        const pos = m.span.start.toString();
        output.push(
          `${prefix}${marker}✗ ${label}${patternName} @ ${pos}\n`,
        );
        if (m.matches.length > 0) {
          for (let i = 0; i < m.matches.length; i++) {
            const child = m.matches[i];
            const childLabel = isPipeline(m.pattern)
              ? `[step ${i}] `
              : `[${i}] `;
            visualizeMatch(child, indent + 1, childLabel);
          }
        }
        break;
      }
      case MatchKind.Error: {
        output.push(
          `${prefix}${marker}⚠ ${label}${patternName}: ${m.code} - ${m.message}\n`,
        );
        break;
      }
      case MatchKind.LR: {
        output.push(
          `${prefix}${marker}↻ ${label}${patternName} (left recursion)\n`,
        );
        break;
      }
    }
  }

  visualizeMatch(match);

  // Show input context around failure point
  if (rightmostFailure) {
    output.push("\n--- Input Context ---\n");
    const scope = rightmostFailure.scope;
    if (scope.stream) {
      const path = scope.stream.path;
      output.push(`Position: ${path.toString()}\n`);

      // Try to show the value at this position
      if (scope.stream.value !== undefined) {
        output.push(`Current value: ${formatValue(scope.stream.value)}\n`);
      } else if (!scope.stream.done) {
        output.push(`Current value: <no value>\n`);
      } else {
        output.push(`Current value: <end of input>\n`);
      }
    }
  }

  output.push("\n=== End Visualization ===");
  return output.join("");
}

function getPatternName(pattern: Pattern): string {
  switch (pattern.kind) {
    case PatternKind.Reference:
      return pattern.name;
    case PatternKind.Pipeline:
      return "Pipeline";
    case PatternKind.Then:
      return "Then";
    case PatternKind.Or:
      return "Or";
    case PatternKind.And:
      return "And";
    case PatternKind.Maybe:
      return "Maybe";
    case PatternKind.Slice:
      return "Slice";
    case PatternKind.Equal:
      return `Equal(${formatValue(pattern.value)})`;
    case PatternKind.Includes:
      return "Includes";
    case PatternKind.Range:
      return "Range";
    case PatternKind.RegExp:
      return `RegExp(/${pattern.pattern}/)`;
    case PatternKind.Type:
      return `Type(${pattern.type})`;
    case PatternKind.Variable:
      return `Variable(${pattern.name})`;
    case PatternKind.Run:
      return pattern.name ? `Run(${pattern.name})` : "Run";
    case PatternKind.Character:
      return `Character(${pattern.characterClass})`;
    case PatternKind.Special:
      return `Special(${pattern.name})`;
    case PatternKind.Into:
      return "Into";
    case PatternKind.Over:
      return "Over";
    case PatternKind.Not:
      return "Not";
    case PatternKind.Any:
      return "Any";
    case PatternKind.Ok:
      return "Ok";
    case PatternKind.Fail:
      return "Fail";
    case PatternKind.End:
      return "End";
    default:
      return "Unknown";
  }
}

function formatValue(value: unknown): string {
  if (value === undefined) return "<undefined>";
  if (value === null) return "<null>";

  const type = getType(value);

  switch (type) {
    case Type.String: {
      const str = value as string;
      return `"${str.length > 50 ? str.substring(0, 50) + "..." : str}"`;
    }
    case Type.Number:
    case Type.Boolean:
    case Type.BigInt:
      return String(value);
    case Type.Symbol:
      return (value as symbol).toString();
    case Type.Date:
      return (value as Date).toISOString();
    case Type.Array: {
      const arr = value as unknown[];
      if (arr.length === 0) return "[]";
      if (arr.length > 3) {
        return `[${
          arr.slice(0, 3).map(formatValue).join(", ")
        }, ... (${arr.length} items)]`;
      }
      return `[${arr.map(formatValue).join(", ")}]`;
    }
    case Type.Object: {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) return "{}";
      if (keys.length > 3) {
        return `{${keys.slice(0, 3).join(", ")}, ... (${keys.length} keys)}`;
      }
      return JSON.stringify(value);
    }
    default:
      return String(value);
  }
}
