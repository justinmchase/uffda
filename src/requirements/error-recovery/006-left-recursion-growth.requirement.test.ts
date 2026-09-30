import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { executeUffdaSource } from "../../lang/uffda/execute.ts";
import { collectRecoveries } from "../../runtime/recovery.ts";

const members = `export Main;
rule Name = "a" | "b" | "c";
rule Group = "[" (ope Name sneak by until "]")* "]";
rule Member = (ope Primary sneak by until ".") "." Name;
rule Primary = Member | Group | Name;
rule Main = (ope Primary sneak by any+) end;`;

async function run(input: string) {
  return await executeUffdaSource(members, {
    entryRuleName: "Main",
    input: Input.Iterable(input),
  });
}

const spans = (m: Awaited<ReturnType<typeof run>>) =>
  collectRecoveries(m).map(({ match }) => [
    match.span.start.toString(),
    match.span.end.toString(),
  ]);

Deno.test("req:error-recovery-006 - left-recursion growth", async (t) => {
  await t.step(
    "a failure from reading a still-failing seed is not recovered",
    async () => {
      const m = await run("x.b");
      assertEquals(m.kind, MatchKind.Ok);
      assertEquals(spans(m), [["[0]", "[3]"]]);
    },
  );

  await t.step("syntax errors inside growth still recover", async () => {
    const m = await run("[a?b].c");
    assertEquals(m.kind, MatchKind.Ok);
    assertEquals(spans(m), [["[2]", "[4]"]]);
  });

  await t.step("clean growth is unaffected", async () => {
    const m = await run("a.b.c");
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(m.recovered, undefined);
  });
});
