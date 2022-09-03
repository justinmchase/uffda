import { Comparable } from "../../comparable.ts";

export enum LangPatternKind {
  AndPattern = "AndPattern",
  AnyPattern = "AnyPattern",
  BooleanPattern = "BooleanPattern",
  EqualPattern = "EqualPattern",
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
  SpecialReferenceExpression = "SpecialReferenceExpression",
}

export type LangPattern =
  | IAndPattern
  | IAnyPattern
  | IBooleanPattern
  | IEqualPattern
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

export type LangExpression = ISpecialReferenceExpression;

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

export interface ISpecialReferenceExpression {
  kind: LangExpressionKind.SpecialReferenceExpression;
  name: string;
}
