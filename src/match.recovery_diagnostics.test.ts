import { assertEquals } from "@std/assert";
import { Input } from "./input.ts";
import { MatchKind } from "./match.ts";
import { executeUffdaSource } from "./lang/uffda/execute.ts";
import { diagnoseRecoveries } from "./match.recovery_diagnostics.ts";

async function run(source: string, input: Input) {
  return await executeUffdaSource(source, {
    entryRuleName: "Main",
    input,
    recovery: true,
  });
}

const statements = `export Main;
rule Stmt = ope ("a" "b") sneak by until ";";
rule Main = (Stmt ";")* end;`;

Deno.test("match.recovery_diagnostics", async (t) => {
  await t.step(
    "RECOVERY_DIAGNOSTICS00 - a clean parse has no diagnostics",
    async () => {
      const m = await run(statements, Input.Iterable("ab;ab;"));
      assertEquals(m.kind, MatchKind.Ok);
      assertEquals(await diagnoseRecoveries(m), []);
    },
  );

  await t.step(
    "RECOVERY_DIAGNOSTICS01 - one diagnostic per recovery, in document order",
    async () => {
      const m = await run(statements, Input.Iterable("ab;xx;ab;axb;"));
      assertEquals(m.kind, MatchKind.Ok);
      const diagnostics = await diagnoseRecoveries(m);
      assertEquals(
        diagnostics.map(({ span, message }) => ({ span, message })),
        [
          {
            span: { start: 3, end: 5 },
            message: 'Expected "a"\nUnexpected "x"\nIn Stmt',
          },
          {
            span: { start: 9, end: 12 },
            message: 'Expected "b"\nUnexpected "x"\nIn Stmt',
          },
        ],
      );
      assertEquals(diagnostics[0].analysis?.rules.includes("Stmt"), true);
    },
  );

  await t.step(
    "RECOVERY_DIAGNOSTICS02 - spans are source offsets through pipeline stages",
    async () => {
      const m = await run(
        `export Main; rule Tok = ope "a" sneak by any; rule Main = string |> [Tok*];`,
        Input.Scalar("aaxa"),
      );
      assertEquals(m.kind, MatchKind.Ok);
      const [diagnostic] = await diagnoseRecoveries(m);
      assertEquals(diagnostic.span, { start: 2, end: 3 });
    },
  );

  await t.step(
    "RECOVERY_DIAGNOSTICS03 - recoveries beneath a failed parse are diagnosed",
    async () => {
      const m = await run(statements, Input.Iterable("xx;;"));
      assertEquals(m.kind, MatchKind.Fail);
      const diagnostics = await diagnoseRecoveries(m);
      assertEquals(diagnostics.map(({ span }) => span), [{
        start: 0,
        end: 2,
      }]);
    },
  );
});
