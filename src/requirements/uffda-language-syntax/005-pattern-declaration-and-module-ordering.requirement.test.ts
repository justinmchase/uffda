import { assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";

Deno.test("req:uffda-language-syntax-005 - Rule declarations and module declaration ordering follow Uffda syntax contracts", async (t) => {
  await t.step("one rule pattern body appears per declaration", async () => {
    const onePattern = await uffdaGrammar("rule P any;");
    assertEquals(onePattern.kind, MatchKind.Ok);

    const multiplePatternBodies = await uffdaGrammar("rule P any end;");
    assertEquals(multiplePatternBodies.kind, MatchKind.Fail);
  });

  await t.step("projections are optional", async () => {
    const withoutProjection = await uffdaGrammar("rule P any;");
    assertEquals(withoutProjection.kind, MatchKind.Ok);
  });

  await t.step("imports must appear before rule declarations", async () => {
    const validOrder = await uffdaGrammar('import "./a.ts" A; rule P any;');
    assertEquals(validOrder.kind, MatchKind.Ok);

    const invalidOrder = await uffdaGrammar(
      'rule P any; import "./a.ts" A;',
    );
    assertEquals(invalidOrder.kind, MatchKind.Fail);
  });

  await t.step("declarations are separated by semicolons", async () => {
    const separated = await uffdaGrammar('import "./a.ts" A; rule P any;');
    assertEquals(separated.kind, MatchKind.Ok);

    const missingSeparator = await uffdaGrammar(
      'import "./a.ts" A rule P any;',
    );
    assertEquals(missingSeparator.kind, MatchKind.Fail);
  });

  await t.step("module source must be fully consumed", async () => {
    const trailing = await uffdaGrammar(
      'import "./a.ts" A; rule P any; trailing',
    );
    assertEquals(trailing.kind, MatchKind.Fail);
  });
});
