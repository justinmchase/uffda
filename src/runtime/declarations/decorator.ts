import type { Expression } from "../expressions/expression.ts";
import type { Pattern } from "../patterns/mod.ts";

/**
 * A `decorator Name<params> = expr;` declaration: a named, reusable callable
 * applied to a `rule`/`func` via `[Name arg…]` attribute syntax. Lives in its
 * own namespace, structurally identical to a `FuncDeclaration` otherwise
 * (cannot itself carry an `attributes` list). See
 * `.agents/specifications/languages/uffda-syntax/decorator-declarations.spec.md`
 * and `.agents/specifications/runtime/rule-metadata.spec.md`.
 */
export type DecoratorDeclaration = {
  name: string;
  pattern: Pattern;
  expression: Expression;
};
