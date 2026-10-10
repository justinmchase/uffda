import { Input } from "../../input.ts";
import { assertEquals } from "@std/assert";
import { Type } from "@justinmchase/type";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { explainedMistakesTest, moduleDeclarationTest } from "../../test.ts";
import { executeUffdaSource } from "../uffda/execute.ts";
import { unwrap } from "../../wrapped.ts";

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
          "[",
          "number",
          "]",
          ":",
          "string",
          ".",
          ".",
          ".",
          "ope",
          ",",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {},
          rest: [
            {
              kind: "pattern",
              key: { kind: PatternKind.Type, type: Type.Number },
              value: { kind: PatternKind.Type, type: Type.String },
            },
            { kind: "any" },
          ],
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
          ".",
          ".",
          ".",
          "[",
          "string",
          "]",
          ":",
          "string",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {
            id: { kind: PatternKind.Type, type: Type.Number },
          },
          rest: [{
            kind: "pattern",
            key: { kind: PatternKind.Type, type: Type.String },
            value: { kind: PatternKind.Type, type: Type.String },
          }],
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
          "[",
          "name",
          ":",
          "string",
          "]",
          ":",
          "[",
          "any",
          "]",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {},
          rest: [{
            kind: "pattern",
            key: {
              kind: PatternKind.Variable,
              name: "name",
              pattern: { kind: PatternKind.Type, type: Type.String },
            },
            value: {
              kind: PatternKind.Into,
              pattern: { kind: PatternKind.Any },
            },
          }],
        },
      }),
    });

    await t.step({
      name:
        "req:pattern-language-syntax-011 - STRUCTURE_05 rejects named entries after rest",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Structure",
        input: Input.Iterable([
          "{",
          ".",
          ".",
          ".",
          "[",
          "string",
          "]",
          ":",
          "string",
          ",",
          "name",
          ":",
          "any",
          "}",
        ]),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name:
        "req:pattern-language-syntax-011 - STRUCTURE_06 rejects clauses after catch-all",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Structure",
        input: Input.Iterable([
          "{",
          ".",
          ".",
          ".",
          "ope",
          ".",
          ".",
          ".",
          "[",
          "string",
          "]",
          ":",
          "any",
          "}",
        ]),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name:
        "req:pattern-language-syntax-011 - STRUCTURE_07 parses ordered rest clauses",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Structure",
        input: Input.Iterable([
          "{",
          ".",
          ".",
          ".",
          "[",
          "string",
          "]",
          ":",
          "number",
          ".",
          ".",
          ".",
          "[",
          "number",
          "]",
          ":",
          "string",
          ".",
          ".",
          ".",
          "ope",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {},
          rest: [
            {
              kind: "pattern",
              key: { kind: PatternKind.Type, type: Type.String },
              value: { kind: PatternKind.Type, type: Type.Number },
            },
            {
              kind: "pattern",
              key: { kind: PatternKind.Type, type: Type.Number },
              value: { kind: PatternKind.Type, type: Type.String },
            },
            { kind: "any" },
          ],
        },
      }),
    });

    await t.step({
      name:
        "req:pattern-language-syntax-011 parses entry, key, and value captures",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Structure",
        input: Input.Iterable([
          "{",
          ".",
          ".",
          ".",
          "as",
          "e",
          "[",
          "k",
          ":",
          "string",
          "]",
          ":",
          "v",
          ":",
          "string",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {},
          rest: [{
            kind: "pattern",
            entry: "e",
            key: {
              kind: PatternKind.Variable,
              name: "k",
              pattern: { kind: PatternKind.Type, type: Type.String },
            },
            value: {
              kind: PatternKind.Variable,
              name: "v",
              pattern: { kind: PatternKind.Type, type: Type.String },
            },
          }],
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
    ["rule A = { a: ‸};", "Expected a pattern here, such as a rule"],
    [
      "rule A = { ...[string] ‸string };",
      "Expected `:` here between the rest key pattern and value pattern.",
    ],
  ]),
);

Deno.test(
  "req:over-002 - rest captures aggregate for projections",
  async () => {
    const input = { a: "x", b: "y" };
    const examples: [string, unknown][] = [
      [
        "export rule P = { ...[string]: v:string } -> (echo v);",
        ["x", "y"],
      ],
      [
        "export rule P = { ...[k:string]: string } -> (echo k);",
        ["a", "b"],
      ],
      [
        "export rule P = { ...[k:string]: v:string } -> (echo [k v]);",
        [["a", "b"], ["x", "y"]],
      ],
      [
        "export rule P = { ... as e [string]: string } -> (echo e);",
        [["a", "x"], ["b", "y"]],
      ],
      [
        "export rule P = { ... as e [k:string]: v:string } -> (echo [e k v]);",
        [[["a", "x"], ["b", "y"]], ["a", "b"], ["x", "y"]],
      ],
    ];

    for (const [source, expected] of examples) {
      const result = await executeUffdaSource(source, {
        input,
        entryRuleName: "P",
        scopeOptions: {
          globals: new Map([["echo", (value: unknown) => value]]),
        },
      });

      assertEquals(result.kind, MatchKind.Ok);
      if (result.kind === MatchKind.Ok) {
        assertEquals(unwrap(result.value), expected, source);
      }
    }
  },
);
