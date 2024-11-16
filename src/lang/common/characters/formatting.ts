import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

export const Formatting: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Formatting",
    },
  ],
  rules: [
    {
      // Formatting = \cCf;
      name: "Formatting",
      parameters: [],
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Format,
      },
    },
  ],
};

export default Formatting;
