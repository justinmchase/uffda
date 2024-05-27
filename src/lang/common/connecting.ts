import {
  ExportDeclarationKind,
  ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../runtime/patterns/mod.ts";

export const Connecting: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Connecting",
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
