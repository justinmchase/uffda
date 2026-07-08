import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";

export const Spread: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../tokenizer/token.ts",
      names: ["Token"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "SpreadMarker",
      default: true,
    },
  ],
  rules: [
    {
      name: "Dot",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "." },
    },
    {
      name: "SpreadMarker",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["Dot"],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["Dot"],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["Dot"],
          },
        ],
      },
    },
  ],
};

export default Spread;
