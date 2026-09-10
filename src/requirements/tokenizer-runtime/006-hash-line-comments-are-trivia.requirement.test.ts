import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("../../lang/tokenizer/mod.uff", import.meta.url).href;

Deno.test(
  "req:tokenizer-runtime-006 - hash line comments are quote-aware trivia",
  moduleDeclarationTest({
    moduleUrl,
    entryRuleName: "TokenizerNoWhitespace",
    input: Input.Iterable(
      '#123 punctuation !@*\nany # trailing comment\n"# quoted \\" hash"\nend\n# comment at end of input',
    ),
    kind: MatchKind.Ok,
    value: [
      "any",
      '"',
      "#",
      "quoted",
      "\\",
      '"',
      "hash",
      '"',
      "end",
    ],
  }),
);
