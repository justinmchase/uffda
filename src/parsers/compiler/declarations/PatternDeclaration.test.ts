import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { LangModuleKind, LangPatternKind } from "../../lang/lang.pattern.ts";
import { PatternDeclaration } from "./PatternDeclaration.ts";

tests(() => [
  {
    id: "PATTERNDECLARATION00",
    description: "X = ok;",
    module: () => PatternDeclaration,
    input: [
      {
        kind: LangModuleKind.PatternDeclaration,
        name: "X",
        pattern: {
          kind: LangPatternKind.OkPattern
        }
      }
    ],
    value: {
      kind: DeclarationKind.Rule,
      name: "X",
      pattern: {
        kind: PatternKind.Ok,
      }
    },
  },
]);
