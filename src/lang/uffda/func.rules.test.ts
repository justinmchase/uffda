import { explainedMistakesTest } from "../../test.ts";
Deno.test(
  "lang.uffda.func-rules explains mistakes where they occur",
  explainedMistakesTest([[
    "func F = ‸;",
    "A func or decorator needs an expression",
  ], ["func F ‸x = x;", "Expected `=` here"]]),
);
