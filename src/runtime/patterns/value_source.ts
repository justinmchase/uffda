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

export type ValueSource = LiteralValueSource | VariableValueSource;

/** Value operand: wrapped ValueSource or legacy bare serializable literal. */
export type ValueOperand = Serializable | ValueSource;

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

export type ResolvedValueSource =
  | { kind: "ok"; value: unknown }
  | { kind: "error"; match: Match };

/**
 * Resolve a value operand against the current match scope.
 * Bare serializable values (legacy hand-built AST) are treated as literals.
 */
export function resolveValueSource(
  source: ValueOperand,
  scope: Scope,
  pattern: Pattern,
): ResolvedValueSource {
  if (!isValueSource(source)) {
    return { kind: "ok", value: source };
  }
  if (source.kind === ValueSourceKind.Literal) {
    return { kind: "ok", value: source.value };
  }
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
