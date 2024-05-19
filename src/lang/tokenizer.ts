import {
  ExportDeclarationKind,
  ImportDeclarationKind,
  ModuleDeclaration,
} from "../runtime/declarations/mod.ts";
import { PatternKind } from "../runtime/patterns/mod.ts";

import { Whitespace } from "./common/whitespace.ts";

export const Tokenizer: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Native,
      module: Whitespace,
      moduleUrl: "./common/whitespace.ts",
      names: [
        "Whitespace",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Main",
    },
  ],
  rules: [
    {
      name: "Main",
      parameters: [],
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Reference,
          name: "Whitespace",
          args: [],
        },
      },
    },
  ],
  // name: "Tokenizer",
  // imports:
  // rules:
};

export default Tokenizer;
