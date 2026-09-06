import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

/**
 * Host-side declaration registered under `./letter.uff` so published CLIs can
 * load Letter without `./bin` during bootstrap compile.
 */
export const Letter: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Letter",
      default: true,
    },
  ],
  rules: [
    {
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
