import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import {
  StructuredTokenKind,
  type TokenValue,
} from "../../lang/tokenizer/structured.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("../../lang/tokenizer/mod.uff", import.meta.url).href;

Deno.test(
  "req:tokenizer-runtime-008 - comment and string boundaries are tokenizer patterns",
  async (t) => {
    await t.step(
      "projects a single Comment trivia token for line comments",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable("a # hi\nb"),
        kind: MatchKind.Ok,
        value: [
          { kind: StructuredTokenKind.Word, text: "a" },
          { kind: StructuredTokenKind.Whitespace, text: " " },
          { kind: StructuredTokenKind.Comment, text: "# hi" },
          { kind: StructuredTokenKind.NewLine, text: "\n" },
          { kind: StructuredTokenKind.Word, text: "b" },
        ] satisfies TokenValue[],
      }),
    );

    await t.step(
      "keeps hash punctuation inside quoted strings",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable('"#" # c\n'),
        kind: MatchKind.Ok,
        value: [
          { kind: StructuredTokenKind.Punctuation, text: '"' },
          { kind: StructuredTokenKind.Punctuation, text: "#" },
          { kind: StructuredTokenKind.Punctuation, text: '"' },
          { kind: StructuredTokenKind.Whitespace, text: " " },
          { kind: StructuredTokenKind.Comment, text: "# c" },
          { kind: StructuredTokenKind.NewLine, text: "\n" },
        ] satisfies TokenValue[],
      }),
    );

    await t.step(
      "preserves escaped quotes as independent tokens",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "TokenizerNoWhitespace",
        input: Input.Iterable('"\\""'),
        kind: MatchKind.Ok,
        value: ['"', "\\", '"', '"'],
      }),
    );
  },
);
