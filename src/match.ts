import type { Pattern } from "./runtime/patterns/pattern.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import type { Scope } from "./runtime/scope.ts";
import { type Span, spanFrom } from "./span.ts";
import { Type, type } from "@justinmchase/type";
import { StackFrameKind } from "./runtime/stack/stackFrameKind.ts";
import type { Module, Rule } from "./runtime/modules/mod.ts";
import type { Path } from "./path.ts";

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
    const scope = rightmostFailure.scope;

    // Get the actual value at the failure position
    let valueStr = "<no value>";
    if (scope.stream) {
      const next = scope.stream.next();
      if (next.done) {
        valueStr = "<end of input>";
      } else {
        valueStr = formatValue(next.value);
      }
    }

    output.push(`\n🔴 Parse failed at position: ${pos}\n`);
    output.push(`   Found: ${valueStr}\n`);
  }

  output.push("\n--- Match Stack ---\n");
  let module: Module | undefined;
  let rule: Rule | undefined;
  for (const m of rightmostFailure?.scope.stack ?? []) {
    if (m.kind === StackFrameKind.Module) {
      module = m.module;
    } else if (m.kind === StackFrameKind.Rule) {
      rule = m.rule;
      output.push(
        `  at ${rule.name}@${module?.moduleUrl ?? "[unknown module]"}\n`,
      );
    }
  }

  output.push("\n--- Match Tree ---\n");

  function visualizeMatch(
    m: Match,
    indent = 0,
    rule: Rule | undefined = undefined,
  ): Path {
    // Get pattern name/kind
    const prefix = "  ".repeat(indent);
    const patternName = getPatternName(m.pattern);
    let deepest = m.scope.stream.path;

    // Prevent infinite loops from circular references
    if (visited.has(m)) {
      output.push(`${prefix}➰ ${patternName} [circular reference]\n`);
      return deepest;
    }
    visited.add(m);

    switch (m.kind) {
      case MatchKind.Ok: {
        const valueStr = formatValue(m.value);
        output.push(
          `${prefix}✓ ${patternName} → ${valueStr}\n`,
        );
        break;
      }
      case MatchKind.Fail: {
        // Rules can be left recursive, don't visualize that here
        if (m.pattern === m.scope.rule?.pattern && m.scope.rule !== rule) {
          output.push(
            `${prefix}✗ ${m.scope.rule.name}\n`,
          );

          for (const child of m.matches) {
            if (child.scope.stream.path.compareTo(deepest) >= 0) {
              deepest = visualizeMatch(child, indent + 1, m.scope.rule);
            }
          }
        } else if (m === rightmostFailure) {
          // Show what value was found at the failure point
          let foundValue = "";
          const next = m.scope.stream.next();
          if (!next.done) {
            foundValue = ` (found: ${formatValue(next.value)})`;
          } else {
            foundValue = " (found: <end of input>)";
          }
          output.push(
            `${prefix.slice(0, -3)}👉 ✗ ${patternName}${foundValue}\n`,
          );
        } else {
          for (const child of m.matches) {
            if (child.scope.stream.path.compareTo(deepest) >= 0) {
              deepest = visualizeMatch(child, indent, m.scope.rule);
            }
          }
        }
        break;
      }
      case MatchKind.Error: {
        output.push(
          `${prefix}⚠ ${patternName}: ${m.code} - ${m.message}\n`,
        );
        break;
      }
      case MatchKind.LR: {
        output.push(
          `${prefix}↻ ${patternName} (left recursion)\n`,
        );
        break;
      }
    }

    return deepest;
  }

  visualizeMatch(match);

  return output.join("");
}

function getPatternName(pattern: Pattern): string {
  switch (pattern.kind) {
    case PatternKind.Reference:
      return pattern.name;
    case PatternKind.Pipeline:
      return `Pipeline`;
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
      return `Variable(${pattern.name}, ${getPatternName(pattern.pattern)})`;
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

  const [t, v] = type(value);
  switch (t) {
    case Type.Null:
      return "<null>";
    case Type.Undefined:
      return "<undefined>";
    case Type.Function:
      return `<function ${v.name ?? "anonymous"}>`;
    case Type.Error:
      return `<error ${v.message}>`;
    case Type.Map:
      return `<map>`;
    case Type.Set:
      return `<set>`;
    case Type.String:
      return JSON.stringify(v.length > 50 ? v.substring(0, 50) + "..." : v);
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
        return `[${arr.slice(0, 5).map(formatValue).join(", ")}, ... (${
          arr.length - 5
        } items)]`;
      }
      return `[${arr.map(formatValue).join(", ")}]`;
    }
    case Type.Object: {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) return "{}";
      if (keys.length > 3) {
        return `{${keys.slice(0, 10).join(", ")}, ... (${keys.length} keys)}`;
      }
      return JSON.stringify(value);
    }
    default:
      return String(value);
  }
}
