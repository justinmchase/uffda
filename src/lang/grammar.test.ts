import { assertEquals } from "@std/assert";
import { MatchKind } from "../match.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import type { Pattern } from "../runtime/patterns/pattern.ts";
import { parseGrammar } from "./grammar.ts";

Deno.test({
  name: "lang.grammar.parseGrammar",
  fn: async (t) => {
    await t.step({
      name: "GRAMMAR_00 parses pattern language entry rule",
      fn: async () => {
        const m = await parseGrammar<Pattern>({
          source: "any",
          moduleUrl: new URL("./pattern/pattern.lang.ts", import.meta.url),
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
          moduleUrl: new URL("./pattern/pattern.lang.ts", import.meta.url),
          entryRuleName: "PatternLang",
        });

        assertEquals(m.kind, MatchKind.Fail);
      },
    });
  },
});
