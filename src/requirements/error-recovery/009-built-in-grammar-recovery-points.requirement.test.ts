import { assert, assertEquals } from "@std/assert";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";
import { patternGrammar } from "../../lang/pattern/pattern.lang.ts";
import { expressionGrammar } from "../../lang/expression/expression.lang.ts";
import { isSuccess, type Match, MatchKind, valueOf } from "../../match.ts";
import { collectRecoveries } from "../../runtime/recovery.ts";

const skipped = (source: string, match: Match) =>
  collectRecoveries(match).map(({ match: { originalSpan } }) =>
    source.slice(originalSpan.start, originalSpan.end)
  );

Deno.test("req:error-recovery-009 - built-in grammar recovery points", async (t) => {
  await t.step(
    "without recovery a parse succeeds cleanly or fails",
    async () => {
      assertEquals((await uffdaGrammar("rule A = ;")).kind, MatchKind.Fail);
      assertEquals((await patternGrammar("a ! b")).kind, MatchKind.Fail);
      assertEquals((await expressionGrammar("(f ?)")).kind, MatchKind.Fail);
    },
  );

  await t.step("accepted source parses cleanly with recovery", async () => {
    const source =
      'import "a" A;\nexport B;\nrule B = a b -> (f [1 2] { k: 3 });';
    const plain = await uffdaGrammar(source);
    const recovering = await uffdaGrammar(source, { recovery: true });
    assert(isSuccess(plain) && isSuccess(recovering));
    assertEquals(recovering.recovered, undefined);
    assertEquals(valueOf(recovering), valueOf(plain));
  });

  await t.step("broken declarations are skipped, the rest kept", async () => {
    const source = [
      'import "a" A;',
      'import "b";',
      'import "c" C;',
      "rule D = ;",
      "rule E = e",
      "rule F = f ! g;",
      "rule G = g -> (h x ? y);",
    ].join("\n");
    const match = await uffdaGrammar(source, { recovery: true });
    assert(isSuccess(match));
    assertEquals(skipped(source, match), [
      'import "b";',
      "rule D = ;",
      "rule E = e",
      "!",
      "?",
    ]);
    assertEquals(
      valueOf(match).declarations.map((d) =>
        d.kind === "import" ? d.moduleUrl : d.name
      ),
      ["a", "c", "F", "G"],
    );
  });
});
