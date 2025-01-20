import { ExpressionKind } from "../../../runtime/expressions/expression.kind.ts";
import { ExportDeclarationKind } from "../../../runtime/declarations/export.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

export const Whitespace: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Whitespace",
      default: true,
    },
  ],
  rules: [
    {
      // Whitespace = \cZs | \cZl | \cZp | "\t";
      name: "Whitespace",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Character,
            characterClass: CharacterClass.SpaceSeparator,
          },
          {
            kind: PatternKind.Character,
            characterClass: CharacterClass.LineSeparator,
          },
          {
            kind: PatternKind.Character,
            characterClass: CharacterClass.ParagraphSeparator,
          },
          {
            // This is technically in the Control Character class but
            // is commonly used as whitespace in coding so its specifically
            // added to this pattern.
            kind: PatternKind.Equal,
            value: "\t",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
  ],
};

export default Whitespace;
