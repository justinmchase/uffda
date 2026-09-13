import type { DecoratorFunc } from "./decorator.ts";

/**
 * An applied attribute (`[Name arg…]`) on a `Rule`/`Func`, paired with its
 * evaluated call-site args and the resolved `DecoratorFunc` it invoked.
 * Presence is recorded unconditionally, independent of the invocation's
 * return value. See `.agents/specifications/runtime/rule-metadata.spec.md`.
 */
export type Attribute = {
  decorator: DecoratorFunc;
  args: unknown[];
};
