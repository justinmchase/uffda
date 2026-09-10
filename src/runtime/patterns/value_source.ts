import type { Serializable } from "@justinmchase/serializable";
import { error, MatchErrorCode } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { Pattern } from "./pattern.ts";

export enum ValueSourceKind {
  Literal = "value.literal",
  Variable = "value.variable",
}

export type LiteralValueSource = {
  kind: ValueSourceKind.Literal;
  value: Serializable;
};

export type VariableValueSource = {
  kind: ValueSourceKind.Variable;
  name: string;
};

/**
 * Deterministic value operand for equal / between / includes / quantifier bounds.
 * Always carries an explicit `kind`; never a bare serializable in new AST.
 */
export type ValueSource = LiteralValueSource | VariableValueSource;

export function lit(value: Serializable): LiteralValueSource {
  return { kind: ValueSourceKind.Literal, value };
}

export function varRef(name: string): VariableValueSource {
  return { kind: ValueSourceKind.Variable, name };
}

export function isValueSource(value: unknown): value is ValueSource {
  if (value == null || typeof value !== "object") return false;
  const source = value as { kind?: unknown; value?: unknown; name?: unknown };
  if (source.kind === ValueSourceKind.Literal) {
    return "value" in source;
  }
  if (source.kind === ValueSourceKind.Variable) {
    return typeof source.name === "string";
  }
  return false;
}

/**
 * Temporary bridge for ModuleDeclarations emitted by published CLIs that still
 * bake bare string/number/boolean/null operands. Objects are never inferred —
 * they must already be tagged ValueSource nodes.
 *
 * Remove after a published CLI emits tagged operands and language `.uff` are
 * recompiled with it (`compile:lang` = single `uffda compile` only).
 */
export function coerceValueOperand(value: unknown): ValueSource | undefined {
  if (isValueSource(value)) return value;
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return lit(value);
    case "undefined":
      return undefined;
    case "object":
      if (value === null) return lit(null);
      return undefined;
    default:
      return undefined;
  }
}

export type ResolvedValueSource =
  | { kind: "ok"; value: unknown }
  | { kind: "error"; match: Match };

/**
 * Resolve a value source against the current match scope.
 * Syntax/AST construction MUST choose the kind; this only interprets it.
 */
export function resolveValueSource(
  source: ValueSource,
  scope: Scope,
  pattern: Pattern,
): ResolvedValueSource {
  switch (source.kind) {
    case ValueSourceKind.Literal:
      return { kind: "ok", value: source.value };
    case ValueSourceKind.Variable: {
      if (!scope.variables.has(source.name)) {
        return {
          kind: "error",
          match: error(
            scope,
            pattern,
            MatchErrorCode.UnknownReference,
            `Unknown value reference $${source.name}`,
          ),
        };
      }
      return { kind: "ok", value: scope.variables.get(source.name) };
    }
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}

export function resolveValueOperand(
  operand: unknown,
  scope: Scope,
  pattern: Pattern,
): ResolvedValueSource {
  const source = coerceValueOperand(operand);
  if (source == null) {
    return {
      kind: "error",
      match: error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        "value operand must be a tagged ValueSource (value.literal | value.variable)",
      ),
    };
  }
  return resolveValueSource(source, scope, pattern);
}
