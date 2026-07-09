import { assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";

Deno.test("req:uffda-language-syntax-004 - Import declarations cover empty module, multi-module, repeated-module, and one-or-more imported names", async (t) => {
  await t.step("module may contain no imports", async () => {
    const m = await uffdaGrammar("");
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value.declarations.length, 0);
    }
  });

  await t.step(
    "module may import from multiple different modules",
    async () => {
      const m = await uffdaGrammar('import "./a.ts" A; import "./b.ts" B;');
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind === MatchKind.Ok) {
        assertEquals(m.value.declarations, [
          { kind: "import", moduleUrl: "./a.ts", names: ["A"] },
          { kind: "import", moduleUrl: "./b.ts", names: ["B"] },
        ]);
      }
    },
  );

  await t.step("module may import the same module multiple times", async () => {
    const m = await uffdaGrammar('import "./a.ts" A; import "./a.ts" B;');
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value.declarations, [
        { kind: "import", moduleUrl: "./a.ts", names: ["A"] },
        { kind: "import", moduleUrl: "./a.ts", names: ["B"] },
      ]);
    }
  });

  await t.step(
    "single import declaration supports one or more imported names without commas",
    async () => {
      const one = await uffdaGrammar('import "./a.ts" A;');
      assertEquals(one.kind, MatchKind.Ok);
      if (one.kind === MatchKind.Ok) {
        assertEquals(one.value.declarations[0], {
          kind: "import",
          moduleUrl: "./a.ts",
          names: ["A"],
        });
      }

      const many = await uffdaGrammar('import "./a.ts" A B C;');
      assertEquals(many.kind, MatchKind.Ok);
      if (many.kind === MatchKind.Ok) {
        assertEquals(many.value.declarations[0], {
          kind: "import",
          moduleUrl: "./a.ts",
          names: ["A", "B", "C"],
        });
      }

      const commaSeparated = await uffdaGrammar('import "./a.ts" A, B, C;');
      assertEquals(commaSeparated.kind, MatchKind.Fail);
    },
  );
});
