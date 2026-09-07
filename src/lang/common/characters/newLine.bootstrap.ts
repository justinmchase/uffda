import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

/**
 * Host-side declaration registered under `./newLine.uff` so published CLIs
 * can load NewLine without `./bin` during bootstrap compile.
 */
export const NewLine: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "NewLine",
      default: true,
    },
  ],
  rules: [
    {
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
        kind: ExpressionKind.String,
        values: ["\n"],
      },
    },
  ],
};

export default NewLine;
