import type { Expression } from "../expressions/expression.ts";
import type { Pattern } from "../patterns/mod.ts";
import type { Module } from "./module.ts";

/**
 * Runtime decorator func, materialized from a `decorator Name<params> =
 * expr;` declaration. Stored in `Module.decorators`/`Module.decoratorImports`
 * — a namespace fully separate from `Module.funcs`/`Module.imports`, so a
 * decorator can never be invoked as an ordinary callable and an ordinary func
 * can never be applied as a decorator. See
 * `.agents/specifications/runtime/rule-metadata.spec.md`.
 */
export type DecoratorFunc = {
  name: string;
  module: Module;
  pattern: Pattern;
  expression: Expression;
};
