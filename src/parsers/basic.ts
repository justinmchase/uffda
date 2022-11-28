import { Tokenizer } from "../mod.ts";
import { DeclarationKind } from "../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../runtime/declarations/module.ts";
import { PatternKind } from "../runtime/patterns/mod.ts";
import { ExcludeWhitespace} from "./exclusion/mod.ts";

export const Basic: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./tokenizer/Tokenizer.ts",
      module: () => Tokenizer,
      names: ["Tokenizer"]
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./exclusion/ExcludeWhitespace.ts",
      module: () => ExcludeWhitespace,
      names: ["ExcludeWhitespace"]
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "Basic",
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          { kind: PatternKind.Reference, name: "Tokenizer" },
          { kind: PatternKind.Reference, name: "ExcludeWhitespace" },
        ],
      },
    },
  ],
};
