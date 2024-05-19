import {
  ExportDeclarationKind,
  ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { CharacterClass, PatternKind } from "../../runtime/patterns/mod.ts";

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
      // Whitespace = (\cZs | \cCc | \cZl | \cZp)+;
      name: "Whitespace",
      parameters: [],
      pattern: {
        kind: PatternKind.Projection,
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
              {
                kind: PatternKind.Equal,
                value: "\t",
              },
            ],
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ _ }) => _.join(""),
        },
      },
    },
  ],
};

export default Whitespace;
