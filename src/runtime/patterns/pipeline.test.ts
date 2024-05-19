import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { moduleDeclarationTest } from "../../test.ts";
import { ExportDeclarationKind } from "../declarations/mod.ts";
import { ExpressionKind } from "../expressions/mod.ts";
import { PatternKind } from "./pattern.kind.ts";

Deno.test("runtime.patterns.pipeline", async (t) => {
  await t.step({
    name: "pipeline00",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "Test" }],
          rules: [
            {
              name: "Test",
              parameters: [],
              pattern: {
                kind: PatternKind.Pipeline,
                steps: [
                  { kind: PatternKind.Any },
                ],
              },
            },
          ],
        },
      },
      input: Input.From("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "PIPELINE01",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "Test" }],
          rules: [
            {
              name: "Test",
              parameters: [],
              pattern: {
                kind: PatternKind.Pipeline,
                steps: [
                  {
                    kind: PatternKind.Projection,
                    pattern: { kind: PatternKind.Any },
                    expression: {
                      kind: ExpressionKind.Native,
                      fn: () => 1,
                    },
                  },
                  {
                    kind: PatternKind.Projection,
                    pattern: { kind: PatternKind.Any },
                    expression: {
                      kind: ExpressionKind.Native,
                      fn: () => 2,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      input: Input.From([0]),
      value: 2,
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "PIPELINE02",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "Test" }],
          rules: [
            {
              name: "Test",
              parameters: [],
              pattern: {
                kind: PatternKind.Pipeline,
                steps: [
                  {
                    kind: PatternKind.Projection,
                    pattern: {
                      kind: PatternKind.Slice,
                      pattern: { kind: PatternKind.Any },
                    },
                    expression: {
                      kind: ExpressionKind.Native,
                      fn: ({ _ }) => _.map((n: number) => n + 1),
                    },
                  },
                  {
                    kind: PatternKind.Projection,
                    pattern: {
                      kind: PatternKind.Slice,
                      pattern: { kind: PatternKind.Any },
                    },
                    expression: {
                      kind: ExpressionKind.Native,
                      fn: ({ _ }) => _.map((n: number) => n * 2),
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      input: Input.From([1, 2, 3]),
      value: [4, 6, 8],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "PIPELINE03",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "Test" }],
          rules: [
            {
              name: "Test",
              parameters: [],
              pattern: {
                kind: PatternKind.Pipeline,
                steps: [
                  { kind: PatternKind.Any },
                  {
                    kind: PatternKind.Projection,
                    pattern: {
                      kind: PatternKind.Slice,
                      pattern: { kind: PatternKind.Any },
                    },
                    expression: {
                      kind: ExpressionKind.Native,
                      fn: ({ _ }) => _.map((n: number) => n * 2),
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      input: Input.From([11]),
      value: [22],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "PIPELINE04",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "Test" }],
          rules: [
            {
              name: "Test",
              parameters: [],
              pattern: {
                kind: PatternKind.Pipeline,
                steps: [
                  {
                    kind: PatternKind.Projection,
                    pattern: {
                      kind: PatternKind.Slice,
                      pattern: { kind: PatternKind.Any },
                    },
                    expression: {
                      kind: ExpressionKind.Native,
                      fn: ({ _ }) =>
                        _.reduce((i: number, n: number) => i + n, 0),
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      input: Input.From([1, 2, 3]),
      value: 6,
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "PIPELINE05",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "Test" }],
          rules: [
            {
              name: "Test",
              parameters: [],
              pattern: {
                kind: PatternKind.Pipeline,
                steps: [
                  {
                    kind: PatternKind.Pipeline,
                    steps: [
                      {
                        kind: PatternKind.Slice,
                        pattern: { kind: PatternKind.Any },
                      },
                    ],
                  },
                  {
                    kind: PatternKind.Projection,
                    pattern: {
                      kind: PatternKind.Slice,
                      min: 3,
                      max: 3,
                      pattern: { kind: PatternKind.Any },
                    },
                    expression: {
                      kind: ExpressionKind.Native,
                      fn: ({ _ }) => _.join("-"),
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      input: Input.From("abc"),
      value: "a-b-c",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "PIPELINE05",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "Test" }],
          rules: [
            {
              name: "Test",
              parameters: [],
              pattern: {
                kind: PatternKind.Then,
                patterns: [
                  {
                    kind: PatternKind.Equal,
                    value: "a",
                  },
                  {
                    kind: PatternKind.Pipeline,
                    steps: [
                      {
                        kind: PatternKind.Pipeline,
                        steps: [
                          {
                            kind: PatternKind.Slice,
                            pattern: { kind: PatternKind.Equal, value: "b" },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    kind: PatternKind.Equal,
                    value: "c",
                  },
                ],
              },
            },
          ],
        },
      },
      input: Input.From("abc"),
      value: ["a", ["b"], "c"],
      kind: MatchKind.Ok,
    }),
  });
});
