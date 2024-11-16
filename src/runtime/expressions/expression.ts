import { ExpressionKind } from "./expression.kind.ts";
import type { Pattern } from "../patterns/pattern.ts";
import type { Serializable } from "@justinmchase/serializable";
import type { Special } from "../modules/mod.ts";

export type ProjectionFunction = (
  // deno-lint-ignore no-explicit-any
  args: any,
  specials: Map<string, Special>,
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
  | ArrayExpression
  | BinaryExpression
  | BooleanExpression
  | InvocationExpression
  | LambdaExpression
  | MemberExpression
  | NativeExpression
  | NumberExpression
  | ObjectExpression
  | ReferenceExpression
  | SpecialReferenceExpression
  | StringExpression
  | UndefinedExpression
  | ValueExpression;

export type ArrayInitializer =
  | ArrayElementExpression
  | ArraySpreadExpression;

export type ArrayExpression = {
  kind: ExpressionKind.Array;
  expressions: ArrayInitializer[];
};

export type ArrayElementExpression = {
  kind: ExpressionKind.ArrayElement;
  expression: Expression;
};

export type ArraySpreadExpression = {
  kind: ExpressionKind.ArraySpread;
  expression: Expression;
};

export type BinaryExpression = {
  kind: ExpressionKind.Binary;
  op: BinaryOperation;
  left: Expression;
  right: Expression;
};

export type BooleanExpression = {
  kind: ExpressionKind.Boolean;
  value: boolean;
};

export type InvocationExpression = {
  kind: ExpressionKind.Invocation;
  expression: Expression;
  args: Expression[];
};

export type LambdaExpression = {
  kind: ExpressionKind.Lambda;
  pattern: Pattern;
  expression: Expression;
};

export type MemberExpression = {
  kind: ExpressionKind.Member;
  name: string;
  expression: Expression;
};

export type NativeExpression = {
  kind: ExpressionKind.Native;
  fn: ProjectionFunction;
};

export type ObjectInitializer =
  | ObjectKeyExpression
  | ObjectSpreadExpression;

export type ObjectExpression = {
  kind: ExpressionKind.Object;
  keys: ObjectInitializer[];
};

export type ObjectSpreadExpression = {
  kind: ExpressionKind.ObjectSpread;
  expression: Expression;
};

export type ObjectKeyExpression = {
  kind: ExpressionKind.ObjectKey;
  name: string;
  expression: Expression;
};

export type ReferenceExpression = {
  kind: ExpressionKind.Reference;
  name: string;
};

export type SpecialReferenceExpression = {
  kind: ExpressionKind.Special;
  name: string;
};

export type StringExpression = {
  kind: ExpressionKind.String;
  value: string;
};

export type NumberExpression = {
  kind: ExpressionKind.Number;
  value: number;
};

export type UndefinedExpression = {
  kind: ExpressionKind.Undefined;
};

export type ValueExpression = {
  kind: ExpressionKind.Value;
  value: Serializable;
};
