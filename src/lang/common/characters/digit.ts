import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

export const Digit: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Digit",
      default: true,
    },
  ],
  rules: [
    {
      // Digit = \cNd;
      name: "Digit",
      parameters: [],
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.DecimalDigitNumber,
      },
    },
  ],
};

export default Digit;
