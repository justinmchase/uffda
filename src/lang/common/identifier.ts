import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import {
  ImportDeclarationKind,
  type ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { Connecting } from "./characters/connecting.ts";
import { Combining } from "./characters/combining.ts";
import { Digit } from "./characters/digit.ts";
import { Letter } from "./characters/letter.ts";
import { Formatting } from "./characters/formatting.ts";

// import ./letter.ts (Letter);
// import ./digit.ts (Digit);
// import ./connecting.ts (Connecting);
// import ./combining.ts (Combining);
// import ./formatting.ts (Formatting);
// Identifier =
//   | IdentifierStartCharacter
//   | IdentifierCharacter*
//   ;
// IdentifierStartCharacter =
//   | Letter
//   | "_"
//   ;
// IdentifierCharacter =
//   | IdentifierStartCharacter
//   | Digit
//   | Connecting
//   | Combining
//   | Formatting
//   ;
export const Identifier: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Native,
      module: Letter,
      moduleUrl: "./characters/letter.ts",
      names: [
        "Letter",
      ],
    },
    {
      kind: ImportDeclarationKind.Native,
      module: Digit,
      moduleUrl: "./characters/digit.ts",
      names: [
        "Digit",
      ],
    },
    {
      kind: ImportDeclarationKind.Native,
      module: Connecting,
      moduleUrl: "./characters/connecting.ts",
      names: [
        "Connecting",
      ],
    },
    {
      kind: ImportDeclarationKind.Native,
      module: Combining,
      moduleUrl: "./characters/combining.ts",
      names: [
        "Combining",
      ],
    },
    {
      kind: ImportDeclarationKind.Native,
      module: Formatting,
      moduleUrl: "./characters/formatting.ts",
      names: [
        "Formatting",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Identifier",
    },
  ],
  rules: [
    {
      name: "Identifier",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Reference,
            name: "IdentifierStartCharacter",
            args: [],
          },
          {
            kind: PatternKind.Slice,
            pattern: {
              kind: PatternKind.Reference,
              name: "IdentifierCharacter",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _.flat().join(""),
      },
    },
    {
      name: "IdentifierStartCharacter",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Reference,
            name: "Letter",
            args: [],
          },
          {
            kind: PatternKind.Equal,
            value: "_",
          },
        ],
      },
    },
    {
      name: "IdentifierCharacter",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Reference,
            name: "IdentifierStartCharacter",
            args: [],
          },
          {
            kind: PatternKind.Reference,
            name: "Digit",
            args: [],
          },
          {
            kind: PatternKind.Reference,
            name: "Connecting",
            args: [],
          },
          {
            kind: PatternKind.Reference,
            name: "Combining",
            args: [],
          },
          {
            kind: PatternKind.Reference,
            name: "Formatting",
            args: [],
          },
        ],
      },
    },
    // {
    //   name: "DecimalDigitCharacter",
    //   parameters: [],
    //   pattern: {
    //     kind: PatternKind.Character,
    //     characterClass: CharacterClass.DecimalDigitNumber,
    //   },
    // },
  ],
};

export default Identifier;
