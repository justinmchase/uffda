import { assertStringIncludes } from "@std/assert";
import { Input } from "./input.ts";
import { MatchKind } from "./match.ts";
import { Path } from "./path.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import { patternTest } from "./test.ts";

Deno.test({
  name: "test-harness debug diagnostics",
  fn: async (t) => {
    await t.step({
      name: "includes rightmost failure details for failing pattern assertions",
      fn: async () => {
        const run = patternTest({
          pattern: {
            kind: PatternKind.Equal,
            value: "x",
          },
          input: Input.Scalar("y"),
          kind: MatchKind.Fail,
          start: Path.From(1),
        });

        let message = "";
        try {
          await run();
        } catch (err) {
          message = err instanceof Error ? err.message : String(err);
        }

        assertStringIncludes(message, "Match debug:");
        assertStringIncludes(message, "rightmost failure span:");
      },
    });

    await t.step({
      name: "includes structured match diagnostics for value mismatch",
      fn: async () => {
        const run = patternTest({
          pattern: {
            kind: PatternKind.Any,
          },
          input: Input.Scalar("value"),
          kind: MatchKind.Ok,
          value: "different-value",
        });

        let message = "";
        try {
          await run();
        } catch (err) {
          message = err instanceof Error ? err.message : String(err);
        }

        assertStringIncludes(
          message,
          "Match value did not equal expected value",
        );
        assertStringIncludes(message, "Match debug:");
        assertStringIncludes(message, "pattern: any");
      },
    });
  },
});
