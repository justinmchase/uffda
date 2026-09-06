import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

// Authored Uffda source for this module lives in ./digit.uff and is compiled in
// CI with the published CLI (`uffda compile ... --out-dir ./bin`).
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
