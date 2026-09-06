import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

/**
 * Host-side declaration registered under `./combining.uff` so published CLIs
 * can load Combining without `./bin` during bootstrap compile.
 */
export const Combining: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Combining",
      default: true,
    },
  ],
  rules: [
    {
      name: "Combining",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Character,
            characterClass: CharacterClass.NonSpacingMark,
          },
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
