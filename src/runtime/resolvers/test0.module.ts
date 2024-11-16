import { PatternKind } from "../patterns/pattern.kind.ts";
import { ExportDeclarationKind } from "../declarations/export.ts";
import type { ModuleDeclaration } from "../declarations/module.ts";

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
