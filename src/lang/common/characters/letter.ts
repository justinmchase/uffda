import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

export const Letter: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Letter",
    },
  ],
  rules: [
    {
      // Letter = (\cL | \cN1);
      name: "Letter",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Character,
            characterClass: CharacterClass.Letter,
          },
          {
            kind: PatternKind.Character,
            characterClass: CharacterClass.LetterNumber,
          },
        ],
      },
    },
  ],
};

export default Letter;
