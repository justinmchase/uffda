import { ExpressionKind } from "./expression.kind.ts";
import type { Pattern } from "../patterns/pattern.ts";
import type { Serializable } from "@justinmchase/serializable";
import type { Special } from "../modules/mod.ts";
import { Type, type } from "@justinmchase/type";

export type ProjectionFunction = (
  // deno-lint-ignore no-explicit-any
  args: any,
  specials: Map<string, Special>,
  // deno-lint-ignore no-explicit-any
) => any;

export enum BinaryOperation {
  And = "and",
  Or = "or",
}

export function isExpression(value: unknown): value is Expression {
  const [t] = type(value);
  if (t !== Type.Object) return false;
  const p = value as Expression;
  return Object.values(ExpressionKind).includes(p.kind);
}

export type Expression =
  | NativeExpression
  | BinaryExpression
  | UnaryExpression
  | PrimaryExpression
  | TerminalExpression;

export type BinaryExpression =
  | AndExpression
  | OrExpression;

export type UnaryExpression = NotExpression;

export type PrimaryExpression =
  | StringExpression
  | ArrayExpression
  | ObjectExpression
  | LambdaExpression
  | InvocationExpression;

export type TerminalExpression =
  | NumberExpression
  | BooleanExpression
  | ReferenceExpression
  | UndefinedExpression
  | MemberExpression
  | ValueExpression
  | SpecialReferenceExpression;

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

export type AndExpression = {
  kind: ExpressionKind.Binary;
  op: BinaryOperation.And;
  left: Expression;
  right: Expression;
};

export type OrExpression = {
  kind: ExpressionKind.Binary;
  op: BinaryOperation.Or;
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

export type NotExpression = {
  kind: ExpressionKind.Not;
  expression: Expression;
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
  values: (string | Expression)[];
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
