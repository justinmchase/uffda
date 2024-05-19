import { ExportDeclarationKind } from "../declarations/mod.ts";
import { ModuleDeclaration } from "../declarations/module.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";

export default {
  imports: [],
  exports: [
    { kind: ExportDeclarationKind.Rule, name: "A" },
    { kind: ExportDeclarationKind.Rule, name: "B" },
  ],
  rules: [
    {
      name: "A",
      parameters: [],
      pattern: {
        kind: PatternKind.Range,
        left: "0",
        right: "9",
      },
    },
    {
      name: "B",
      parameters: [],
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Reference,
          name: "A",
        },
      },
    },
  ],
} as ModuleDeclaration;
