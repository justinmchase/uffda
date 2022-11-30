import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

export const Letter: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "Letter",
      pattern: {
        kind: PatternKind.RegExp,
        pattern: /_|\p{L}/u,
      },
    },
  ],
};

export default Letter;
