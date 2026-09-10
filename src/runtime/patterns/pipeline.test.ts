import { assertEquals } from "@std/assert";
import { Type } from "@justinmchase/type";
import { Input, InputNormalizationMode } from "../../input.ts";
import { ResolveTargetKind } from "./pattern.ts";
import { getRightmostFailure, MatchKind } from "../../match.ts";
import { moduleDeclarationTest } from "../../test.ts";
import { ExportDeclarationKind } from "../declarations/mod.ts";
import { ExpressionKind } from "../expressions/mod.ts";
import { PatternKind } from "./pattern.kind.ts";
import { lit } from "./value_source.ts";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";

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
              pattern: { kind: PatternKind.Equal, value: lit(0) },
              expression: {
                kind: ExpressionKind.Native,
                fn: () => 1,
              },
            },
            {
              name: "Two",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: lit(1) },
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
                    kind: PatternKind.Into,
                    pattern: {
                      kind: PatternKind.Resolve,
                      targetKind: ResolveTargetKind.Reference,
                      name: "TimesTwo",
                      args: [],
                    },
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
    name: "PIPELINE06",
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
                min: lit(3),
                max: lit(3),
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
                    kind: PatternKind.Into,
                    pattern: {
                      kind: PatternKind.Resolve,
                      targetKind: ResolveTargetKind.Reference,
                      name: "P",
                      args: [],
                    },
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
                  { kind: PatternKind.Equal, value: lit("a") },
                  {
                    kind: PatternKind.Pipeline,
                    steps: [
                      {
                        kind: PatternKind.Pipeline,
                        steps: [
                          {
                            kind: PatternKind.Quantifier,
                            pattern: {
                              kind: PatternKind.Equal,
                              value: lit("b"),
                            },
                          },
                        ],
                      },
                    ],
                  },
                  { kind: PatternKind.Equal, value: lit("c") },
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

  await t.step({
    name: "PIPELINE07 preserves outer stream after transformed stages",
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
          rules: [{
            name: "Test",
            parameters: [],
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                {
                  kind: PatternKind.Pipeline,
                  steps: [
                    { kind: PatternKind.Equal, value: lit("a") },
                    { kind: PatternKind.Type, type: Type.String },
                  ],
                },
                { kind: PatternKind.Equal, value: lit("b") },
              ],
            },
          }],
        },
      },
      input: Input.Iterable("ab"),
      value: ["a", "b"],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "PIPELINE08 carries string originalSpan into next step provenance",
    fn: async () => {
      const itemSpans = [
        {
          normalized: { start: 0, end: 3 },
          original: { start: 40, end: 43 },
        },
      ];
      const scope = Scope.From(
        Input.From(["abc"], {
          kind: InputNormalizationMode.Iterable,
          provenance: { itemSpans },
        }),
      );
      const m = await match(
        {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Equal, value: lit("abc") },
            {
              kind: PatternKind.Into,
              pattern: {
                kind: PatternKind.Then,
                patterns: [
                  { kind: PatternKind.Equal, value: lit("a") },
                  { kind: PatternKind.Equal, value: lit("x") },
                ],
              },
            },
          ],
        },
        scope,
      );
      assertEquals(m.kind, MatchKind.Fail);
      if (m.kind !== MatchKind.Fail) return;
      assertEquals(getRightmostFailure(m).originalSpan.start, 41);
    },
  });

  await t.step({
    name: "PIPELINE09 slices parent itemSpans for string-array stages",
    fn: async () => {
      const itemSpans = [
        {
          normalized: { start: 0, end: 1 },
          original: { start: 10, end: 11 },
        },
        {
          normalized: { start: 1, end: 2 },
          original: { start: 11, end: 12 },
        },
        {
          normalized: { start: 2, end: 3 },
          original: { start: 12, end: 13 },
        },
      ];
      const scope = Scope.From(
        Input.From(["a", "!", "c"], {
          kind: InputNormalizationMode.Iterable,
          provenance: { itemSpans },
        }),
      );
      const m = await match(
        {
          kind: PatternKind.Pipeline,
          steps: [
            {
              kind: PatternKind.Quantifier,
              pattern: { kind: PatternKind.Any },
            },
            {
              kind: PatternKind.Into,
              pattern: { kind: PatternKind.Equal, value: lit("x") },
            },
          ],
        },
        scope,
      );
      assertEquals(m.kind, MatchKind.Fail);
      if (m.kind !== MatchKind.Fail) return;
      assertEquals(getRightmostFailure(m).originalSpan.start, 10);
    },
  });
});
