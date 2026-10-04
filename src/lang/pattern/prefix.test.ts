import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ValueSourceKind } from "../../runtime/patterns/value_source.ts";
import { explainedMistakesTest, moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./prefix.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.prefix",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "PREFIX_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Prefix",
        input: Input.Iterable(["any", "*", "1", ".", ".", "3"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Quantifier,
          pattern: { kind: PatternKind.Any },
          min: { kind: ValueSourceKind.Literal, value: 1 },
          max: { kind: ValueSourceKind.Literal, value: 3 },
        },
      }),
    });

    await t.step({
      name: "PREFIX_01_star_bare",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Prefix",
        input: Input.Iterable(["any", "*"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Quantifier,
          pattern: { kind: PatternKind.Any },
          min: undefined,
          max: undefined,
        },
      }),
    });

    await t.step({
      name: "PREFIX_02_star_min_open",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Prefix",
        input: Input.Iterable(["any", "*", "1", ".", "."]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Quantifier,
          pattern: { kind: PatternKind.Any },
          min: { kind: ValueSourceKind.Literal, value: 1 },
          max: undefined,
        },
      }),
    });

    await t.step({
      name: "PREFIX_03_star_max_only",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Prefix",
        input: Input.Iterable(["any", "*", ".", ".", "2"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Quantifier,
          pattern: { kind: PatternKind.Any },
          min: { kind: ValueSourceKind.Literal, value: 0 },
          max: { kind: ValueSourceKind.Literal, value: 2 },
        },
      }),
    });

    await t.step({
      name: "PREFIX_04_star_min_variable",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Prefix",
        input: Input.Iterable(["any", "*", "$", "n"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Quantifier,
          pattern: { kind: PatternKind.Any },
          min: { kind: ValueSourceKind.Variable, name: "n" },
          max: undefined,
        },
      }),
    });

    await t.step({
      name: "PREFIX_05_star_minmax_variables",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Prefix",
        input: Input.Iterable(["any", "*", "$", "min", ".", ".", "$", "max"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Quantifier,
          pattern: { kind: PatternKind.Any },
          min: { kind: ValueSourceKind.Variable, name: "min" },
          max: { kind: ValueSourceKind.Variable, name: "max" },
        },
      }),
    });

    await t.step({
      name: "PREFIX_06_star_minmax_descending_digits_fail",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Star",
        input: Input.Iterable(["any", "*", "2", ".", ".", "1"]),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "PREFIX_07_skip_operand",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Prefix",
        input: Input.Iterable(["skip", "any", "*"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Skip,
          pattern: {
            kind: PatternKind.Quantifier,
            pattern: { kind: PatternKind.Any },
            min: undefined,
            max: undefined,
          },
        },
      }),
    });

    await t.step({
      name: "PREFIX_08_skip_bare",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Prefix",
        input: Input.Iterable(["skip"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Any },
        },
      }),
    });

    await t.step({
      name: "PREFIX_09_skip_nested",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Prefix",
        input: Input.Iterable(["skip", "skip"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Skip,
          pattern: {
            kind: PatternKind.Skip,
            pattern: { kind: PatternKind.Any },
          },
        },
      }),
    });

    await t.step({
      name: "PREFIX_10_ope",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Prefix",
        input: Input.Iterable(["ope", "any", "sneak", "by", "skip"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Recover,
          pattern: { kind: PatternKind.Any },
          skip: { kind: PatternKind.Skip, pattern: { kind: PatternKind.Any } },
        },
      }),
    });

    await t.step({
      name: "PREFIX_11_ope_until",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Prefix",
        input: Input.Iterable(["ope", "any", "sneak", "by", "until", "any"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Recover,
          pattern: { kind: PatternKind.Any },
          skip: {
            kind: PatternKind.Quantifier,
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                { kind: PatternKind.Not, pattern: { kind: PatternKind.Any } },
                { kind: PatternKind.Any },
              ],
            },
            min: { kind: ValueSourceKind.Literal, value: 1 },
            max: undefined,
          },
        },
      }),
    });

    await t.step({
      name: "PREFIX_12_ope_requires_sneak_by",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Prefix",
        input: Input.Iterable(["ope", "any", "any"]),
        kind: MatchKind.Fail,
      }),
    });
  },
});

Deno.test(
  "lang.pattern.prefix explains mistakes where they occur",
  explainedMistakesTest([
    ["rule A = ope a‸;", "`ope` and its pattern must be followed"],
    ["rule A = ope a sneak by‸;", "`sneak by` must be followed"],
    ["rule A = a*..‸;", "A repetition bound is"],
    ["rule A = a |‸;", "Expected a pattern here"],
  ]),
);
