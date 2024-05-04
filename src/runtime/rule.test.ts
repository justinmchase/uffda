import { assertEquals, assertStrictEquals } from "std/assert/mod.ts";
import { moduleDeclarationTest } from "../test.ts";
import { DeclarationKind } from "./declarations/declaration.kind.ts";
import { ExpressionKind } from "./expressions/expression.kind.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { Input } from "../input.ts";
import { MatchKind } from "../mod.ts";

Deno.test("runtime.rule", async (t) => {
  await t.step({
    name: "RULE00",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              kind: DeclarationKind.Rule,
              name: "R",
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              // a = a | 'a'
              kind: DeclarationKind.Rule,
              name: "a",
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Reference,
                    name: "a",
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              kind: DeclarationKind.Rule,
              name: "a",
              // a = a 'a' | 'a'
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Then,
                    patterns: [
                      { kind: PatternKind.Reference, name: "a" },
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              kind: DeclarationKind.Rule,
              name: "a",
              pattern: {
                kind: PatternKind.Reference,
                name: "b",
              },
            },
            {
              kind: DeclarationKind.Rule,
              name: "b",
              pattern: {
                kind: PatternKind.Reference,
                name: "a",
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              // a = 'a' a | 'a'
              kind: DeclarationKind.Rule,
              name: "a",
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Then,
                    patterns: [
                      { kind: PatternKind.Equal, value: "a" },
                      { kind: PatternKind.Reference, name: "a" },
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              kind: DeclarationKind.Rule,
              name: "P0",
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
              kind: DeclarationKind.Rule,
              name: "P1",
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
                      { kind: PatternKind.Reference, name: "P0" },
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              kind: DeclarationKind.Rule,
              name: "P0",
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
              kind: DeclarationKind.Rule,
              name: "P1",
              pattern: {
                kind: PatternKind.Projection,
                pattern: {
                  kind: PatternKind.Reference,
                  name: "P0",
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              kind: DeclarationKind.Rule,
              name: "P0",
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
          kind: DeclarationKind.Module,
          imports: [
            {
              kind: DeclarationKind.Import,
              moduleUrl: "file:///m0.ts",
              names: ["P0"],
            },
          ],
          rules: [
            {
              kind: DeclarationKind.Rule,
              name: "P1",
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
                      { kind: PatternKind.Reference, name: "P0" },
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
