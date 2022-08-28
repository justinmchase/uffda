import { ExpressionKind } from "./expression.kind.ts";

// deno-lint-ignore no-explicit-any
export type ProjectionFunction = (
  args: any,
  specials: Record<string, unknown>,
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
