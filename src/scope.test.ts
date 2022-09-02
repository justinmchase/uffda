import { assertObjectMatch } from "../deps/std.ts";
import { Scope } from "./scope.ts";
import { Pattern, PatternKind } from "./runtime/patterns/mod.ts";
import { ExpressionKind } from "./runtime/expressions/mod.ts";
import { match } from "./runtime/match.ts";

Deno.test(
  "SCOPE_00",
  async () => {
    const scope = Scope.From("abc");
    const pattern: Pattern = {
      kind: PatternKind.And,
      patterns: [
        { kind: PatternKind.Any },
        { kind: PatternKind.Any },
      ],
    };
    const result = await match(pattern, scope);
    const { matched, done } = result;
    const source = result.end.source();
    const index = source.stream.index;
    assertObjectMatch({ matched, done, index }, {
      matched: true,
      done: false,
      index: 1,
    });
  },
);

Deno.test(
  "SCOPE_01",
  async () => {
    const scope = Scope.From("aabbbcc");
    const pattern: Pattern = {
      kind: PatternKind.Pipeline,
      steps: [
        {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Projection,
              pattern: {
                kind: PatternKind.Slice,
                min: 1,
                pattern: {
                  kind: PatternKind.Equal,
                  value: "a",
                },
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => ({ value: _ }),
              },
            },
            {
              kind: PatternKind.Projection,
              pattern: {
                kind: PatternKind.Slice,
                min: 1,
                pattern: {
                  kind: PatternKind.Equal,
                  value: "b",
                },
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => ({ value: _ }),
              },
            },
            {
              kind: PatternKind.Projection,
              pattern: {
                kind: PatternKind.Slice,
                min: 1,
                pattern: {
                  kind: PatternKind.Equal,
                  value: "c",
                },
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => ({ value: _ }),
              },
            },
          ],
        },
        {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Object,
              keys: {
                value: { kind: PatternKind.Any },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                value: { kind: PatternKind.Any },
              },
            },
          ],
        },
      ],
    };
    const result = await match(pattern, scope);
    const { matched, done, errors } = result;
    const source = result.end.source();
    const index = source.stream.index;
    assertObjectMatch({ matched, done, index, errors }, {
      matched: true,
      done: false,
      index: 5,
      errors: [],
    });
  },
);
