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
    // `#)` is a comment, so the sequence's `)` is missing after `1`.
    assertStringIncludes(first, "Unexpected: <end of input>");
    assertStringIncludes(first, "source offset 6");
    assertStringIncludes(
      first,
      "Rules: ExpressionLang > ExpressionComplete > Expression > Unary > Primary > Sequence",
    );
    assertStringIncludes(first, "[2] OK into -> resolve TokenizerNoWhitespace");
    assertStringIncludes(first, 'output: [ "(", "add", "1" ]');
    assertStringIncludes(first, "[3] FAIL into -> resolve ExpressionComplete");
    assertStringIncludes(first, "Failure module:");
  },
);
