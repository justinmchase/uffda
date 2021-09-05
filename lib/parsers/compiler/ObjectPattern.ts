import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang/lang.pattern.ts";

export const ObjectKeyPattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: {
          kind: PatternKind.Equal,
          value: LangPatternKind.ObjectKeyPattern,
        },
        name: {
          kind: PatternKind.Variable,
          name: "name",
          pattern: { kind: PatternKind.String },
        },
        alias: {
          kind: PatternKind.Variable,
          name: "alias",
          pattern: {
            kind: PatternKind.Or,
            patterns: [
              { kind: PatternKind.String },
              { kind: PatternKind.Ok },
            ],
          },
        },
        must: {
          kind: PatternKind.Variable,
          name: "must",
          pattern: {
            kind: PatternKind.Or,
            patterns: [
              { kind: PatternKind.Boolean },
              { kind: PatternKind.Ok },
            ],
          },
        },
        pattern: {
          kind: PatternKind.Variable,
          name: "pattern",
          pattern: {
            kind: PatternKind.Or,
            patterns: [
              { kind: PatternKind.Reference, name: "PatternExpression" },
              { kind: PatternKind.Ok },
            ],
          },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ _, name, alias, must, pattern = { kind: PatternKind.Any } }) => {
        pattern = must ? { kind: PatternKind.Must, pattern } : pattern;
        return {
          [name]: alias
            ? { kind: PatternKind.Variable, name: alias, pattern }
            : pattern,
        };
      },
    },
  },
};

// ObjectPattern = {
//   type: 'ObjectPattern',
//   k:keys = [ObjectKeyPattern*]
// }
export const ObjectPattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: { kind: PatternKind.Equal, value: LangPatternKind.ObjectPattern },
        keys: {
          kind: PatternKind.Variable,
          name: "k",
          pattern: {
            kind: PatternKind.Array,
            pattern: {
              kind: PatternKind.Slice,
              min: 0,
              pattern: ObjectKeyPattern,
            },
          },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ k }) => ({
        kind: PatternKind.Object,
        keys: Object.assign({}, ...k),
      }),
    },
  },
};
