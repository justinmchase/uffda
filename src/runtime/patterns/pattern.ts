import { PatternKind } from "./pattern.kind.ts";
import type { Serializable } from "@justinmchase/serializable";
import type { Special } from "../modules/special.ts";
import type { Comparable } from "../../comparable.ts";
import type { Type } from "@justinmchase/type";

export type Pattern =
  | AnyPattern
  | AndPattern
  | BetweenPattern
  | IntoPattern
  | CharacterPattern
  | EndPattern
  | EqualPattern
  | ExceptPattern
  | FailPattern
  | IncludesPattern
  | LookaheadPattern
  | MaybePattern
  | NotPattern
  | OverPattern
  | OkPattern
  | OrPattern
  | PipelinePattern
  | QuantifierPattern
  | RegExpPattern
  | ResolvePattern
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
  EnclosingMark = "Me",
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

export type AnyPattern = {
  kind: PatternKind.Any;
};
export type AndPattern = {
  kind: PatternKind.And;
  patterns: Pattern[];
};
export type CharacterPattern = {
  kind: PatternKind.Character;
  characterClass: CharacterClass;
};
export type BetweenPattern = {
  kind: PatternKind.Between;
  left: Comparable;
  right: Comparable;
};
export type EndPattern = {
  kind: PatternKind.End;
};
export type EqualPattern = {
  kind: PatternKind.Equal;
  value: Serializable;
};
export type ExceptPattern = {
  kind: PatternKind.Except;
  pattern: Pattern;
};
export type FailPattern = {
  kind: PatternKind.Fail;
};
export type IncludesPattern = {
  kind: PatternKind.Includes;
  values: Serializable[];
};
export type IntoPattern = {
  kind: PatternKind.Into;
  pattern: Pattern;
};
export type LookaheadPattern = {
  kind: PatternKind.Lookahead;
  pattern: Pattern;
};
export type MaybePattern = {
  kind: PatternKind.Maybe;
  pattern: Pattern;
};
export type NotPattern = {
  kind: PatternKind.Not;
  pattern: Pattern;
};
export type OverPattern = {
  kind: PatternKind.Over;
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
export type QuantifierPattern = {
  kind: PatternKind.Quantifier;
  pattern: Pattern;
  min?: number;
  max?: number;
};
export type RegExpPattern = {
  kind: PatternKind.RegExp;
  pattern: RegExp;
};

export enum ResolveTargetKind {
  Reference = "reference",
  Run = "run",
  Special = "special",
}

export type ResolvePattern =
  | ResolveReferencePattern
  | ResolveRunPattern
  | ResolveSpecialPattern;

export type ResolveReferencePattern = {
  kind: PatternKind.Resolve;
  targetKind: ResolveTargetKind.Reference;
  name: string;
  args: Pattern[];
};

export type ResolveRunPattern = {
  kind: PatternKind.Resolve;
  targetKind: ResolveTargetKind.Run;
  name?: string;
};

export type ResolveSpecialPattern = {
  kind: PatternKind.Resolve;
  targetKind: ResolveTargetKind.Special;
  value: Special;
};
export type ThenPattern = {
  kind: PatternKind.Then;
  patterns: Pattern[];
};
export type TypePattern = {
  kind: PatternKind.Type;
  type: Type;
};
export type VariablePattern = {
  kind: PatternKind.Variable;
  name: string;
  pattern: Pattern;
};
