import type { Expression } from "../expressions/expression.ts";
import type { Module } from "./module.ts";

export type Func = {
  name: string;
  module: Module;
  parameters: FuncParameter[];
  expression: Expression;
};

export type FuncParameter = {
  name: string;
};

export function isFunc(value: unknown): value is Func {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === "string" &&
    Array.isArray(record.parameters) &&
    record.expression !== undefined &&
    !("pattern" in record);
}
