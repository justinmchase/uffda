import {
  ExportDeclarationKind,
  type ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

export const Surround: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Surround",
    },
  ],
  rules: [
    {
      // Group<L, P, R> = L? p:P R? -> p;
      name: "Surround",
      parameters: [
        { name: "L" },
        { name: "P" },
        { name: "R" },
      ],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Slice,
            min: 0,
            max: 1,
            pattern: {
              kind: PatternKind.Reference,
              name: "L",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "p",
            pattern: {
              kind: PatternKind.Reference,
              name: "P",
              args: [],
            },
          },
          {
            kind: PatternKind.Slice,
            min: 0,
            max: 1,
            pattern: {
              kind: PatternKind.Reference,
              name: "R",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ p }) => p,
      },
    },
  ],
};

export default Surround;
