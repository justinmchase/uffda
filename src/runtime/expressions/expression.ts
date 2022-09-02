import { ExpressionKind } from "./expression.kind.ts";

export type ProjectionFunction = (
  // deno-lint-ignore no-explicit-any
  args: any,
  specials: Record<string, unknown>,
// deno-lint-ignore no-explicit-any
) => any;

export type Expression =
  | INativeExpression
  | ISpecialReferenceExpression;

export interface INativeExpression {
  kind: ExpressionKind.Native;
  fn: ProjectionFunction;
}

export interface ISpecialReferenceExpression {
  kind: ExpressionKind.SpecialReference;
  name: string;
}
