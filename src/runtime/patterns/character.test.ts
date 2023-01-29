import { tests } from "../../test.ts";
import { CharacterClass } from "./pattern.ts";
import { PatternKind } from "./pattern.kind.ts";

tests(() => [
  {
    id: "CHARACTER00",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.Letter,
    }),
    input: "a",
    value: "a",
  },
  {
    id: "CHARACTER01",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.Letter,
    }),
    input: "1",
    matched: false,
    done: false,
  },
  {
    id: "CHARACTER02",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.UppercaseLetter,
    }),
    input: "A",
    value: "A",
  },
  {
    id: "CHARACTER03",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.LowercaseLetter,
    }),
    input: "z",
    value: "z",
  },
  {
    id: "CHARACTER04",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.TitlecaseLetter,
    }),
    input: "ǅ",
    value: "ǅ",
  },
  {
    id: "CHARACTER05",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.ModifierLetter,
    }),
    input: "ᶭ",
    value: "ᶭ",
  },
  {
    id: "CHARACTER06",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.OtherLetter,
    }),
    input: "ǂ",
    value: "ǂ",
  },
  {
    id: "CHARACTER07",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.Mark,
    }),
    input: "⃟",
    value: "⃟",
  },
  {
    id: "CHARACTER08",
    future: true,
    pattern: () => ({
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Character,
          characterClass: CharacterClass.Letter,
        },
        {
          kind: PatternKind.Character,
          characterClass: CharacterClass.EnclosingMark,
        },
        {
          kind: PatternKind.Character,
          characterClass: CharacterClass.Letter,
        },
      ],
    }),
    input: "a꙱b",
    value: "a꙱b",
  },
  {
    id: "CHARACTER09",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.Number,
    }),
    input: "7",
    value: "7",
  },
  {
    id: "CHARACTER10",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.DecimalDigitNumber,
    }),
    input: "0",
    value: "0",
  },
  {
    id: "CHARACTER11",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.LetterNumber,
    }),
    input: "Ⅳ",
    value: "Ⅳ",
  },
  {
    id: "CHARACTER12",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.OtherNumber,
    }),
    input: "¼",
    value: "¼",
  },
  {
    id: "CHARACTER13",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.Symbol,
    }),
    input: "+",
    value: "+",
  },
  {
    id: "CHARACTER14",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.MathSymbol,
    }),
    input: "+",
    value: "+",
  },
  {
    id: "CHARACTER15",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.CurrencySymbol,
    }),
    input: "$",
    value: "$",
  },
  {
    id: "CHARACTER16",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.ModifierSymbol,
    }),
    input: "¨",
    value: "¨",
  },
  {
    id: "CHARACTER17",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.OtherSymbol,
    }),
    input: "֍",
    value: "֍",
  },
  {
    id: "CHARACTER18",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.Punctuation,
    }),
    input: ".",
    value: ".",
  },
  {
    id: "CHARACTER19",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.OpenPunctuation,
    }),
    input: "(",
    value: "(",
  },
  {
    id: "CHARACTER20",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.ClosePunctuation,
    }),
    input: ")",
    value: ")",
  },
  {
    id: "CHARACTER21",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.DashPunctuation,
    }),
    input: "-",
    value: "-",
  },
  {
    id: "CHARACTER22",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.InitualPunctuation,
    }),
    input: "«",
    value: "«",
  },
  {
    id: "CHARACTER23",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.ConnectorPunctuation,
    }),
    input: "﹍",
    value: "﹍",
  },
  {
    id: "CHARACTER24",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.FinalPunctuation,
    }),
    input: "»",
    value: "»",
  },
  {
    id: "CHARACTER25",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.OtherPunctuation,
    }),
    input: "!",
    value: "!",
  },
  {
    id: "CHARACTER26",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.Separator,
    }),
    input: " ",
    value: " ",
  },
  {
    id: "CHARACTER27",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.SpaceSeparator,
    }),
    input: " ",
    value: " ",
  },
  {
    id: "CHARACTER28",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.LineSeparator,
    }),
    input: "\u2028",
    value: "\u2028",
  },
  {
    id: "CHARACTER29",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.ParagraphSeparator,
    }),
    input: "\u2029",
    value: "\u2029",
  },
  {
    id: "CHARACTER30",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.Other,
    }),
    input: "\u0000",
    value: "\u0000",
  },
  {
    id: "CHARACTER31",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.Control,
    }),
    input: "\u0000",
    value: "\u0000",
  },
  {
    id: "CHARACTER32",
    pattern: () => ({
      kind: PatternKind.Character,
      characterClass: CharacterClass.Format,
    }),
    input: "\uFEFF",
    value: "\uFEFF",
  },
]);
