import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { executeUffdaSource } from "../../lang/uffda/execute.ts";
import { collectRecoveries } from "../../runtime/recovery.ts";

const statements = `export Main;
rule Stmt = ope ("a" "b") sneak by until ";";
rule Main = (Stmt ";")* end;`;

async function run(input: string) {
  return await executeUffdaSource(statements, {
    entryRuleName: "Main",
    input: Input.Iterable(input),
  });
}

const spans = (m: Awaited<ReturnType<typeof run>>) =>
  collectRecoveries(m).map(({ match }) => [
    match.span.start.toString(),
    match.span.end.toString(),
  ]);

Deno.test("req:error-recovery-001 - two-phase matching", async (t) => {
  await t.step("a clean parse is unchanged by recovery", async () => {
    const m = await run("ab;ab;");
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(m.recovered, undefined);
    assertEquals(m.scope.recovery, false);
  });

  await t.step("a failed parse recovers in the second phase", async () => {
    const m = await run("ab;xx;ab;");
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(m.recovered, true);
    assertEquals(spans(m), [["[3]", "[5]"]]);
  });

  await t.step(
    "a failure without a failed recovery point skips the second phase",
    async () => {
      const m = await run("ab;ab");
      assertEquals(m.kind, MatchKind.Fail);
      assertEquals(m.scope.recovery, false);
    },
  );
});
