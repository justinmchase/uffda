import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { AnyPattern } from "./AnyPattern.ts";
import { GroupPattern } from "./GroupPattern.ts";
import { NumberPattern } from "./NumberPattern.ts";
import { ObjectPattern } from "./ObjectPattern.ts";
import { OkPattern } from "./OkPattern.ts";
import { RangePattern } from "./RangePattern.ts";
import { ReferencePattern } from "./ReferencePattern.ts";
import { SpecialReferencePattern } from "./SpecialReferencePattern.ts";
import { StringPattern } from "./StringPattern.ts";
import { TypePattern } from "./TypePattern.ts";

export const TerminalPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: AnyPattern,
      moduleUrl: "./AnyPattern.ts",
      names: ["AnyPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: OkPattern,
      moduleUrl: "./OkPattern.ts",
      names: ["OkPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: TypePattern,
      moduleUrl: "./TypePattern.ts",
      names: ["TypePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: SpecialReferencePattern,
      moduleUrl: "./SpecialReferencePattern.ts",
      names: ["SpecialReferencePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: ReferencePattern,
      moduleUrl: "./ReferencePattern.ts",
      names: ["ReferencePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: ObjectPattern,
      moduleUrl: "./ObjectPattern.ts",
      names: ["ObjectPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: RangePattern,
      moduleUrl: "./RangePattern.ts",
      names: ["RangePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: StringPattern,
      moduleUrl: "./StringPattern.ts",
      names: ["StringPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: NumberPattern,
      moduleUrl: "./NumberPattern.ts",
      names: ["NumberPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: GroupPattern,
      moduleUrl: "./GroupPattern.ts",
      names: ["GroupPattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "TerminalPattern",
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Reference, name: "AnyPattern" },
          { kind: PatternKind.Reference, name: "OkPattern" },
          { kind: PatternKind.Reference, name: "TypePattern" },
          { kind: PatternKind.Reference, name: "SpecialReferencePattern" },
          { kind: PatternKind.Reference, name: "ReferencePattern" },
          { kind: PatternKind.Reference, name: "ObjectPattern" },
          { kind: PatternKind.Reference, name: "RangePattern" },
          { kind: PatternKind.Reference, name: "StringPattern" },
          { kind: PatternKind.Reference, name: "NumberPattern" },
          { kind: PatternKind.Reference, name: "GroupPattern" },
        ],
      },
    },
  ],
};
