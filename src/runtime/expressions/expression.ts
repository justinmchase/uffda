import { ExpressionKind } from "./expression.kind.ts";

export type ProjectionFunction = (
  // deno-lint-ignore no-explicit-any
  args: any,
  specials: Record<string, unknown>,
  // deno-lint-ignore no-explicit-any
) => any;

export function isExpression(value: unknown): value is Expression {
  if (value == null) return false;
  if (typeof value !== "object") return false;
  const p = value as Expression;
  return Reflect.has(ExpressionKind, p.kind);
}

export type Expression =
  | IAddExpression
  | INativeExpression
  | IReferenceExpression
  | ISpecialReferenceExpression
  | ISubtractExpression;

export interface IAddExpression {
  kind: ExpressionKind.Add;
  left: Expression;
  right: Expression;
}

export interface INativeExpression {
  kind: ExpressionKind.Native;
  fn: ProjectionFunction;
}

export interface IReferenceExpression {
  kind: ExpressionKind.Reference;
  name: string;
}

export interface ISpecialReferenceExpression {
  kind: ExpressionKind.SpecialReference;
  name: string;
}

export interface ISubtractExpression {
  kind: ExpressionKind.Subtract;
  left: Expression;
  right: Expression;
}
