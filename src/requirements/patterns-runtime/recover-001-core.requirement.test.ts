import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { executeUffdaSource } from "../../lang/uffda/execute.ts";
import { unwrap } from "../../wrapped.ts";

async function run(source: string, input: string, recovery = true) {
  return await executeUffdaSource(`export Main; rule Main = ${source};`, {
    entryRuleName: "Main",
    input: Input.Iterable(input),
    recovery,
  });
}

Deno.test("req:recover-001 - recover core semantics", async (t) => {
  await t.step("a matching child is the result", async () => {
    const m = await run(`ope "a" sneak by any`, "a");
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(unwrap(m.value), "a");
    assertEquals(m.recovered, undefined);
  });

  await t.step("a failing child fails with recovery disabled", async () => {
    const m = await run(`ope "a" sneak by any`, "x", false);
    assertEquals(m.kind, MatchKind.Fail);
  });

  await t.step(
    "a recovery yields the skip pattern's value and span",
    async () => {
      const m = await run(`(ope "a" sneak by (any -> "err")) "b"`, "xb");
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind !== MatchKind.Ok) return;
      assertEquals(m.recovered, true);
      assertEquals(unwrap(m.value), ["err", "b"]);
      assertEquals(await m.scope.stream.done(), true);
    },
  );

  await t.step("a skipped skip pattern yields a skipped recovery", async () => {
    const m = await run(`(ope "a" sneak by skip any) "b"`, "xb");
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(m.recovered, true);
    assertEquals(unwrap(m.value), ["b"]);
  });

  await t.step("a zero-width skip pattern does not recover", async () => {
    const m = await run(`ope "a" sneak by "x"?`, "y");
    assertEquals(m.kind, MatchKind.Fail);
  });
});
