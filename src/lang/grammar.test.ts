import { assertEquals } from "@std/assert";
import { MatchKind } from "../match.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import type { Pattern } from "../runtime/patterns/pattern.ts";
import { expressionGrammar } from "./expression/expression.lang.ts";
import { parseGrammar } from "./grammar.ts";
import { exec } from "../runtime/exec.ts";

Deno.test({
  name: "lang.grammar.parseGrammar",
  fn: async (t) => {
    await t.step({
      name: "GRAMMAR_00 parses pattern language entry rule",
      fn: async () => {
        const m = await parseGrammar<Pattern>({
          source: "any",
          moduleUrl: new URL("./pattern/pattern.lang.uff", import.meta.url),
          entryRuleName: "PatternLang",
        });

        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, { kind: PatternKind.Any });
        }
      },
    });

    await t.step({
      name: "GRAMMAR_01 preserves entrypoint full-consumption behavior",
      fn: async () => {
        const m = await parseGrammar<Pattern>({
          source: "any )",
          moduleUrl: new URL("./pattern/pattern.lang.uff", import.meta.url),
          entryRuleName: "PatternLang",
        });

        assertEquals(m.kind, MatchKind.Fail);
      },
    });

    await t.step({
      name: "GRAMMAR_02 merges caller globals over std without dropping std",
      fn: async () => {
        // Identifier projections need std.join/flat while caller globals supply
        // expression locals such as `user`.
        const m = await expressionGrammar("user", {
          globals: new Map([["user", "ok"]]),
        });
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(await exec(m.value, m), "ok");
        }
      },
    });
  },
});
