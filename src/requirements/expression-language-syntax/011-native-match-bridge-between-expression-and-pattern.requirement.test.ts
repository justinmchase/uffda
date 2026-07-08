import { assertEquals, assertRejects } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { expr } from "../../lang/expression/expression.lang.ts";
import { exec } from "../../runtime/exec.ts";

Deno.test("req:expression-language-syntax-011 - Expression projection can invoke native match bridge with deterministic behavior and normalized errors", async (t) => {
  await t.step(
    "native match bridge can be invoked from expression syntax",
    async () => {
      const globals = new Map<string, unknown>([
        ["match", (a: number, b: number) => a === b],
      ]);

      const m = await expr("(match 1 1)", { globals });
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind === MatchKind.Ok) {
        const value = await exec(m.value, m);
        assertEquals(value, true);
      }
    },
  );

  await t.step(
    "bridge invocation remains deterministic for fixed input",
    async () => {
      const globals = new Map<string, unknown>([
        ["match", (a: number, b: number) => a === b],
      ]);

      const left = await expr("(match 1 2)", { globals });
      const right = await expr("(match 1 2)", { globals });

      assertEquals(left.kind, MatchKind.Ok);
      assertEquals(right.kind, MatchKind.Ok);

      if (left.kind === MatchKind.Ok && right.kind === MatchKind.Ok) {
        const leftValue = await exec(left.value, left);
        const rightValue = await exec(right.value, right);
        assertEquals(leftValue, rightValue);
        assertEquals(leftValue, false);
      }
    },
  );

  await t.step(
    "bridge exceptions are normalized as expression exceptions",
    async () => {
      const globals = new Map<string, unknown>([
        ["match", () => {
          throw new Error("bridge exploded");
        }],
      ]);

      const m = await expr("(match 1 1)", { globals });
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind === MatchKind.Ok) {
        await assertRejects(async () => {
          await exec(m.value, m);
        });
      }
    },
  );

  await t.step(
    "invocation does not coerce non-callable targets into identity behavior",
    async () => {
      const globals = new Map<string, unknown>([["n", 7]]);

      const m = await expr("(n)", { globals });
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind === MatchKind.Ok) {
        await assertRejects(async () => {
          await exec(m.value, m);
        });
      }
    },
  );
});
