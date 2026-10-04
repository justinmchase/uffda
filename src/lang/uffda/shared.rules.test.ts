import { explainedMistakesTest } from "../../test.ts";
Deno.test(
  "lang.uffda.shared-rules explains mistakes where they occur",
  explainedMistakesTest([
    ["rule ‸= a;", "A declaration needs a name"],
    ["rule A ‸a;", "Expected `=` here"],
    ["rule A = a‸", "A declaration ends with `;`"],
    ["[Foo] ‸;", "Expected a declaration here"],
  ]),
);
