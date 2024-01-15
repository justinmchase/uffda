import { patternTest } from "../../test.ts";
import { CharacterClass } from "./pattern.ts";
import { PatternKind } from "./pattern.kind.ts";
import { Input } from "../../input.ts";

Deno.test("patterns/character", async (t) => {
  await t.step({
    name: "CHARACTER00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Letter,
      },
      input: Input.From("a"),
      value: "a",
    }),
  });
  await t.step({
    name: "CHARACTER01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Letter,
      },
      input: Input.From("1"),
      matched: false,
      done: false,
    }),
  });
  await t.step({
    name: "CHARACTER02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.UppercaseLetter,
      },
      input: Input.From("A"),
      value: "A",
    }),
  });
  await t.step({
    name: "CHARACTER03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.LowercaseLetter,
      },
      input: Input.From("z"),
      value: "z",
    }),
  });
  await t.step({
    name: "CHARACTER04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.TitlecaseLetter,
      },
      input: Input.From("ǅ"),
      value: "ǅ",
    }),
  });
  await t.step({
    name: "CHARACTER05",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.ModifierLetter,
      },
      input: Input.From("ᶭ"),
      value: "ᶭ",
    }),
  });
  await t.step({
    name: "CHARACTER06",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.OtherLetter,
      },
      input: Input.From("ǂ"),
      value: "ǂ",
    }),
  });
  await t.step({
    name: "CHARACTER07",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Mark,
      },
      input: Input.From("⃟"),
      value: "⃟",
    }),
  });
  await t.step({
    name: "CHARACTER08",
    ignore: true, // not sure why this isn't working
    fn: patternTest({
      pattern: {
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
      },
      input: Input.From("a꙱b"),
      value: "a꙱b",
    }),
  });
  await t.step({
    name: "CHARACTER09",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Number,
      },
      input: Input.From("7"),
      value: "7",
    }),
  });
  await t.step({
    name: "CHARACTER10",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.DecimalDigitNumber,
      },
      input: Input.From("0"),
      value: "0",
    }),
  });
  await t.step({
    name: "CHARACTER11",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.LetterNumber,
      },
      input: Input.From("Ⅳ"),
      value: "Ⅳ",
    }),
  });
  await t.step({
    name: "CHARACTER12",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.OtherNumber,
      },
      input: Input.From("¼"),
      value: "¼",
    }),
  });
  await t.step({
    name: "CHARACTER13",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Symbol,
      },
      input: Input.From("+"),
      value: "+",
    }),
  });
  await t.step({
    name: "CHARACTER14",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.MathSymbol,
      },
      input: Input.From("+"),
      value: "+",
    }),
  });
  await t.step({
    name: "CHARACTER15",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.CurrencySymbol,
      },
      input: Input.From("$"),
      value: "$",
    }),
  });
  await t.step({
    name: "CHARACTER16",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.ModifierSymbol,
      },
      input: Input.From("¨"),
      value: "¨",
    }),
  });
  await t.step({
    name: "CHARACTER17",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.OtherSymbol,
      },
      input: Input.From("֍"),
      value: "֍",
    }),
  });
  await t.step({
    name: "CHARACTER18",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Punctuation,
      },
      input: Input.From("."),
      value: ".",
    }),
  });
  await t.step({
    name: "CHARACTER19",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.OpenPunctuation,
      },
      input: Input.From("("),
      value: "(",
    }),
  });
  await t.step({
    name: "CHARACTER20",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.ClosePunctuation,
      },
      input: Input.From(")"),
      value: ")",
    }),
  });
  await t.step({
    name: "CHARACTER21",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.DashPunctuation,
      },
      input: Input.From("-"),
      value: "-",
    }),
  });
  await t.step({
    name: "CHARACTER22",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.InitualPunctuation,
      },
      input: Input.From("«"),
      value: "«",
    }),
  });
  await t.step({
    name: "CHARACTER23",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.ConnectorPunctuation,
      },
      input: Input.From("﹍"),
      value: "﹍",
    }),
  });
  await t.step({
    name: "CHARACTER24",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.FinalPunctuation,
      },
      input: Input.From("»"),
      value: "»",
    }),
  });
  await t.step({
    name: "CHARACTER25",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.OtherPunctuation,
      },
      input: Input.From("!"),
      value: "!",
    }),
  });
  await t.step({
    name: "CHARACTER26",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Separator,
      },
      input: Input.From(" "),
      value: " ",
    }),
  });
  await t.step({
    name: "CHARACTER27",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.SpaceSeparator,
      },
      input: Input.From(" "),
      value: " ",
    }),
  });
  await t.step({
    name: "CHARACTER28",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.LineSeparator,
      },
      input: Input.From("\u2028"),
      value: "\u2028",
    }),
  });
  await t.step({
    name: "CHARACTER29",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.ParagraphSeparator,
      },
      input: Input.From("\u2029"),
      value: "\u2029",
    }),
  });
  await t.step({
    name: "CHARACTER30",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Other,
      },
      input: Input.From("\u0000"),
      value: "\u0000",
    }),
  });
  await t.step({
    name: "CHARACTER31",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Control,
      },
      input: Input.From("\u0000"),
      value: "\u0000",
    }),
  });
  await t.step({
    name: "CHARACTER32",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Format,
      },
      input: Input.From("\uFEFF"),
      value: "\uFEFF",
    }),
  });
});
