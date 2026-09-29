import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { executeUffdaSource } from "../../lang/uffda/execute.ts";
import { unwrap } from "../../wrapped.ts";

async function run(source: string, input: Input) {
  return await executeUffdaSource(`export Main; rule Main = ${source};`, {
    entryRuleName: "Main",
    input,
  });
}

Deno.test("req:skip-001 - skip core semantics", async (t) => {
  await t.step("a matching child reports a skipped success", async () => {
    const m = await run(`skip ","`, Input.Iterable(","));
    assertEquals(m.kind, MatchKind.Skip);
    if (m.kind !== MatchKind.Skip) return;
    assertEquals(unwrap(m.value), undefined);
    assertEquals(await m.scope.stream.done(), true);
  });

  await t.step("a failing child fails without consuming", async () => {
    const m = await run(`skip ","`, Input.Iterable("x"));
    assertEquals(m.kind, MatchKind.Fail);
    if (m.kind !== MatchKind.Fail) return;
    assertEquals(await m.scope.stream.done(), false);
  });

  await t.step("the child's bindings are kept", async () => {
    const m = await run(`skip v:"," -> v`, Input.Iterable(","));
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(unwrap(m.value), ",");
  });

  await t.step("capturing a skip binds undefined", async () => {
    const m = await run(`v:skip "," -> v`, Input.Iterable(","));
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(unwrap(m.value), undefined);
  });
});
