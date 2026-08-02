import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { Tokenizer } from "../../lang/tokenizer/mod.ts";
import { executeModuleDeclaration } from "../../runtime/module.execute.ts";

Deno.test("req:tokenizer-runtime-006 - hash line comments are quote-aware trivia", async () => {
  const match = await executeModuleDeclaration(Tokenizer, {
    moduleUrl: new URL("../../lang/tokenizer/mod.ts", import.meta.url),
    entryRuleName: "TokenizerNoWhitespace",
    input: Input.Iterable(
      '#123 punctuation !@*\nany # trailing comment\n"# quoted \\" hash"\nend\n# comment at end of input',
    ),
  });

  assertEquals(match.kind, MatchKind.Ok);
  if (match.kind !== MatchKind.Ok) return;

  assertEquals(match.value, [
    "any",
    '"',
    "#",
    "quoted",
    "\\",
    '"',
    "hash",
    '"',
    "end",
  ]);
});
