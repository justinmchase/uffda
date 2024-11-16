import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

export const Combining: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Combining",
    },
  ],
  rules: [
    {
      // Combining = \cMn | \cMc;
      name: "Combining",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Character,
            characterClass: CharacterClass.EnclosingMark,
          },
          {
            kind: PatternKind.Character,
            characterClass: CharacterClass.SpacingCombiningMark,
          },
        ],
      },
    },
  ],
};

export default Combining;
