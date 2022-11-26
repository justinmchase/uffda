import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ObjectKeyMustPattern } from "./ObjectKeyMustPattern.ts";
import { ObjectKeyReferencePattern } from "./ObjectKeyReferencePattern.ts";
import { ObjectKeyVariablePattern } from "./ObjectKeyVariablePattern.ts";
import { ObjectKeyVariableWithPattern } from "./ObjectKeyVariableWithPattern.ts";
import { ObjectKeyWithPattern } from "./ObjectKeyWithPattern.ts";

export const ObjectKeyPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: ObjectKeyVariableWithPattern,
      moduleUrl: "./ObjectKeyVariableWithPattern.ts",
      names: ["ObjectKeyVariableWithPattern"]
    },
    {
      kind: DeclarationKind.NativeImport,
      module: ObjectKeyVariablePattern,
      moduleUrl: "./ObjectKeyVariablePattern.ts",
      names: ["ObjectKeyVariablePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: ObjectKeyWithPattern,
      moduleUrl: "./ObjectKeyWithPattern.ts",
      names: ["ObjectKeyWithPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: ObjectKeyMustPattern,
      moduleUrl: "./ObjectKeyMustPattern.ts",
      names: ["ObjectKeyMustPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: ObjectKeyReferencePattern,
      moduleUrl: "./ObjectKeyReferencePattern.ts",
      names: ["ObjectKeyReferencePattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ObjectKeyPattern",
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Reference, name: "ObjectKeyVariableWithPattern" },
          { kind: PatternKind.Reference, name: "ObjectKeyVariablePattern" },
          { kind: PatternKind.Reference, name: "ObjectKeyWithPattern" },
          { kind: PatternKind.Reference, name: "ObjectKeyMustPattern" },
          { kind: PatternKind.Reference, name: "ObjectKeyReferencePattern" },
        ],
      },
    }
  ]
};
