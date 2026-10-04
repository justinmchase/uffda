import { patternTest } from "../../test.ts";
import { assert, assertEquals } from "@std/assert";
import { Type } from "@justinmchase/type";
import { Input, InputNormalizationMode } from "../../input.ts";
import { type Pattern, ResolveTargetKind } from "./pattern.ts";
import { getRightmostFailure, MatchKind } from "../../match.ts";
import { moduleDeclarationTest } from "../../test.ts";
import { ExportDeclarationKind } from "../declarations/mod.ts";
import { ExpressionKind } from "../expressions/mod.ts";
import { PatternKind } from "./pattern.kind.ts";
import { lit, ValueSourceKind } from "./value_source.ts";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";
import { unwrap, Wrapped } from "../../wrapped.ts";

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
                fn: ({ _ }) => (unwrap(_) as number[]).map((n) => n + 1),
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
                fn: ({ _ }) => (unwrap(_) as number[]).map((n) => n * 2),
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
                fn: ({ _ }) => (unwrap(_) as number[]).map((n) => n * 2),
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
                fn: ({ _ }) =>
                  (unwrap(_) as number[]).reduce((i, n) => i + n, 0),
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
                fn: ({ _ }) => (unwrap(_) as unknown[]).join("-"),
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
    name:
      "PIPELINE08 a carried string keeps its characters' origins in the next step",
    fn: async () => {
      const origin = { start: 40, end: 43 };
      const scope = Scope.From(Input.Iterable([
        new Wrapped("abc", origin, [{ length: 3, origin, linear: true }]),
      ]));
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
    name: "PIPELINE09 carried items keep their origins in the next step",
    fn: async () => {
      const scope = Scope.From(Input.Iterable([
        new Wrapped("a", { start: 10, end: 11 }),
        new Wrapped("!", { start: 11, end: 12 }),
        new Wrapped("c", { start: 12, end: 13 }),
      ]));
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

  await t.step({
    name: "PIPELINE10 later steps see outer variable bindings",
    fn: async () => {
      const scope = new Scope(
        undefined,
        undefined,
        new Map([["n", 3]]),
        new Map(),
        Input.Iterable([5]),
      );
      const m = await match(
        {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Type, type: Type.Number },
            {
              kind: PatternKind.And,
              patterns: [
                { kind: PatternKind.Type, type: Type.Number },
                {
                  kind: PatternKind.Between,
                  left: { kind: ValueSourceKind.Variable, name: "n" },
                },
              ],
            },
          ],
        },
        scope,
      );
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind !== MatchKind.Ok) return;
      assertEquals(unwrap(m.value), 5);
    },
  });

  await t.step({
    name: "PIPELINE11 a failure reports the pipeline and the steps it ran",
    fn: async () => {
      const first = { kind: PatternKind.Equal, value: lit("a") } as const;
      const pipeline: Pattern = {
        kind: PatternKind.Pipeline,
        steps: [first, { kind: PatternKind.Any }],
      };
      const m = await match(pipeline, Scope.From(Input.Iterable("b")));
      assertEquals(m.kind, MatchKind.Fail);
      if (m.kind !== MatchKind.Fail) return;
      assertEquals(m.pattern, pipeline);
      assertEquals(m.matches.map((step) => step.pattern), [first]);
    },
  });
});

Deno.test("runtime.patterns.pipeline open input", async (t) => {
  const pattern: Pattern = {
    kind: PatternKind.Pipeline,
    steps: [
      {
        kind: PatternKind.Quantifier,
        pattern: { kind: PatternKind.Type, type: Type.String },
      },
      { kind: PatternKind.Quantifier, pattern: { kind: PatternKind.Any } },
    ],
  };
  const lastStageKinds = async (open: boolean) => {
    const input = Input.From("ab", {
      kind: InputNormalizationMode.Iterable,
      open,
    });
    const m = await match(pattern, Scope.Default().withInput(input));
    assert(m.kind === MatchKind.Ok);
    const last = m.matches.at(-1);
    assert(last?.kind === MatchKind.Ok);
    return last.matches.map((child) => child.kind);
  };

  await t.step(
    "a stage that read an open input to its end feeds an open input",
    async () => {
      assertEquals(await lastStageKinds(true), [MatchKind.Ok, MatchKind.Fail]);
    },
  );

  await t.step("a closed input feeds a closed input", async () => {
    assertEquals(await lastStageKinds(false), [MatchKind.Ok]);
  });
});

Deno.test("runtime/patterns/pipeline skip", async (t) => {
  await t.step({
    name: "PIPELINE_SKIP00 - a skipped final step is skipped",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [{ kind: PatternKind.Any }, {
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Equal, value: lit("a") },
        }],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Skip,
    }),
  });

  await t.step({
    name: "PIPELINE_SKIP01 - a skipped earlier step passes undefined on",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [{
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Equal, value: lit("a") },
        }, { kind: PatternKind.Equal, value: lit(undefined) }],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: undefined,
    }),
  });
});

Deno.test("runtime/patterns/pipeline rule parameters", async (t) => {
  await t.step({
    name: "a step resolves the enclosing rule's parameter",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Main",
            default: true,
          }],
          rules: [
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "Outer",
                args: [{ kind: PatternKind.Equal, value: lit("a") }],
              },
            },
            {
              name: "Outer",
              parameters: [{ name: "P" }],
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
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  });

  await t.step({
    name:
      "PIPELINE_LAYER - pipelines at one position keep their stage memos apart",
    // Rec = (array & [r:Rec*] -> r) | any
    // Test = a:((ok -> [1]) |> Rec) b:((ok -> [2]) |> Rec) -> [a b]
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
              name: "Rec",
              parameters: [],
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Projection,
                    pattern: {
                      kind: PatternKind.And,
                      patterns: [
                        { kind: PatternKind.Type, type: Type.Array },
                        {
                          kind: PatternKind.Into,
                          pattern: {
                            kind: PatternKind.Variable,
                            name: "r",
                            pattern: {
                              kind: PatternKind.Quantifier,
                              pattern: {
                                kind: PatternKind.Resolve,
                                targetKind: ResolveTargetKind.Reference,
                                name: "Rec",
                                args: [],
                              },
                            },
                          },
                        },
                      ],
                    },
                    expression: { kind: ExpressionKind.Reference, name: "r" },
                  },
                  { kind: PatternKind.Any },
                ],
              },
            },
            {
              name: "Test",
              parameters: [],
              pattern: {
                kind: PatternKind.Then,
                patterns: [1, 2].map((n) => ({
                  kind: PatternKind.Variable,
                  name: n === 1 ? "a" : "b",
                  pattern: {
                    kind: PatternKind.Pipeline,
                    steps: [
                      {
                        kind: PatternKind.Projection,
                        pattern: { kind: PatternKind.Ok },
                        expression: {
                          kind: ExpressionKind.Array,
                          expressions: [{
                            kind: ExpressionKind.ArrayElement,
                            expression: {
                              kind: ExpressionKind.Number,
                              value: n,
                            },
                          }],
                        },
                      },
                      {
                        kind: PatternKind.Resolve,
                        targetKind: ResolveTargetKind.Reference,
                        name: "Rec",
                        args: [],
                      },
                    ],
                  },
                } as Pattern)),
              },
              expression: {
                kind: ExpressionKind.Array,
                expressions: ["a", "b"].map((name) => ({
                  kind: ExpressionKind.ArrayElement,
                  expression: { kind: ExpressionKind.Reference, name },
                })),
              },
            },
          ],
        },
      },
      input: Input.Iterable([]),
      kind: MatchKind.Ok,
      value: [[1], [2]],
    }),
  });
});
