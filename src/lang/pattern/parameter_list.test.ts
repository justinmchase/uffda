import { explainedMistakesTest } from "../../test.ts";
Deno.test(
  "lang.pattern.parameter_list explains mistakes where they occur",
  explainedMistakesTest([[
    "func F<x = x;‸",
    "Expected `>` here to close the parameter list",
  ]]),
);
