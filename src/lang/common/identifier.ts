import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import {
  ImportDeclarationKind,
  type ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { Combining } from "./characters/combining.ts";
import { Letter } from "./characters/letter.ts";
import { Formatting } from "./characters/formatting.ts";

// import ./letter.ts (Letter);
// import ./digit.uff (Digit);
// import ./connecting.uff (Connecting);
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
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./characters/digit.uff",
      names: [
        "Digit",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./characters/connecting.uff",
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
      default: true,
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
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "IdentifierStartCharacter",
            args: [],
          },
          {
            kind: PatternKind.Quantifier,
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
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
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
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
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "IdentifierStartCharacter",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Digit",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Connecting",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Combining",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
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
