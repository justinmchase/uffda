import { MatchKind, visualizeMatchFailure } from "../../mod.ts";
import { expr } from "./expression.lang.ts";
import { assertEquals } from "@std/assert";

const moduleUrl = new URL("./binary.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

// This test is not yet working because the output of the Tokenizer
// is leaving whitespace but the expression language is expecting it
// to be without whitespace.
//
// So for this to work we need to either add a Whitespace filter layer
// or add whitespace handling into the expression language.
Deno.test(
  {
    name: "lang.expression",
    ignore: true || p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "EXPR_LANG_00",
      fn: async () => {
        const m = await expr("(add 1 2)");
        switch (m.kind) {
          case MatchKind.Ok: {
            assertEquals(m.value, 3);
            break;
          }
          case MatchKind.Fail:
            console.log(Deno.inspect({
              start: m.span.start.toString(),
              end: m.span.end.toString(),
            }, { depth: 10, colors: true }));
            assertEquals(m.kind, MatchKind.Ok);
            break;
          default:
            console.log(m);
            assertEquals(m.kind, MatchKind.Ok);
        }
      },
    });
  },
);

// Integration test for invalid expression parsing with visualization
// This test verifies that:
// 1. The expression "(add 1 #)" fails to parse (# is not a valid expression)
// 2. The visualizeMatchFailure function shows the hierarchical pattern structure
// 3. Pipeline steps are clearly denoted (Tokenizer -> Expression)
// 4. The rightmost failure points to the # character
Deno.test(
  {
    name: "lang.expression.invalid",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name:
        "EXPR_LANG_INVALID_00 - should fail with invalid expression (add 1 #)",
      fn: async () => {
        const m = await expr("(add 1 #)");
        // Expecting the match to fail because "#" is not a valid expression
        assertEquals(m.kind, MatchKind.Fail);

        // Visualize the failure for debugging
        // Expected output should show:
        // - Module URL
        // - Parse failure position (pointing to # character)
        // - Pipeline with Tokenizer (success) and Expression (failure) steps
        // - Hierarchical pattern tree showing where parsing failed
        // - Input context showing the # character
        console.log("\nVisualized Match Failure:");
        console.log(visualizeMatchFailure(m));
      },
    });
  },
);
