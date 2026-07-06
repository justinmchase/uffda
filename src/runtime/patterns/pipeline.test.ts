import { Input } from "../../input.ts";
import { ResolveTargetKind } from "./pattern.ts";
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
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Test",
            default: true,
          }],
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
      input: Input.Iterable("a"),
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
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Test",
            default: true,
          }],
          rules: [
            {
              name: "One",
              parameters: [],
              pattern: {
                kind: PatternKind.Equal,
                value: 0,
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: () => 1,
              },
            },
            {
              name: "Two",
              parameters: [],
              pattern: {
                kind: PatternKind.Equal,
                value: 1,
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: () => 2,
              },
            },
            {
              name: "Test",
              parameters: [],
              pattern: {
                kind: PatternKind.Pipeline,
                steps: [
                  {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "One",
                    args: [],
                  },
                  {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "Two",
                    args: [],
                  },
                ],
              },
            },
          ],
        },
      },
      input: Input.Iterable([0]),
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
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Test",
            default: true,
          }],
          rules: [
            {
              name: "PlusOne",
              parameters: [],
              pattern: {
                kind: PatternKind.Quantifier,
                pattern: { kind: PatternKind.Any },
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => _.map((n: number) => n + 1),
              },
            },
            {
              name: "TimesTwo",
              parameters: [],
              pattern: {
                kind: PatternKind.Quantifier,
                pattern: { kind: PatternKind.Any },
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => _.map((n: number) => n * 2),
              },
            },
            {
              name: "Test",
              parameters: [],
              pattern: {
                kind: PatternKind.Pipeline,
                steps: [
                  {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "PlusOne",
                    args: [],
                  },
                  {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "TimesTwo",
                    args: [],
                  },
                ],
              },
            },
          ],
        },
      },
      input: Input.Iterable([1, 2, 3]),
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
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Test",
            default: true,
          }],
          rules: [
            {
              name: "P",
              parameters: [],
              pattern: {
                kind: PatternKind.Quantifier,
                pattern: { kind: PatternKind.Any },
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => _.map((n: number) => n * 2),
              },
            },
            {
              name: "Test",
              parameters: [],
              pattern: {
                kind: PatternKind.Pipeline,
                steps: [
                  { kind: PatternKind.Any },
                  {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "P",
                    args: [],
                  },
                ],
              },
            },
          ],
        },
      },
      input: Input.Iterable([11]),
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
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Test",
            default: true,
          }],
          rules: [
            {
              name: "P",
              parameters: [],
              pattern: {
                kind: PatternKind.Quantifier,
                pattern: { kind: PatternKind.Any },
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => _.reduce((i: number, n: number) => i + n, 0),
              },
            },
            {
              name: "Test",
              parameters: [],
              pattern: {
                kind: PatternKind.Pipeline,
                steps: [
                  {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "P",
                    args: [],
                  },
                ],
              },
            },
          ],
        },
      },
      input: Input.Iterable([1, 2, 3]),
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
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Test",
            default: true,
          }],
          rules: [
            {
              name: "P",
              parameters: [],
              pattern: {
                kind: PatternKind.Quantifier,
                min: 3,
                max: 3,
                pattern: { kind: PatternKind.Any },
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => _.join("-"),
              },
            },
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
                        kind: PatternKind.Quantifier,
                        pattern: { kind: PatternKind.Any },
                      },
                    ],
                  },
                  {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "P",
                    args: [],
                  },
                ],
              },
            },
          ],
        },
      },
      input: Input.Iterable("abc"),
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
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Test",
            default: true,
          }],
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
                            kind: PatternKind.Quantifier,
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
      input: Input.Iterable("abc"),
      value: ["a", ["b"], "c"],
      kind: MatchKind.Ok,
    }),
  });
});
