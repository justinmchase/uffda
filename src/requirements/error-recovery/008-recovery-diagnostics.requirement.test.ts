import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { executeUffdaSource } from "../../lang/uffda/execute.ts";
import { diagnoseRecoveries } from "../../match.recovery_diagnostics.ts";

const statements = `export Main;
rule Stmt = ope ("a" "b") sneak by until ";";
rule Main = (Stmt ";")* end;`;

async function diagnose(input: string) {
  const m = await executeUffdaSource(statements, {
    entryRuleName: "Main",
    input: Input.Iterable(input),
  });
  return {
    kind: m.kind,
    diagnostics: (await diagnoseRecoveries(m)).map(({ span, message }) => ({
      span,
      message,
    })),
  };
}

Deno.test("req:error-recovery-008 - recovery diagnostics", async (t) => {
  await t.step("a clean success has no diagnostics", async () => {
    assertEquals(await diagnose("ab;"), {
      kind: MatchKind.Ok,
      diagnostics: [],
    });
  });

  await t.step(
    "each recovery is ranged over the skipped source with its failure's analysis",
    async () => {
      assertEquals(await diagnose("xx;ab;"), {
        kind: MatchKind.Ok,
        diagnostics: [{
          span: { start: 0, end: 2 },
          message: 'Expected "a"\nUnexpected "x"\nIn Stmt',
        }],
      });
    },
  );

  await t.step("diagnostics are in document order", async () => {
    const { diagnostics } = await diagnose("xx;ab;ay;");
    assertEquals(diagnostics.map(({ span }) => span), [
      { start: 0, end: 2 },
      { start: 6, end: 8 },
    ]);
  });
});
