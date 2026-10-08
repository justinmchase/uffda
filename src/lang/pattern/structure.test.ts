import { Input } from "../../input.ts";
import { Type } from "@justinmchase/type";
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

    await t.step({
      name:
        "req:pattern-language-syntax-011 - STRUCTURE_02 parses rest-only object patterns",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Structure",
        input: Input.Iterable([
          "{",
          ".",
          ".",
          ".",
          "(",
          "string",
          ":",
          "string",
          ")",
          ",",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {},
          rest: {
            key: { kind: PatternKind.Type, type: Type.String },
            value: { kind: PatternKind.Type, type: Type.String },
          },
        },
      }),
    });

    await t.step({
      name:
        "req:pattern-language-syntax-011 - STRUCTURE_03 parses named keys followed by rest",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Structure",
        input: Input.Iterable([
          "{",
          "id",
          ":",
          "number",
          ",",
          ".",
          ".",
          ".",
          "(",
          "string",
          ":",
          "string",
          ")",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {
            id: { kind: PatternKind.Type, type: Type.Number },
          },
          rest: {
            key: { kind: PatternKind.Type, type: Type.String },
            value: { kind: PatternKind.Type, type: Type.String },
          },
        },
      }),
    });

    await t.step({
      name:
        "req:pattern-language-syntax-011 - STRUCTURE_04 parses grouped key captures",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Structure",
        input: Input.Iterable([
          "{",
          ".",
          ".",
          ".",
          "(",
          "(",
          "name",
          ":",
          "string",
          ")",
          ":",
          "any",
          ")",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {},
          rest: {
            key: {
              kind: PatternKind.Variable,
              name: "name",
              pattern: { kind: PatternKind.Type, type: Type.String },
            },
            value: { kind: PatternKind.Any },
          },
        },
      }),
    });

    await t.step({
      name:
        "req:pattern-language-syntax-011 - STRUCTURE_05 rejects entries after rest",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Structure",
        input: Input.Iterable([
          "{",
          ".",
          ".",
          ".",
          "(",
          "string",
          ":",
          "string",
          ")",
          ",",
          "name",
          ":",
          "any",
          "}",
        ]),
        kind: MatchKind.Fail,
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
    [
      "rule A = { ...(string ‸string) };",
      "Expected `:` here between the object rest-entry key pattern and value pattern.",
    ],
  ]),
);
