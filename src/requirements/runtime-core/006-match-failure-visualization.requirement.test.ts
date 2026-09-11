import { assertEquals, assertStringIncludes } from "@std/assert";
import { expressionGrammar } from "../../lang/expression/expression.lang.ts";
import { MatchKind } from "../../match.ts";
import { visualizeMatchFailure } from "../../match.visualize.ts";

Deno.test(
  "req:runtime-core-006 - Match failures have deterministic human-readable visualizations",
  async () => {
    const match = await expressionGrammar("(add 1 #)");
    assertEquals(match.kind, MatchKind.Fail);

    const first = await visualizeMatchFailure(match);
    const second = await visualizeMatchFailure(match);

    assertEquals(second, first);
    assertStringIncludes(first, 'Unexpected: "#"');
    assertStringIncludes(first, "source offset 7");
    assertStringIncludes(
      first,
      "Rules: ExpressionLang > TokenizerNoWhitespace",
    );
    assertStringIncludes(first, "[2] OK into -> resolve TokenizerNoWhitespace");
    assertStringIncludes(first, 'output: [ "(", "add", "1" ]');
    assertStringIncludes(first, "[3] FAIL into -> resolve ExpressionComplete");
    assertStringIncludes(first, "Failure module:");
  },
);
