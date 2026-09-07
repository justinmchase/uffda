import { ExportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import { CharacterClass, PatternKind } from "../../../runtime/patterns/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

/**
 * Host-side declaration registered under `./whitespace.uff` so published CLIs
 * can load Whitespace without `./bin` during bootstrap compile.
 */
export const Whitespace: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Whitespace",
      default: true,
    },
  ],
  rules: [
    {
      name: "Whitespace",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Character,
            characterClass: CharacterClass.SpaceSeparator,
          },
          {
            kind: PatternKind.Character,
            characterClass: CharacterClass.LineSeparator,
          },
          {
            kind: PatternKind.Character,
            characterClass: CharacterClass.ParagraphSeparator,
          },
          {
            kind: PatternKind.Equal,
            value: "\t",
          },
        ],
      },
    },
  ],
};

export default Whitespace;
