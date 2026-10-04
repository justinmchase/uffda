import { explainedMistakesTest } from "../../test.ts";
Deno.test(
  "lang.uffda.rule-rules explains mistakes where they occur",
  explainedMistakesTest([["rule A = ‸;", "A rule needs a pattern after `=`"], [
    "rule A<P ‸= P;",
    "A rule's parameter list ends with `>`",
  ], ["rule A = a -> ‸;", "`->` must be followed by the expression"]]),
);
