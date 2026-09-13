import type { Expression } from "../expressions/expression.ts";

/**
 * Parsed, not-yet-invoked attribute application (`[Name arg…]`) on a
 * `rule`/`func` declaration. `name` resolves exclusively against `decorator`
 * declarations, never an ordinary `rule`/`func`. See
 * `.agents/specifications/runtime/rule-metadata.spec.md`.
 */
export type AttributeDeclaration = {
  name: string;
  args: Expression[];
};
