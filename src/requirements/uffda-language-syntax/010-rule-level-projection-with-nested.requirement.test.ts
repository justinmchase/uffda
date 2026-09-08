import { assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";

Deno.test(
  "req:uffda-language-syntax-010 - Rule-level projection coexists with nested Projection",
  async (t) => {
    await t.step("group-less rule projection still parses", async () => {
      const m = await uffdaGrammar("rule P = any -> 1;");
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind === MatchKind.Ok) {
        const decl = (m.value as {
          declarations: Array<{
            kind: string;
            pattern: unknown;
            projection?: unknown;
          }>;
        }).declarations[0];
        assertEquals(decl.kind, "rule");
        assertEquals(decl.pattern, { kind: PatternKind.Any });
        assertEquals(decl.projection, {
          kind: ExpressionKind.Number,
          value: 1,
        });
      }
    });

    await t.step(
      "grouped nested projection under or parses without rule-level projection",
      async () => {
        const m = await uffdaGrammar("rule M = (any -> 1) | fail;");
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          const decl = (m.value as {
            declarations: Array<{
              kind: string;
              pattern: unknown;
              projection?: unknown;
            }>;
          }).declarations[0];
          assertEquals(decl.kind, "rule");
          assertEquals(decl.projection, undefined);
          assertEquals(decl.pattern, {
            kind: PatternKind.Or,
            patterns: [
              {
                kind: PatternKind.Projection,
                pattern: { kind: PatternKind.Any },
                expression: { kind: ExpressionKind.Number, value: 1 },
              },
              { kind: PatternKind.Fail },
            ],
          });
        }
      },
    );
  },
);
