import type { Expression } from "../expressions/expression.ts";
import type { Pattern } from "../patterns/mod.ts";
import type { Module } from "./module.ts";

/**
 * Runtime func. Arguments are matched with `pattern` (no Into); variables bound
 * by that match are available to `expression`.
 */
export type Func = {
  name: string;
  module: Module;
  pattern: Pattern;
  expression: Expression;
};

export function isFunc(value: unknown): value is Func {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === "string" &&
    record.pattern !== undefined &&
    record.expression !== undefined &&
    !("parameters" in record);
}
