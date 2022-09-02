import { assertObjectMatch } from "../deps/std.ts";
import { Scope } from "./scope.ts";
import { Pattern, PatternKind } from "./runtime/patterns/mod.ts";
import { ExpressionKind } from "./runtime/expressions/mod.ts";
import { match } from "./runtime/match.ts";

Deno.test({
  name: "SCOPE_00",
  fn: async () => {
    const scope = Scope.From("abc");
    const pattern: Pattern = {
      kind: PatternKind.Then,
      patterns: [
        { kind: PatternKind.Any },
        { kind: PatternKind.Any },
      ],
    };
    const result = await match(pattern, scope);
    const { matched, done } = result;
    const { start, end } = result.span();
    assertObjectMatch({ matched, done, start, end }, {
      matched: true,
      done: false,
      start: 0,
      end: 2,
    });
  },
});

Deno.test({
  name: "SCOPE_01",
  fn: async () => {
    const scope = Scope.From("aabbbcc");

    // ('a'+ -> { value: _ }, 'b'+ -> { value: _ }, 'c'+ -> { value: _ }) > ({ value }, { value })
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
            // it doesn't consume the c's here, thus the parse is done: false and should report an error.
          ],
        },
      ],
    };
    const result = await match(pattern, scope);
    const { matched, done, errors } = result;
    const { start, end } = result.span();
    assertObjectMatch({ matched, done, start, end, errors }, {
      matched: true,
      done: false,
      start: 0,
      end: 5,
      errors: [],
    });
  },
});

Deno.test({
  name: "SCOPE_02",
  fn: async () => {
    const scope = Scope.From("abc");
    const pattern: Pattern = {
      kind: PatternKind.Then,
      patterns: [
        { kind: PatternKind.Any },
        { kind: PatternKind.Any },
        { kind: PatternKind.Any },
      ],
    };
    const result = await match(pattern, scope);
    const { matched, done } = result;
    const { start, end } = result.span();
    assertObjectMatch({ matched, done, start, end }, {
      matched: true,
      done: true,
      start: 0,
      end: 3,
    });
  },
});
