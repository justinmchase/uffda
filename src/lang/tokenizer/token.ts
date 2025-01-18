import { Type } from "@justinmchase/type";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";

export const Token: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: new URL("../common/surround.ts", import.meta.url).href,
      names: ["Surround"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl:
        new URL("../common/characters/whitespace.ts", import.meta.url).href,
      names: ["Whitespace"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Token",
    },
  ],
  rules: [
    {
      name: "W",
      parameters: [],
      pattern: {
        kind: PatternKind.And,
        patterns: [
          {
            kind: PatternKind.Type,
            type: Type.String,
          },
          {
            kind: PatternKind.Into,
            pattern: {
              kind: PatternKind.Slice,
              min: 0,
              pattern: {
                kind: PatternKind.Reference,
                name: "Whitespace",
                args: [],
              },
            },
          },
        ],
      },
    },
    {
      name: "Token",
      parameters: [
        { name: "P" },
      ],
      pattern: {
        kind: PatternKind.Reference,
        name: "Surround",
        args: ["W", "P", "W"],
      },
    },
  ],
};

export default Token;
