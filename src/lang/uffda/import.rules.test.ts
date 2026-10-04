import { explainedMistakesTest } from "../../test.ts";
Deno.test(
  "lang.uffda.import-rules explains mistakes where they occur",
  explainedMistakesTest([
    ["import ‸A;", "An import names its module with a quoted path"],
    ['import "./a.uff"‸;', "An import lists the names"],
    ['import "./a.uff A;‸', "The module path is missing its closing"],
  ]),
);
