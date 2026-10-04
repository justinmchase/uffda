import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { explainedMistakesTest, moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./structure.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.structure",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "STRUCTURE_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Structure",
        input: Input.Iterable([
          "{",
          "name",
          ":",
          "any",
          ",",
          "enabled",
          ":",
          "end",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {
            name: { kind: PatternKind.Any },
            enabled: { kind: PatternKind.End },
          },
        },
      }),
    });

    await t.step({
      name: "STRUCTURE_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Structure",
        input: Input.Iterable([
          "{",
          "name",
          ":",
          "any",
          ",",
          "enabled",
          ":",
          "end",
          ",",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {
            name: { kind: PatternKind.Any },
            enabled: { kind: PatternKind.End },
          },
        },
      }),
    });
  },
});

Deno.test(
  "lang.pattern.structure explains mistakes where they occur",
  explainedMistakesTest([
    ["rule A = (a‸;", "Expected `)` here to close the group"],
    ["rule A = {a: x‸;", "Expected `}` here to close the object pattern"],
    ["rule A = { a ‸};", "Each entry of an object pattern is a key"],
  ]),
);
