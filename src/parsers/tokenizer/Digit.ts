import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

// export const Digit: Pattern = {
//   kind: PatternKind.RegExp,
//   pattern: /[0-9]/,
// };

export const Digit: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "Digit",
      pattern: {
        kind: PatternKind.Range,
        left: "0",
        right: "9",
      },
    },
  ],
};

export default Digit;
