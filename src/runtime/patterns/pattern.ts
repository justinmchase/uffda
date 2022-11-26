import { Comparable } from "../../comparable.ts";
import { Expression } from "../expressions/mod.ts";
import { PatternKind } from "./pattern.kind.ts";

export type Pattern =
  | IAnyPattern
  | IAndPattern
  | IArrayPattern
  | IBooleanPattern
  | IEndPattern
  | IEqualPattern
  | IUntilPattern
  | IFailPattern
  | IIncludesPattern
  | IMustPattern
  | INotPattern
  | INumberPattern
  | IObjectPattern
  | IOkPattern
  | IOrPattern
  | IPipelinePattern
  | IProjectionPattern
  | IRangePattern
  | IReferencePattern
  | IRegExpPattern
  | ISlicePattern
  | IStringPattern
  | IThenPattern
  | IVariablePattern;

export function isPattern(value: unknown): value is Pattern {
  if (value == null) return false;
  if (typeof value !== "object") return false;

  const p = value as Pattern;
  return Reflect.has(PatternKind, p.kind);
}

export interface IAnyPattern {
  kind: PatternKind.Any;
}
export interface IAndPattern {
  kind: PatternKind.And;
  patterns: Pattern[];
}
export interface IArrayPattern {
  kind: PatternKind.Array;
  pattern: Pattern;
}
export interface IBooleanPattern {
  kind: PatternKind.Boolean;
}
export interface IEndPattern {
  kind: PatternKind.End;
}
export interface IEqualPattern {
  kind: PatternKind.Equal;
  value: unknown;
}
export interface IUntilPattern {
  kind: PatternKind.Until;
  pattern: Pattern;
  name: string;
  message: string;
}
export interface IFailPattern {
  kind: PatternKind.Fail;
}
export interface IIncludesPattern {
  kind: PatternKind.Includes;
  values: unknown[];
}
export interface IMustPattern {
  kind: PatternKind.Must;
  name: string;
  message: string;
  pattern: Pattern;
}
export interface INotPattern {
  kind: PatternKind.Not;
  pattern: Pattern;
}
export interface INumberPattern {
  kind: PatternKind.Number;
}
export interface IObjectPattern {
  kind: PatternKind.Object;
  keys?: Record<string, Pattern>;
}
export interface IOkPattern {
  kind: PatternKind.Ok;
}
export interface IOrPattern {
  kind: PatternKind.Or;
  patterns: Pattern[];
}
export interface IPipelinePattern {
  kind: PatternKind.Pipeline;
  steps: Pattern[];
}
export interface IProjectionPattern {
  kind: PatternKind.Projection;
  pattern: Pattern;
  expression: Expression;
}
export interface IRangePattern {
  kind: PatternKind.Range;
  left: Comparable;
  right: Comparable;
}
export interface IReferencePattern {
  kind: PatternKind.Reference;
  name: string;
}
export interface IRegExpPattern {
  kind: PatternKind.RegExp;
  pattern: RegExp;
}
export interface ISlicePattern {
  kind: PatternKind.Slice;
  pattern: Pattern;
  min?: number;
  max?: number;
}
export interface IStringPattern {
  kind: PatternKind.String;
}
export interface IThenPattern {
  kind: PatternKind.Then;
  patterns: Pattern[];
}
export interface IVariablePattern {
  kind: PatternKind.Variable;
  name: string;
  pattern: Pattern;
}
