import { assertEquals, assertStrictEquals } from "std/assert/mod.ts";
import { moduleDeclarationTest } from "../test.ts";
import { ExpressionKind } from "./expressions/expression.kind.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { Input } from "../input.ts";
import { MatchKind } from "../mod.ts";
import {
  ExportDeclarationKind,
  ImportDeclarationKind,
} from "./declarations/mod.ts";

Deno.test("runtime.rule", async (t) => {
  await t.step({
    name: "RULE00",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "R" }],
          rules: [
            {
              name: "R",
              parameters: [],
              pattern: {
                kind: PatternKind.Equal,
                value: "a",
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.From("a"),
      value: "a",
    }),
  });

  await t.step({
    name: "RULE01",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "a" }],
          rules: [
            {
              // a = a | 'a'
              name: "a",
              parameters: [],
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Reference,
                    name: "a",
                    args: [],
                  },
                  {
                    kind: PatternKind.Equal,
                    value: "a",
                  },
                ],
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.From("aa"),
      value: "a",
      done: false,
    }),
  });

  await t.step({
    name: "RULE02",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "a" }],
          rules: [
            {
              name: "a",
              parameters: [],
              // a = a 'a' | 'a'
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Then,
                    patterns: [
                      { kind: PatternKind.Reference, name: "a", args: [] },
                      { kind: PatternKind.Equal, value: "a" },
                    ],
                  },
                  { kind: PatternKind.Equal, value: "a" },
                ],
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.From("aaa"),
      value: [["a", "a"], "a"],
    }),
  });

  await t.step({
    name: "RULE03",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [
            { kind: ExportDeclarationKind.Rule, name: "a" },
            { kind: ExportDeclarationKind.Rule, name: "b" },
          ],
          rules: [
            {
              name: "a",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "b",
                args: [],
              },
            },
            {
              name: "b",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "a",
                args: [],
              },
            },
          ],
        },
      },
      kind: MatchKind.Fail,
      input: Input.From("ab"),
    }),
  });

  await t.step({
    name: "RULE04",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "a" }],
          rules: [
            {
              // a = 'a' a | 'a'
              name: "a",
              parameters: [],
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Then,
                    patterns: [
                      { kind: PatternKind.Equal, value: "a" },
                      { kind: PatternKind.Reference, name: "a", args: [] },
                    ],
                  },
                  { kind: PatternKind.Equal, value: "a" },
                ],
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.From("aaa"),
      value: ["a", ["a", "a"]],
    }),
  });

  await t.step({
    name: "RULE05",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [
            { kind: ExportDeclarationKind.Rule, name: "P0" },
            { kind: ExportDeclarationKind.Rule, name: "P1" },
          ],
          rules: [
            {
              name: "P0",
              parameters: [],
              pattern: {
                kind: PatternKind.Projection,
                pattern: { kind: PatternKind.Any },
                expression: {
                  kind: ExpressionKind.Native,
                  fn: (
                    { x }: { x: undefined },
                  ) => (assertStrictEquals(x, undefined), true),
                },
              },
            },
            {
              name: "P1",
              parameters: [],
              pattern: {
                kind: PatternKind.Then,
                patterns: [
                  {
                    kind: PatternKind.Variable,
                    name: "x",
                    pattern: { kind: PatternKind.Any },
                  },
                  {
                    kind: PatternKind.Or,
                    patterns: [
                      { kind: PatternKind.Reference, name: "P0", args: [] },
                      { kind: PatternKind.Any },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.From("ab"),
      value: ["a", true],
    }),
  });

  await t.step({
    name: "RULE06",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [
            { kind: ExportDeclarationKind.Rule, name: "P0" },
            { kind: ExportDeclarationKind.Rule, name: "P1" },
          ],
          rules: [
            {
              name: "P0",
              parameters: [],
              pattern: {
                kind: PatternKind.Projection,
                pattern: {
                  kind: PatternKind.Variable,
                  name: "x",
                  pattern: { kind: PatternKind.Any },
                },
                expression: {
                  kind: ExpressionKind.Native,
                  fn: ({ x }: { x: "a" }) => (assertEquals(x, "a"), x),
                },
              },
            },
            {
              name: "P1",
              parameters: [],
              pattern: {
                kind: PatternKind.Projection,
                pattern: {
                  kind: PatternKind.Reference,
                  name: "P0",
                  args: [],
                },
                expression: {
                  kind: ExpressionKind.Native,
                  fn: ({ x, _ }: { x: undefined; _: unknown }) => (
                    assertStrictEquals(x, undefined), _
                  ),
                },
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.From("a"),
      value: "a",
    }),
  });

  await t.step({
    name: "RULE07",
    fn: moduleDeclarationTest({
      moduleUrl: "file:///m1.ts",
      declarations: {
        ["file:///m0.ts"]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "P0" }],
          rules: [
            {
              name: "P0",
              parameters: [],
              pattern: {
                kind: PatternKind.Projection,
                pattern: { kind: PatternKind.Any },
                expression: {
                  kind: ExpressionKind.Native,
                  fn: ({ x }: { x: undefined }) => (
                    assertStrictEquals(x, undefined), true
                  ),
                },
              },
            },
          ],
        },
        ["file:///m1.ts"]: {
          imports: [
            {
              kind: ImportDeclarationKind.Module,
              moduleUrl: "file:///m0.ts",
              names: ["P0"],
            },
          ],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "P1" }],
          rules: [
            {
              name: "P1",
              parameters: [],
              pattern: {
                kind: PatternKind.Then,
                patterns: [
                  {
                    kind: PatternKind.Variable,
                    name: "x",
                    pattern: { kind: PatternKind.Any },
                  },
                  {
                    kind: PatternKind.Or,
                    patterns: [
                      { kind: PatternKind.Reference, name: "P0", args: [] },
                      { kind: PatternKind.Any },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.From("ab"),
      value: ["a", true],
    }),
  });

  // todo: two identical rules with different native projections should not trigger DLR?
});
