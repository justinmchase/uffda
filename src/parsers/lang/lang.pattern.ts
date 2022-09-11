import { Comparable } from "../../comparable.ts";

export enum LangPatternKind {
  // Patterns
  AndPattern = "AndPattern",
  AnyPattern = "AnyPattern",
  BooleanPattern = "BooleanPattern",
  EqualPattern = "EqualPattern",
  ExpressionPattern = "ExpressionPattern",
  MustPattern = "MustPattern",
  NotPattern = "NotPattern",
  NumberPattern = "NumberPattern",
  OkPattern = "OkPattern",
  ObjectPattern = "ObjectPattern",
  ObjectKeyPattern = "ObjectKeyPattern",
  OneOrMorePattern = "OneOrMorePattern",
  OrPattern = "OrPattern",
  PatternDeclaration = "PatternDeclaration",
  PipelinePattern = "PipelinePattern",
  ProjectionPattern = "ProjectionPattern",
  RangePattern = "RangePattern",
  ReferencePattern = "ReferencePattern",
  SpecialReferencePattern = "SpecialReferencePattern",
  StringPattern = "StringPattern",
  ThenPattern = "ThenPattern",
  VariablePattern = "VariablePattern",
  ZeroOrMorePattern = "ZeroOrMorePattern",
  ZeroOrOnePattern = "ZeroOrOnePattern",
}

export enum LangExpressionKind {
  AddExpression = "AddExpression",
  ArrayExpression = "ArrayExpression",
  InvocationExpression = "InvocationExpression",
  MemberExpression = "MemberExpression",
  NumberExpression = "NumberExpression",
  SpecialReferenceExpression = "SpecialReferenceExpression",
  ReferenceExpression = "ReferenceExpression",
}

export type LangPattern =
  | IAndPattern
  | IAnyPattern
  | IBooleanPattern
  | IEqualPattern
  | IExpressionPattern
  | IMustPattern
  | INotPattern
  | INumberPattern
  | IOkPattern
  | IObjectPattern
  | IOneOrMorePattern
  | IOrPattern
  | IPipelinePattern
  | IProjectionPattern
  | IRangePattern
  | IReferencePattern
  | ISpecialReferencePattern
  | IStringPattern
  | IVariablePattern
  | IZeroOrMorePattern
  | IZeroOrOnePattern;

export type LangExpression =
  | IAddExpression
  | IArrayExpression
  | IInvocationExpression
  | IMemberExpression
  | INumberExpression
  | ISpecialReferenceExpression
  | IReferenceExpression;

export interface IPatternDeclaration {
  kind: LangPatternKind.PatternDeclaration;
  pattern: LangPattern;
}
export interface IAndPattern {
  kind: LangPatternKind.AndPattern;
  left: LangPattern;
  right: LangPattern;
}
export interface IAnyPattern {
  kind: LangPatternKind.AnyPattern;
}
export interface IBooleanPattern {
  kind: LangPatternKind.BooleanPattern;
}
export interface IEqualPattern {
  kind: LangPatternKind.EqualPattern;
  value: unknown;
}
export interface IExpressionPattern {
  kind: LangPatternKind.ExpressionPattern;
}
export interface IMustPattern {
  kind: LangPatternKind.MustPattern;
  pattern: LangPattern;
}
export interface INotPattern {
  kind: LangPatternKind.NotPattern;
  pattern: LangPattern;
}
export interface INumberPattern {
  kind: LangPatternKind.NumberPattern;
}
export interface IOkPattern {
  kind: LangPatternKind.OkPattern;
}

export interface IObjectPattern {
  kind: LangPatternKind.ObjectPattern;
  keys: Record<string, IObjectKeyPattern>;
}

export interface IObjectKeyPattern {
  kind: LangPatternKind.ObjectKeyPattern;
  name: string;
  must?: boolean;
  alias?: string;
  pattern?: LangPattern;
}

export interface IOneOrMorePattern {
  kind: LangPatternKind.OneOrMorePattern;
  pattern: LangPattern;
}

export interface IOrPattern {
  kind: LangPatternKind.OrPattern;
  left: LangPattern;
  right: LangPattern;
}

export interface IPipelinePattern {
  kind: LangPatternKind.PipelinePattern;
  left: LangPattern;
  right: LangPattern;
}

export interface IProjectionPattern {
  kind: LangPatternKind.ProjectionPattern;
  left: LangPattern;
  right: LangExpression;
}

export interface IRangePattern {
  kind: LangPatternKind.RangePattern;
  left: Comparable;
  right: Comparable;
}

export interface IReferencePattern {
  kind: LangPatternKind.ReferencePattern;
  name: string;
}

export interface ISpecialReferencePattern {
  kind: LangPatternKind.SpecialReferencePattern;
  name: string;
}

export interface IStringPattern {
  kind: LangPatternKind.StringPattern;
  value: string;
}

export interface IVariablePattern {
  kind: LangPatternKind.VariablePattern;
  name: string;
  pattern: LangPattern;
}

export interface IZeroOrMorePattern {
  kind: LangPatternKind.ZeroOrMorePattern;
  pattern: LangPattern;
}

export interface IZeroOrOnePattern {
  kind: LangPatternKind.ZeroOrOnePattern;
  pattern: LangPattern;
}

// Expressions
export interface IAddExpression {
  kind: LangExpressionKind.AddExpression;
  left: LangExpression;
  right: LangExpression;
}

export interface IArrayExpression {
  kind: LangExpressionKind.ArrayExpression;
  expressions: LangExpression[];
}

export interface IInvocationExpression {
  kind: LangExpressionKind.InvocationExpression;
  expression: LangExpression;
}

export interface INumberExpression {
  kind: LangExpressionKind.NumberExpression;
  value: number;
}

export interface IMemberExpression {
  kind: LangExpressionKind.MemberExpression;
  expression: LangExpression;
  name: string;
}

export interface IReferenceExpression {
  kind: LangExpressionKind.ReferenceExpression;
  name: string;
}

export interface ISpecialReferenceExpression {
  kind: LangExpressionKind.SpecialReferenceExpression;
  name: string;
}
