import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

export const Token: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "Token",
      pattern: {
        kind: PatternKind.RegExp,
        pattern: /^[^\w\d\s]$/,
      }
    }
  ]
};
