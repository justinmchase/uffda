import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

/**
 * Host-side declaration registered under `./formatting.uff` so published CLIs
 * can load Formatting without `./bin` during bootstrap compile.
 */
export const Formatting: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Formatting",
      default: true,
    },
  ],
  rules: [
    {
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
