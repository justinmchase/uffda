import { ExpressionKind } from './expression.kind.ts'

export type Expression
  = INativeExpression
  | ISpecialReferenceExpression

export interface INativeExpression {
  kind: ExpressionKind.Native
  // deno-lint-ignore no-explicit-any
  fn: (args: any) => any
}

export interface ISpecialReferenceExpression {
  kind: ExpressionKind.SpecialReference,
  name: string
}
