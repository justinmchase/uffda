import { assert, assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { lit } from "../../runtime/patterns/value_source.ts";
import { uffdaGrammar, type UffdaSyntaxModule } from "./uffda.lang.ts";
import { fromFileUrl, join } from "@std/path";
import { Input, InputNormalizationMode } from "../../input.ts";
import { Path } from "../../path.ts";
import type { Edit } from "../../edit.ts";
import { rehydrateMemos } from "../../runtime/incremental.ts";
import { unwrap } from "../../wrapped.ts";
import { isSuccess, type Match, valueOf } from "../../match.ts";
import { collectRecoveries } from "../../runtime/recovery.ts";

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
          assertEquals(unwrap(m.value), {
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
          assertEquals(unwrap(m.value), {
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
          assertEquals(unwrap(m.value), {
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
          assertEquals(unwrap(m.value), {
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
          assertEquals(valueOf(one).declarations[0], {
            kind: "import",
            moduleUrl: "./a.ts",
            names: ["A"],
          });
        }

        const many = await uffdaGrammar('import "./a.ts" A B C;');
        assertEquals(many.kind, MatchKind.Ok);
        if (many.kind === MatchKind.Ok) {
          assertEquals(valueOf(many).declarations[0], {
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
          assertEquals(valueOf(one).declarations.length, 1);
          const declaration = valueOf(one).declarations[0];
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
          assertEquals(valueOf(sequence).declarations[0], {
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
            attributes: [],
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
          assertEquals(valueOf(empty).declarations[0], {
            kind: "rule",
            name: "Wrap",
            parameters: [],
            pattern: { kind: PatternKind.Any },
            projection: undefined,
            attributes: [],
          });
        }

        const params = await uffdaGrammar(
          "rule Surround<L, P, R> = L? p:P R? -> p;",
        );
        assertEquals(params.kind, MatchKind.Ok);
        if (params.kind === MatchKind.Ok) {
          const declaration = valueOf(params).declarations[0];
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
    await t.step({
      name:
        "UFFDA_LANG_08 incremental re-parse (rehydrated memos + fresh input) matches a full re-parse",
      fn: async () => {
        const before = 'rule First = "a"; rule Second = "b";';
        const priorMatch = await uffdaGrammar(before);
        assertEquals(priorMatch.kind, MatchKind.Ok);
        if (priorMatch.kind !== MatchKind.Ok) return;

        // Edit near the end: change the second rule's matched literal,
        // leaving the first rule's declaration entirely untouched.
        const editAt = before.indexOf('"b"');
        const after = before.slice(0, editAt) + '"c"' +
          before.slice(editAt + 3);

        const freshInput = Input.From(after, {
          kind: InputNormalizationMode.Scalar,
        });
        const edit: Edit = {
          at: Path.Default().set(editAt),
          removed: 3,
          inserted: 3,
        };
        const memos = await rehydrateMemos(priorMatch, edit, freshInput);

        const incremental = await uffdaGrammar(after, {
          memos,
          input: freshInput,
        });
        const full = await uffdaGrammar(after);

        assertEquals(incremental.kind, MatchKind.Ok);
        assertEquals(full.kind, MatchKind.Ok);
        if (incremental.kind === MatchKind.Ok && full.kind === MatchKind.Ok) {
          assertEquals(unwrap(incremental.value), unwrap(full.value));
          assertEquals(unwrap(incremental.value), {
            kind: "module",
            declarations: [
              {
                kind: "rule",
                name: "First",
                parameters: [],
                pattern: { kind: PatternKind.Equal, value: lit("a") },
                projection: undefined,
                attributes: [],
              },
              {
                kind: "rule",
                name: "Second",
                parameters: [],
                pattern: { kind: PatternKind.Equal, value: lit("c") },
                projection: undefined,
                attributes: [],
              },
            ],
          });
        }
      },
    });
  },
});

const skipped = (source: string, match: Match) =>
  collectRecoveries(match).map(({ match: { originalSpan } }) =>
    source.slice(originalSpan.start, originalSpan.end)
  );

const declarationNames = (match: Match<UffdaSyntaxModule>) => {
  assert(isSuccess(match));
  return valueOf(match).declarations.map((d) =>
    d.kind === "import" ? `import ${d.moduleUrl}` : `${d.kind} ${d.name}`
  );
};

Deno.test("lang.uffda.uffda-lang recovery points", async (t) => {
  const cases: {
    name: string;
    source: string;
    skipped: string[];
    declarations: string[];
  }[] = [
    {
      name: "a broken import between imports",
      source: 'import "a" A;\nimport "b";\nimport "c" C;\nrule R = any;',
      skipped: ['import "b";'],
      declarations: ["import a", "import c", "rule R"],
    },
    {
      name: "a broken export before exports",
      source: "export ;\nexport B;\nrule B = any;",
      skipped: ["export ;"],
      declarations: ["export B", "rule B"],
    },
    {
      name: "a missing `;` before the next declaration",
      source: "rule A = a\nrule B = b;",
      skipped: ["rule A = a"],
      declarations: ["rule B"],
    },
    {
      name: "a missing `;` after a projection",
      source: "rule A = a -> 1\nfunc F = 2;",
      skipped: ["rule A = a -> 1"],
      declarations: ["func F"],
    },
    {
      name: "a missing `;` after a func body",
      source: "func F = 1\ndecorator D = 2;",
      skipped: ["func F = 1"],
      declarations: ["decorator D"],
    },
    {
      name: "a stray `;`",
      source: "rule A = a;;\nrule B = b;",
      skipped: [";"],
      declarations: ["rule A", "rule B"],
    },
    {
      name: "a broken declaration quoting a keyword",
      source: 'rule A = ) "rule";\nrule B = b;',
      skipped: ['rule A = ) "rule";'],
      declarations: ["rule B"],
    },
    {
      name: "a stray token inside a rule body",
      source: "rule A = a ! b;\nrule B = b;",
      skipped: ["!"],
      declarations: ["rule A", "rule B"],
    },
  ];
  for (const c of cases) {
    await t.step(c.name, async () => {
      assertEquals((await uffdaGrammar(c.source)).kind, MatchKind.Fail);
      const match = await uffdaGrammar(c.source, { recovery: true });
      assertEquals(skipped(c.source, match), c.skipped);
      assertEquals(declarationNames(match), c.declarations);
    });
  }

  await t.step("clean modules parse without recovering", async () => {
    const source = 'import "a" A;\nexport B;\nrule B = x:any -> { rule: x };';
    const match = await uffdaGrammar(source, { recovery: true });
    assert(isSuccess(match));
    assertEquals(match.recovered, undefined);
    assertEquals(declarationNames(match), ["import a", "export B", "rule B"]);
  });
});
