import { assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { lit } from "../../runtime/patterns/value_source.ts";
import { uffdaGrammar } from "./uffda.lang.ts";
import { fromFileUrl, join } from "@std/path";

const uffdaDir = fromFileUrl(new URL(".", import.meta.url));

Deno.test({
  name: "lang.uffda.uffda-lang",
  fn: async (t) => {
    await t.step({
      name: "UFFDA_LANG_00 parses empty module scaffold",
      fn: async () => {
        const m = await uffdaGrammar("");
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, {
            kind: "module",
            declarations: [],
          });
        }
      },
    });

    await t.step({
      name:
        "UFFDA_LANG_01 parses import declaration with module source and alias",
      fn: async () => {
        const m = await uffdaGrammar('import "./a.ts" A;');
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, {
            kind: "module",
            declarations: [
              {
                kind: "import",
                moduleUrl: "./a.ts",
                names: ["A"],
              },
            ],
          });
        }
      },
    });

    await t.step({
      name: "UFFDA_LANG_01A rejects trailing tokens after declaration sequence",
      fn: async () => {
        const m = await uffdaGrammar('import "./a.ts" A; trailing');
        assertEquals(m.kind, MatchKind.Fail);
      },
    });

    await t.step({
      name: "UFFDA_LANG_01B parses multiple imports to different modules",
      fn: async () => {
        const m = await uffdaGrammar(
          'import "./a.ts" A; import "./b.ts" B;',
        );
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, {
            kind: "module",
            declarations: [
              {
                kind: "import",
                moduleUrl: "./a.ts",
                names: ["A"],
              },
              {
                kind: "import",
                moduleUrl: "./b.ts",
                names: ["B"],
              },
            ],
          });
        }
      },
    });

    await t.step({
      name: "UFFDA_LANG_01C parses repeated imports from the same module",
      fn: async () => {
        const m = await uffdaGrammar(
          'import "./a.ts" A; import "./a.ts" B;',
        );
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, {
            kind: "module",
            declarations: [
              {
                kind: "import",
                moduleUrl: "./a.ts",
                names: ["A"],
              },
              {
                kind: "import",
                moduleUrl: "./a.ts",
                names: ["B"],
              },
            ],
          });
        }
      },
    });

    await t.step({
      name:
        "UFFDA_LANG_01D parses one or more imported rule names without commas",
      fn: async () => {
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
    });

    await t.step({
      name: "UFFDA_LANG_02 includes carved syntactic element rules",
      fn: async () => {
        const uffdaLang = await Deno.readTextFile(
          join(uffdaDir, "uffda.lang.uff"),
        );
        assertEquals(
          uffdaLang.includes("ImportDeclarationSyntax"),
          true,
        );
        assertEquals(
          uffdaLang.includes("ExportDeclarationSyntax"),
          true,
        );
        assertEquals(
          uffdaLang.includes("RuleDeclarationSyntax"),
          true,
        );
        const runtimeCompiler = await Deno.readTextFile(
          join(uffdaDir, "runtime.compiler.uff"),
        );
        assertEquals(
          runtimeCompiler.includes("export UffdaRuntimeCompiler"),
          true,
        );
      },
    });

    await t.step({
      name: "UFFDA_LANG_04 parses one rule pattern body per declaration",
      fn: async () => {
        const one = await uffdaGrammar("rule P = any;");
        assertEquals(one.kind, MatchKind.Ok);
        if (one.kind === MatchKind.Ok) {
          assertEquals(one.value.declarations.length, 1);
          const declaration = one.value.declarations[0];
          if (!("kind" in declaration)) {
            throw new Error("expected rule declaration");
          }

          assertEquals(declaration.kind, "rule");
          if (declaration.kind === "rule") {
            assertEquals(declaration.name, "P");
            assertEquals(declaration.parameters, []);
            assertEquals(declaration.projection, undefined);
          }
        }

        const sequence = await uffdaGrammar('rule P = "." "." end;');
        assertEquals(sequence.kind, MatchKind.Ok);
        if (sequence.kind === MatchKind.Ok) {
          assertEquals(sequence.value.declarations[0], {
            kind: "rule",
            name: "P",
            parameters: [],
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                { kind: PatternKind.Equal, value: lit(".") },
                { kind: PatternKind.Equal, value: lit(".") },
                { kind: PatternKind.End },
              ],
            },
            projection: undefined,
          });
        }
      },
    });

    await t.step({
      name: "UFFDA_LANG_04A parses ordered rule parameter lists",
      fn: async () => {
        const empty = await uffdaGrammar("rule Wrap<> = any;");
        assertEquals(empty.kind, MatchKind.Ok);
        if (empty.kind === MatchKind.Ok) {
          assertEquals(empty.value.declarations[0], {
            kind: "rule",
            name: "Wrap",
            parameters: [],
            pattern: { kind: PatternKind.Any },
            projection: undefined,
          });
        }

        const params = await uffdaGrammar(
          "rule Surround<L, P, R> = L? p:P R? -> p;",
        );
        assertEquals(params.kind, MatchKind.Ok);
        if (params.kind === MatchKind.Ok) {
          const declaration = params.value.declarations[0];
          assertEquals(declaration.kind, "rule");
          if (declaration.kind === "rule") {
            assertEquals(declaration.name, "Surround");
            assertEquals(declaration.parameters, [
              { name: "L" },
              { name: "P" },
              { name: "R" },
            ]);
            assertEquals(declaration.projection, {
              kind: ExpressionKind.Reference,
              name: "p",
            });
          }
        }
      },
    });

    await t.step({
      name: "UFFDA_LANG_05 projection clauses are optional",
      fn: async () => {
        const withoutProjection = await uffdaGrammar("rule P = any;");
        assertEquals(withoutProjection.kind, MatchKind.Ok);

        const withProjection = await uffdaGrammar("rule P = any -> 1;");
        assertEquals(withProjection.kind, MatchKind.Ok);

        const multiTokenProjection = await uffdaGrammar(
          "rule P = any -> [1 2];",
        );
        assertEquals(multiTokenProjection.kind, MatchKind.Ok);

        const quotedDelimiters = await uffdaGrammar(
          'rule P = ";" "->" -> ";";',
        );
        assertEquals(quotedDelimiters.kind, MatchKind.Ok);

        // B15: `"\\"` must close correctly so a later rule's quotes do not
        // get swallowed by an open string from a prior rule.
        const backslashThenOtherRule = await uffdaGrammar(
          'rule Slash = "\\\\"; rule Other = "x" -> { kind: "ok" };',
        );
        assertEquals(backslashThenOtherRule.kind, MatchKind.Ok);

        const backslashInProjectionThenOther = await uffdaGrammar(
          'rule A = any -> "\\\\"; rule B = "x";',
        );
        assertEquals(backslashInProjectionThenOther.kind, MatchKind.Ok);
      },
    });

    await t.step({
      name: "UFFDA_LANG_06 imports must appear before rules",
      fn: async () => {
        const valid = await uffdaGrammar('import "./a.ts" A; rule P = any;');
        assertEquals(valid.kind, MatchKind.Ok);

        const invalid = await uffdaGrammar(
          'rule P = any; import "./a.ts" A;',
        );
        assertEquals(invalid.kind, MatchKind.Fail);
      },
    });

    await t.step({
      name: "UFFDA_LANG_07 declarations are separated by semicolons",
      fn: async () => {
        const valid = await uffdaGrammar('import "./a.ts" A; rule P = any;');
        assertEquals(valid.kind, MatchKind.Ok);

        const missingSeparator = await uffdaGrammar(
          'import "./a.ts" A rule P = any;',
        );
        assertEquals(missingSeparator.kind, MatchKind.Fail);
      },
    });

    await t.step({
      name: "UFFDA_LANG_03 integrates PatternLang and ExpressionLang slots",
      fn: async () => {
        const ruleRules = await Deno.readTextFile(
          join(
            fromFileUrl(new URL(".", import.meta.url)),
            "rule.rules.uff",
          ),
        );
        assertEquals(
          ruleRules.includes(
            'import "../pattern/pattern.lang.uff" PatternTokens',
          ),
          true,
        );
        assertEquals(
          ruleRules.includes(
            'import "../expression/expression.lang.uff" ExpressionTokens',
          ),
          true,
        );
        assertEquals(ruleRules.includes("|> PatternTokens"), true);
        assertEquals(ruleRules.includes("|> ExpressionTokens"), true);
      },
    });
  },
});
