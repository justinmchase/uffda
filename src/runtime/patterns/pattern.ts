import { PatternKind } from "./pattern.kind.ts";
import type { Special } from "../modules/special.ts";
import type { Type } from "@justinmchase/type";
import type { Expression } from "../expressions/expression.ts";
import type { ValueSource } from "./value_source.ts";

export type { ValueSource } from "./value_source.ts";
export {
  lit,
  resolveValueSource,
  ValueSourceKind,
  varRef,
} from "./value_source.ts";

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
  | ProjectionPattern
  | QuantifierPattern
  | RegExpPattern
  | ResolvePattern
  | SwitchPattern
  | ThenPattern
  | TypePattern
  | VariablePattern;

export function isPattern(value: unknown): value is Pattern {
  if (value == null) return false;
  if (typeof value !== "object") return false;

  const pattern = value as { kind?: unknown };
  return Object.values(PatternKind).includes(pattern.kind as PatternKind);
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
  /** When omitted, the interval is open below (`..R`). */
  left?: ValueSource;
  /** When omitted, the interval is open above (`L..`). */
  right?: ValueSource;
};
export type EndPattern = {
  kind: PatternKind.End;
};
export type EqualPattern = {
  kind: PatternKind.Equal;
  value: ValueSource;
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
  values: ValueSource[];
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
export type ProjectionPattern = {
  kind: PatternKind.Projection;
  pattern: Pattern;
  expression: Expression;
};
export type QuantifierPattern = {
  kind: PatternKind.Quantifier;
  pattern: Pattern;
  min?: ValueSource;
  max?: ValueSource;
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

/**
 * A single `Switch` branch: `key` is a small, explicit, author-declared
 * discriminator — never inferred — evaluated directly against the next
 * peeked stream value to decide, with certainty, whether `pattern` is even
 * worth attempting. See `SwitchPattern` for the overall dispatch contract.
 */
export type SwitchCase = {
  key: SwitchKey;
  pattern: Pattern;
};

/**
 * Either a small set of literal values (compared with `===`, matching
 * `EqualPattern`/`IncludesPattern`'s own semantics) or a single
 * `CharacterClass` (matching `CharacterPattern`'s semantics: the next value
 * must be a string satisfying the class).
 */
export type SwitchKey =
  | { kind: "values"; values: ValueSource[] }
  | { kind: "characterClass"; characterClass: CharacterClass };

/**
 * Committed-choice dispatch: peek the next stream value once, run the
 * *first* case whose `key` matches, and return its result directly — unlike
 * `Or`, a failing chosen case does **not** fall through to try any other
 * case. If no case's key matches, `default` runs if present; with neither a
 * matching case nor a `default`, `Switch` fails (it never surfaces a type
 * mismatch as an error the way, say, `Character` does — "no key matched" is
 * always just a `Fail`).
 *
 * This exists specifically so grammar authors can hand-declare mutually
 * exclusive dispatch (e.g. a tokenizer choosing a token kind by its first
 * character) without paying `Or`'s per-position cost of attempting every
 * alternative in order.
 */
export type SwitchPattern = {
  kind: PatternKind.Switch;
  cases: SwitchCase[];
  default?: Pattern;
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
