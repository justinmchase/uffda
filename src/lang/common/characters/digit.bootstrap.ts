import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

/**
 * Host-side declaration registered under `./digit.uff` so published CLIs can
 * load Digit without `./bin` during bootstrap compile.
 */
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
