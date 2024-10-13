import {
  ExportDeclarationKind,
  ModuleDeclaration,
} from "../../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";

export const NewLine: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "NewLine",
    },
  ],
  rules: [
    {
      // NewLine = '\r' '\n' | '\r' | '\n' -> '\n';
      name: "NewLine",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Then,
            patterns: [
              {
                kind: PatternKind.Equal,
                value: "\r",
              },
              {
                kind: PatternKind.Equal,
                value: "\n",
              },
            ],
          },
          {
            kind: PatternKind.Equal,
            value: "\r",
          },
          {
            kind: PatternKind.Equal,
            value: "\n",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => "\n",
      },
    },
  ],
};

export default NewLine;
