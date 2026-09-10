import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ValueSourceKind } from "../../runtime/patterns/value_source.ts";
import { moduleDeclarationTest } from "../../test.ts";

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
  },
});
