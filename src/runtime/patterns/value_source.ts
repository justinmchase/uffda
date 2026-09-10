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
 * Always carries an explicit `kind`; never a bare serializable.
 */
export type ValueSource = LiteralValueSource | VariableValueSource;

export function lit(value: Serializable): LiteralValueSource {
  return { kind: ValueSourceKind.Literal, value };
}

export function varRef(name: string): VariableValueSource {
  return { kind: ValueSourceKind.Variable, name };
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
