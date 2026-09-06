import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import {
  StructuredTokenKind,
  Tokenizer,
  type TokenValue,
} from "../../lang/tokenizer/mod.ts";
import { executeModuleDeclaration } from "../../runtime/module.execute.ts";

Deno.test(
  "req:tokenizer-runtime-008 - comment and string boundaries are tokenizer patterns",
  async (t) => {
    await t.step(
      "projects a single Comment trivia token for line comments",
      async () => {
        const match = await executeModuleDeclaration(Tokenizer, {
          moduleUrl: new URL("../../lang/tokenizer/mod.ts", import.meta.url),
          entryRuleName: "Tokenizer",
          input: Input.Iterable("a # hi\nb"),
        });

        assertEquals(match.kind, MatchKind.Ok);
        if (match.kind !== MatchKind.Ok) return;

        assertEquals(
          match.value,
          [
            { kind: StructuredTokenKind.Word, text: "a" },
            { kind: StructuredTokenKind.Whitespace, text: " " },
            { kind: StructuredTokenKind.Comment, text: "# hi" },
            { kind: StructuredTokenKind.NewLine, text: "\n" },
            { kind: StructuredTokenKind.Word, text: "b" },
          ] satisfies TokenValue[],
        );
      },
    );

    await t.step("keeps hash punctuation inside quoted strings", async () => {
      const match = await executeModuleDeclaration(Tokenizer, {
        moduleUrl: new URL("../../lang/tokenizer/mod.ts", import.meta.url),
        entryRuleName: "Tokenizer",
        input: Input.Iterable('"#" # c\n'),
      });

      assertEquals(match.kind, MatchKind.Ok);
      if (match.kind !== MatchKind.Ok) return;

      assertEquals(
        match.value,
        [
          { kind: StructuredTokenKind.Punctuation, text: '"' },
          { kind: StructuredTokenKind.Punctuation, text: "#" },
          { kind: StructuredTokenKind.Punctuation, text: '"' },
          { kind: StructuredTokenKind.Whitespace, text: " " },
          { kind: StructuredTokenKind.Comment, text: "# c" },
          { kind: StructuredTokenKind.NewLine, text: "\n" },
        ] satisfies TokenValue[],
      );
    });

    await t.step("preserves escaped quotes as independent tokens", async () => {
      const match = await executeModuleDeclaration(Tokenizer, {
        moduleUrl: new URL("../../lang/tokenizer/mod.ts", import.meta.url),
        entryRuleName: "TokenizerNoWhitespace",
        input: Input.Iterable('"\\""'),
      });

      assertEquals(match.kind, MatchKind.Ok);
      if (match.kind !== MatchKind.Ok) return;
      assertEquals(match.value, ['"', "\\", '"', '"']);
    });
  },
);
