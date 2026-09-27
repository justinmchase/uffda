import type { Expression } from "../expressions/expression.ts";
import type { Pattern } from "../patterns/mod.ts";
import type { AttributeDeclaration } from "./attribute.ts";

/**
 * A `decorator Name<params> = expr;` declaration: a named, reusable callable
 * applied to a `rule`/`func` via `[Name arg…]` attribute syntax. Lives in its
 * own namespace, structurally identical to a `FuncDeclaration` otherwise
 * (including its own `attributes` list). See
 * `.agents/specifications/languages/uffda-syntax/decorator-declarations.spec.md`
 * and `.agents/specifications/runtime/rule-metadata.spec.md`.
 */
export type DecoratorDeclaration = {
  name: string;
  pattern: Pattern;
  expression: Expression;
  /** Written left to right; older artifacts MAY omit (treat as []). */
  attributes?: AttributeDeclaration[];
};
