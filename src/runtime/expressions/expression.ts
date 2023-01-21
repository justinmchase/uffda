import { SpecialType } from "../../mod.ts";
import { Serializable } from "../hash.ts";
import { Pattern } from "../patterns/pattern.ts";
import { ExpressionKind } from "./expression.kind.ts";

export type ProjectionFunction = (
  // deno-lint-ignore no-explicit-any
  args: any,
  specials: Map<string, SpecialType>,
  // deno-lint-ignore no-explicit-any
) => any;

export enum BinaryOperation {
  Add = "add",
  Subtract = "subtract",
  Multiply = "multiply",
  Divide = "divide",
  Mod = "mod",
}

export function isExpression(value: unknown): value is Expression {
  if (value == null) return false;
  if (typeof value !== "object") return false;
  const p = value as Expression;
  return Reflect.has(ExpressionKind, p.kind);
}

export type Expression =
  | IArrayExpression
  | IBinaryExpression
  | IBooleanExpression
  | IInvocationExpression
  | ILambdaExpression
  | IMemberExpression
  | INativeExpression
  | INumberExpression
  | IObjectExpression
  | IReferenceExpression
  | ISpecialReferenceExpression
  | IStringExpression
  | IUndefinedExpression
  | IValueExpression
  ;

export type ArrayInitializer =
  | IArrayElementExpression
  | IArraySpreadExpression;

export interface IArrayExpression {
  kind: ExpressionKind.Array;
  expressions: ArrayInitializer[];
}

export interface IArrayElementExpression {
  kind: ExpressionKind.ArrayElement;
  expression: Expression;
}

export interface IArraySpreadExpression {
  kind: ExpressionKind.ArraySpread;
  expression: Expression;
}

export interface IBinaryExpression {
  kind: ExpressionKind.Binary;
  op: BinaryOperation;
  left: Expression;
  right: Expression;
}

export interface IBooleanExpression {
  kind: ExpressionKind.Boolean;
  value: boolean;
}

export interface IInvocationExpression {
  kind: ExpressionKind.Invocation;
  expression: Expression;
  args: Expression[];
}

export interface ILambdaExpression {
  kind: ExpressionKind.Lambda;
  pattern: Pattern;
  expression: Expression;
}

export interface IMemberExpression {
  kind: ExpressionKind.Member;
  name: string;
  expression: Expression;
}

export interface INativeExpression {
  kind: ExpressionKind.Native;
  fn: ProjectionFunction;
}

export type ObjectInitializer =
  | IObjectKeyExpression
  | IObjectSpreadExpression;

export interface IObjectExpression {
  kind: ExpressionKind.Object;
  keys: ObjectInitializer[];
}

export interface IObjectSpreadExpression {
  kind: ExpressionKind.ObjectSpread;
  expression: Expression;
}

export interface IObjectKeyExpression {
  kind: ExpressionKind.ObjectKey;
  name: string;
  expression: Expression;
}

export interface IReferenceExpression {
  kind: ExpressionKind.Reference;
  name: string;
}

export interface ISpecialReferenceExpression {
  kind: ExpressionKind.Special;
  name: string;
}

export interface IStringExpression {
  kind: ExpressionKind.String;
  value: string;
}

export interface INumberExpression {
  kind: ExpressionKind.Number;
  value: number
}

export interface IUndefinedExpression {
  kind: ExpressionKind.Undefined;
}

export interface IValueExpression {
  kind: ExpressionKind.Value;
  value: Serializable;
}
