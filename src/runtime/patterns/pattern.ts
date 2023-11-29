import { PatternKind } from "./pattern.kind.ts";
import { Expression } from "../expressions/mod.ts";
import { Special } from "../modules/special.ts";
import { Serializable } from "serializable/mod.ts";
import { Comparable } from "../../comparable.ts";

export type Pattern =
  | IAnyPattern
  | IAndPattern
  | IArrayPattern
  | ICharacterPattern
  | IEndPattern
  | IEqualPattern
  | IUntilPattern
  | IFailPattern
  | IIncludesPattern
  | IMustPattern
  | INotPattern
  | IObjectPattern
  | IOkPattern
  | IOrPattern
  | IPipelinePattern
  | IProjectionPattern
  | IRangePattern
  | IReferencePattern
  | IRegExpPattern
  | ISlicePattern
  | ISpecialPattern
  | IThenPattern
  | ITypePattern
  | IVariablePattern;

export function isPattern(value: unknown): value is Pattern {
  if (value == null) return false;
  if (typeof value !== "object") return false;

  const p = value as Pattern;
  return Reflect.has(PatternKind, p.kind);
}

export enum CharacterClass {
  Any = "A",
  Assigned = "As",
  Ascii = "Ac",
  Letter = "L",
  UppercaseLetter = "Lu",
  LowercaseLetter = "Ll",
  TitlecaseLetter = "Lt",
  ModifierLetter = "Lm",
  OtherLetter = "Lo",
  Mark = "M",
  NonSpacingMark = "Mn",
  SpacingCombiningMark = "Mc",
  EnclosingMark = "Mn",
  Number = "N",
  DecimalDigitNumber = "Nd",
  LetterNumber = "Nl",
  OtherNumber = "No",
  Symbol = "S",
  MathSymbol = "Sm",
  CurrencySymbol = "Sc",
  ModifierSymbol = "Sk",
  OtherSymbol = "So",
  Punctuation = "P",
  ConnectorPunctuation = "Pc",
  DashPunctuation = "Pd",
  OpenPunctuation = "Ps",
  ClosePunctuation = "Pe",
  InitualPunctuation = "Pi",
  FinalPunctuation = "Pf",
  OtherPunctuation = "Po",
  Separator = "Z",
  SpaceSeparator = "Zs",
  LineSeparator = "Zl",
  ParagraphSeparator = "Zp",
  Other = "C",
  Control = "Cc",
  Format = "Cf",
  Surrogate = "Cs",
  PrivateUse = "Co",
  Unassigned = "Cn",
}

export enum ValueType {
  BigInt = "bigint",
  Boolean = "boolean",
  Function = "function",
  Number = "number",
  Object = "object",
  String = "string",
  Symbol = "symbol",
  Undefined = "undefined",
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
export interface ICharacterPattern {
  kind: PatternKind.Character;
  characterClass: CharacterClass;
}
export interface IEndPattern {
  kind: PatternKind.End;
}
export interface IEqualPattern {
  kind: PatternKind.Equal;
  value: Serializable;
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
  values: Serializable[];
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
export interface ISpecialPattern {
  kind: PatternKind.Special;
  name: string;
  value: Special;
}
export interface IThenPattern {
  kind: PatternKind.Then;
  patterns: Pattern[];
}
export interface ITypePattern {
  kind: PatternKind.Type;
  type: ValueType;
}
export interface IVariablePattern {
  kind: PatternKind.Variable;
  name: string;
  pattern: Pattern;
}
