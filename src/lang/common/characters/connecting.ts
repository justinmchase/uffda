import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

// Authored Uffda source for this module lives in ./connecting.uff and is
// compiled in CI with the published CLI (`uffda compile ... --out-dir ./bin`).
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
      // Connecting = \cPc;
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
