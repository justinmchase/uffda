import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { OneOrMorePattern } from "./OneOrMorePattern.ts";
import { ZeroOrMorePattern } from "./ZeroOrMorePattern.ts";
import { ZeroOrOnePattern } from "./ZeroOrOnePattern.ts";
import { TerminalPattern } from "./TerminalPattern.ts";

export const SlicePattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: OneOrMorePattern,
      moduleUrl: "./OneOrMorePattern.ts",
      names: ["OneOrMorePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: ZeroOrMorePattern,
      moduleUrl: "./ZeroOrMorePattern.ts",
      names: ["ZeroOrMorePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: ZeroOrOnePattern,
      moduleUrl: "./ZeroOrOnePattern.ts",
      names: ["ZeroOrOnePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: TerminalPattern,
      moduleUrl: "./TerminalPattern.ts",
      names: ["TerminalPattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "SlicePattern",
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Reference, name: "OneOrMorePattern" },
          { kind: PatternKind.Reference, name: "ZeroOrMorePattern" },
          { kind: PatternKind.Reference, name: "ZeroOrOnePattern" },
          { kind: PatternKind.Reference, name: "TerminalPattern" },
        ],
      },
    }
  ]
};
