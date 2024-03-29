import {
  DeclarationKind,
  IModuleDeclaration,
} from "../runtime/declarations/mod.ts";
import { PatternKind } from "../runtime/patterns/mod.ts";

import { Whitespace } from "./common/whitespace.ts";

export const Tokenizer: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: Whitespace,
      moduleUrl: "./common/whitespace.ts",
      names: [
        "Whitespace",
      ],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "Main",
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Reference,
          name: "Whitespace",
        },
      },
    },
  ],
  // name: "Tokenizer",
  // imports:
  // rules:
};

export default Tokenizer;
