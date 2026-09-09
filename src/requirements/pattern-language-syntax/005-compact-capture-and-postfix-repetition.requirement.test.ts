import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { patternGrammar } from "../../lang/pattern/pattern.lang.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ValueSourceKind } from "../../runtime/patterns/value_source.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl =
  new URL("../../lang/pattern/pattern.lang.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name:
      "req:pattern-language-syntax-005 - compact capture and postfix repetition normalize to canonical patterns",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step(
      "capture binds a postfix repetition result",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("x:any*1..2"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Variable,
          name: "x",
          pattern: {
            kind: PatternKind.Quantifier,
            pattern: { kind: PatternKind.Any },
            min: { kind: ValueSourceKind.Literal, value: 1 },
            max: { kind: ValueSourceKind.Literal, value: 2 },
          },
        },
      }),
    );

    await t.step(
      "keyed fields can contain captures",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("{ field: x:any }"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {
            field: {
              kind: PatternKind.Variable,
              name: "x",
              pattern: { kind: PatternKind.Any },
            },
          },
        },
      }),
    );

    const repetitions = [
      ["any*", undefined, undefined],
      ["any*1", 1, undefined],
      ["any*1..2", 1, 2],
      ["any*1..", 1, undefined],
      ["any*..2", 0, 2],
      ["any*3..3", 3, 3],
      ["any+", 1, undefined],
    ] as const;

    for (const [source, min, max] of repetitions) {
      await t.step(
        `${source} preserves its repetition bounds`,
        moduleDeclarationTest({
          moduleUrl,
          entryRuleName: "PatternLang",
          input: Input.Scalar(source),
          kind: MatchKind.Ok,
          value: {
            kind: PatternKind.Quantifier,
            pattern: { kind: PatternKind.Any },
            min: min === undefined
              ? undefined
              : { kind: ValueSourceKind.Literal, value: min },
            max: max === undefined
              ? undefined
              : { kind: ValueSourceKind.Literal, value: max },
          },
        }),
      );
    }

    await t.step(
      "question mark remains scalar maybe syntax",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("any?"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Maybe,
          pattern: { kind: PatternKind.Any },
        },
      }),
    );

    await t.step(
      "capture binds less tightly than grouping",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("x:(any end)"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Variable,
          name: "x",
          pattern: {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Any },
              { kind: PatternKind.End },
            ],
          },
        },
      }),
    );

    await t.step(
      "descending bounds parse; quantifier rejects at use",
      async () => {
        const match = await patternGrammar("any*2..1");
        assertEquals(match.kind, MatchKind.Ok);
        if (match.kind !== MatchKind.Ok) return;
        assertEquals(match.value, {
          kind: PatternKind.Quantifier,
          pattern: { kind: PatternKind.Any },
          min: { kind: ValueSourceKind.Literal, value: 2 },
          max: { kind: ValueSourceKind.Literal, value: 1 },
        });
      },
    );

    await t.step("fractional bounds are rejected", async () => {
      const match = await patternGrammar("any*1.5");
      assertEquals(match.kind, MatchKind.Fail);
    });

    for (
      const source of [
        "any*..",
        "any**",
        "variable x any",
        "quantifier any (1, 2)",
      ]
    ) {
      await t.step(
        `${source} is rejected`,
        moduleDeclarationTest({
          moduleUrl,
          entryRuleName: "PatternLang",
          input: Input.Scalar(source),
          kind: MatchKind.Fail,
        }),
      );
    }
  },
);
