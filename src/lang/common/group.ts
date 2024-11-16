import {
  ExportDeclarationKind,
  type ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

export const Whitespace: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Group",
    },
  ],
  rules: [
    {
      // Group<P> = "(" p:P? ")" -> (p);
      name: "Group",
      parameters: [
        { name: "P" },
      ],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "(",
          },
          {
            kind: PatternKind.Variable,
            name: "p",
            pattern: {
              kind: PatternKind.Slice,
              max: 1,
              pattern: {
                kind: PatternKind.Reference,
                name: "P",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Equal,
            value: ")",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ p }) => p[0],
      },
    },
  ],
};

export default Whitespace;
