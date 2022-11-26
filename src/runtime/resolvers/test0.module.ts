import { DeclarationKind } from "../declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../declarations/module.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";

export default {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "A",
      pattern: {
        kind: PatternKind.Range,
        left: "0",
        right: "9"
      }
    },
    {
      kind: DeclarationKind.Rule,
      name: "B",
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Reference,
          name: "A"
        }
      }
    }
  ]
} as IModuleDeclaration