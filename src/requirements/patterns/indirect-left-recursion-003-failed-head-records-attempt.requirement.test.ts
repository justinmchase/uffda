import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { getRightmostFailure, MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { executeUffdaSource } from "../../lang/uffda/execute.ts";

Deno.test(
  "req:indirect-left-recursion-003 - a failed head records its attempt",
  async (t) => {
    await t.step(
      "the rightmost failure reflects the partial progress",
      async () => {
        const m = await executeUffdaSource(
          `export A; rule A = B "x" | "a" "b" "c"; rule B = A "y";`,
          { entryRuleName: "A", input: Input.Iterable("ab") },
        );
        assertEquals(m.kind, MatchKind.Fail);
        if (m.kind !== MatchKind.Fail) return;
        assertEquals(getRightmostFailure(m).span.start, Path.From(2));
      },
    );
  },
);
