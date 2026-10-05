import { assert, assertEquals } from "@std/assert";
import { isClean, MatchKind, valueOf } from "../match.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import type { Pattern } from "../runtime/patterns/pattern.ts";
import { expressionGrammar } from "./expression/expression.lang.ts";
import { parseGrammar, resolveGrammarModule } from "./grammar.ts";
import { exec } from "../runtime/exec.ts";
import { unwrap } from "../wrapped.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { ExportDeclarationKind } from "../runtime/declarations/export.ts";
import { lit } from "../runtime/patterns/value_source.ts";

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
          assertEquals(unwrap(m.value), { kind: PatternKind.Any });
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

        assertEquals(isClean(m), false);
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
          assertEquals(unwrap(await exec(valueOf(m), m)), "ok");
        }
      },
    });

    await t.step({
      name: "GRAMMAR_03 parses with two-phase recovery",
      fn: async () => {
        const moduleUrl = new URL("file:///grammar.recovery.uff");
        const declarations: Record<string, ModuleDeclaration> = {
          [moduleUrl.href]: {
            imports: [],
            exports: [{
              kind: ExportDeclarationKind.Rule,
              name: "Main",
              default: true,
            }],
            rules: [{
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Into,
                pattern: {
                  kind: PatternKind.Then,
                  patterns: [
                    {
                      kind: PatternKind.Quantifier,
                      pattern: {
                        kind: PatternKind.Recover,
                        pattern: { kind: PatternKind.Equal, value: lit("a") },
                        skip: { kind: PatternKind.Any },
                      },
                    },
                    { kind: PatternKind.End },
                  ],
                },
              },
            }],
          },
        };
        const parse = (source: string) =>
          parseGrammar({
            source,
            moduleUrl,
            entryRuleName: "Main",
            grammarOptions: { declarations },
          });

        const clean = await parse("aa");
        assertEquals(clean.kind, MatchKind.Ok);
        if (clean.kind !== MatchKind.Ok) return;
        assertEquals(clean.recovered, undefined);

        const recovered = await parse("axa");
        assertEquals(recovered.kind, MatchKind.Ok);
        if (recovered.kind !== MatchKind.Ok) return;
        assertEquals(recovered.recovered, true);
        assertEquals(unwrap(recovered.value), [["a", "x", "a"], undefined]);
      },
    });
  },
});

Deno.test("lang.grammar.resolveGrammarModule without an entry rule", async () => {
  const resolved = await resolveGrammarModule({
    moduleUrl: new URL("./uffda/uffda.lang.uff", import.meta.url),
  });
  assert(resolved.ok);
  assert(resolved.resolved.module.exports.has("UffdaLang"));
});
