import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

/**
 * Host-side declaration registered under `./connecting.uff` so published CLIs
 * can load Connecting without `./bin` during bootstrap compile.
 */
export const Connecting: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Connecting",
      default: true,
    },
  ],
  rules: [
    {
      name: "Connecting",
      parameters: [],
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.ConnectorPunctuation,
      },
    },
  ],
};

export default Connecting;
