import { assert, assertEquals } from "@std/assert";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";
import { patternGrammar } from "../../lang/pattern/pattern.lang.ts";
import { expressionGrammar } from "../../lang/expression/expression.lang.ts";
import { isClean, isSuccess, type Match, valueOf } from "../../match.ts";
import { collectRecoveries } from "../../runtime/recovery.ts";

const skipped = (source: string, match: Match) =>
  collectRecoveries(match).map(({ match: { originalSpan } }) =>
    source.slice(originalSpan.start, originalSpan.end)
  );

Deno.test("req:error-recovery-009 - built-in grammar recovery points", async (t) => {
  await t.step("accepted source parses cleanly", async () => {
    for (
      const clean of [
        await uffdaGrammar(
          'import "a" A;\nexport B;\nrule B = a b -> (f [1 2] { k: 3 });',
        ),
        await patternGrammar("a (b | c)* -> [1 2]"),
        await expressionGrammar("(f [1 2] { k: 3 })"),
      ]
    ) {
      assertEquals(isClean(clean), true);
    }
  });

  await t.step("a broken pattern or expression recovers", async () => {
    assertEquals(skipped("a ! b", await patternGrammar("a ! b")), ["!"]);
    assertEquals(skipped("(f ?)", await expressionGrammar("(f ?)")), ["?"]);
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
    const match = await uffdaGrammar(source);
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
