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
    },
  ],
  rules: [
    {
      // Whitespace = (\cZs | \cZl | \cZp)+;
      name: "Whitespace",
      parameters: [],
      pattern: {
        kind: PatternKind.Slice,
        min: 1,
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
          ],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _.join(""),
      },
    },
  ],
};

export default Whitespace;
