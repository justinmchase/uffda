import { assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { uffdaGrammar, UffdaLang } from "./uffda.lang.ts";
import { RuleDeclarationRules } from "./rule.rules.ts";

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
      fn: () => {
        const names = UffdaLang.imports
          .filter((i) => i.kind === ImportDeclarationKind.Module)
          .flatMap((i) => i.names);
        assertEquals(names.includes("ImportDeclarationSyntax"), true);
        assertEquals(names.includes("ExportDeclarationSyntax"), true);
        assertEquals(names.includes("RuleDeclarationSyntax"), true);
      },
    });

    await t.step({
      name: "UFFDA_LANG_04 parses one rule pattern body per declaration",
      fn: async () => {
        const one = await uffdaGrammar("rule P any;");
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
            assertEquals(declaration.projection, undefined);
          }
        }

        const notOne = await uffdaGrammar("rule P any end;");
        assertEquals(notOne.kind, MatchKind.Fail);
      },
    });

    await t.step({
      name: "UFFDA_LANG_05 projection clauses are optional",
      fn: async () => {
        const withoutProjection = await uffdaGrammar("rule P any;");
        assertEquals(withoutProjection.kind, MatchKind.Ok);

        const withProjection = await uffdaGrammar("rule P any -> 1;");
        assertEquals(withProjection.kind, MatchKind.Ok);
      },
    });

    await t.step({
      name: "UFFDA_LANG_06 imports must appear before rules",
      fn: async () => {
        const valid = await uffdaGrammar('import "./a.ts" A; rule P any;');
        assertEquals(valid.kind, MatchKind.Ok);

        const invalid = await uffdaGrammar(
          'rule P any; import "./a.ts" A;',
        );
        assertEquals(invalid.kind, MatchKind.Fail);
      },
    });

    await t.step({
      name: "UFFDA_LANG_07 declarations are separated by semicolons",
      fn: async () => {
        const valid = await uffdaGrammar('import "./a.ts" A; rule P any;');
        assertEquals(valid.kind, MatchKind.Ok);

        const missingSeparator = await uffdaGrammar(
          'import "./a.ts" A rule P any;',
        );
        assertEquals(missingSeparator.kind, MatchKind.Fail);
      },
    });

    await t.step({
      name: "UFFDA_LANG_03 integrates PatternLang and ExpressionLang slots",
      fn: () => {
        const patternRule = RuleDeclarationRules.rules.find((r) =>
          r.name === "RulePatternBody"
        );
        const projectionRule = RuleDeclarationRules.rules.find((r) =>
          r.name === "RuleProjectionExpression"
        );

        if (!patternRule || !projectionRule) {
          throw new Error("Expected integration rules to be declared");
        }

        assertEquals(patternRule.pattern.kind, PatternKind.Or);
        if (patternRule.pattern.kind === PatternKind.Or) {
          const delegated = patternRule.pattern.patterns.find((p) =>
            p.kind === PatternKind.Resolve &&
            p.targetKind === ResolveTargetKind.Reference &&
            p.name === "PatternLang"
          );
          assertEquals(Boolean(delegated), true);
        }

        assertEquals(projectionRule.pattern.kind, PatternKind.Resolve);
        if (projectionRule.pattern.kind === PatternKind.Resolve) {
          assertEquals(
            projectionRule.pattern.targetKind,
            ResolveTargetKind.Reference,
          );
        }
        if (
          projectionRule.pattern.kind === PatternKind.Resolve &&
          projectionRule.pattern.targetKind === ResolveTargetKind.Reference
        ) {
          assertEquals(projectionRule.pattern.name, "ExpressionLang");
        }
      },
    });
  },
});
