import { PatternKind } from "./pattern.kind.ts";
import { Special } from "../modules/special.ts";
import { Serializable } from "serializable/mod.ts";
import { Comparable } from "../../comparable.ts";

export type Pattern =
  | AnyPattern
  | AndPattern
  | ArrayPattern
  | CharacterPattern
  | EndPattern
  | EqualPattern
  | FailPattern
  | IncludesPattern
  | MaybePattern
  | NotPattern
  | ObjectPattern
  | OkPattern
  | OrPattern
  | PipelinePattern
  | RangePattern
  | ReferencePattern
  | RegExpPattern
  | RunPattern
  | SlicePattern
  | SpecialPattern
  | ThenPattern
  | TypePattern
  | VariablePattern;

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

export type AnyPattern = {
  kind: PatternKind.Any;
};
export type AndPattern = {
  kind: PatternKind.And;
  patterns: Pattern[];
};
export type ArrayPattern = {
  kind: PatternKind.Array;
  pattern: Pattern;
};
export type CharacterPattern = {
  kind: PatternKind.Character;
  characterClass: CharacterClass;
};
export type EndPattern = {
  kind: PatternKind.End;
};
export type EqualPattern = {
  kind: PatternKind.Equal;
  value: Serializable;
};
export type FailPattern = {
  kind: PatternKind.Fail;
};
export type IncludesPattern = {
  kind: PatternKind.Includes;
  values: Serializable[];
};
export type MaybePattern = {
  kind: PatternKind.Maybe;
  pattern: Pattern;
};
export type NotPattern = {
  kind: PatternKind.Not;
  pattern: Pattern;
};
export type ObjectPattern = {
  kind: PatternKind.Object;
  keys?: Record<string, Pattern>;
};
export type OkPattern = {
  kind: PatternKind.Ok;
};
export type OrPattern = {
  kind: PatternKind.Or;
  patterns: Pattern[];
};
export type PipelinePattern = {
  kind: PatternKind.Pipeline;
  steps: Pattern[];
};
export type RangePattern = {
  kind: PatternKind.Range;
  left: Comparable;
  right: Comparable;
};
export type ReferencePattern = {
  kind: PatternKind.Reference;
  name: string;
  args: string[];
};
export type RegExpPattern = {
  kind: PatternKind.RegExp;
  pattern: RegExp;
};

export type RunPattern = {
  kind: PatternKind.Run;
  name?: string;
};

export type SlicePattern = {
  kind: PatternKind.Slice;
  pattern: Pattern;
  min?: number;
  max?: number;
};
export type SpecialPattern = {
  kind: PatternKind.Special;
  name: string;
  value: Special;
};
export type ThenPattern = {
  kind: PatternKind.Then;
  patterns: Pattern[];
};
export type TypePattern = {
  kind: PatternKind.Type;
  type: ValueType;
};
export type VariablePattern = {
  kind: PatternKind.Variable;
  name: string;
  pattern: Pattern;
};
