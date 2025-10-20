import { Type } from "@justinmchase/type";
import {
  ExportDeclarationKind,
  ImportDeclarationKind,
  type ModuleDeclaration,
} from "../../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";

export const Insignificant: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../characters/whitespace.ts",
      names: [
        "Whitespace",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../characters/newLine.ts",
      names: [
        "NewLine",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Insignificant",
      default: true,
    },
  ],
  rules: [
    {
      name: "WhitespacePattern",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
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
                  min: 1,
                  pattern: {
                    kind: PatternKind.Reference,
                    name: "Whitespace",
                    args: [],
                  },
                },
              },
            ],
          },
          {
            kind: PatternKind.Reference,
            name: "NewLine",
            args: [],
          },
        ],
      },
    },
    {
      name: "NotWhitespacePattern",
      parameters: [],
      pattern: {
        kind: PatternKind.And,
        patterns: [
          {
            kind: PatternKind.Not,
            pattern: {
              kind: PatternKind.Reference,
              name: "WhitespacePattern",
              args: [],
            },
          },
          {
            kind: PatternKind.Type,
            type: Type.String,
          },
        ],
      },
    },
    {
      name: "StringExpressionPattern",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: '"',
          },
          {
            kind: PatternKind.Variable,
            name: "content",
            pattern: {
              kind: PatternKind.Slice,
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    // Match escaped expression \$( - keep as literal, preserve whitespace
                    kind: PatternKind.Then,
                    patterns: [
                      {
                        kind: PatternKind.Equal,
                        value: "\\",
                      },
                      {
                        kind: PatternKind.Equal,
                        value: "$",
                      },
                      {
                        kind: PatternKind.Equal,
                        value: "(",
                      },
                      {
                        kind: PatternKind.Variable,
                        name: "escaped_content",
                        pattern: {
                          kind: PatternKind.Slice,
                          pattern: {
                            kind: PatternKind.And,
                            patterns: [
                              {
                                kind: PatternKind.Not,
                                pattern: {
                                  kind: PatternKind.Equal,
                                  value: ")",
                                },
                              },
                              {
                                kind: PatternKind.Type,
                                type: Type.Unknown,
                              },
                            ],
                          },
                        },
                      },
                      {
                        kind: PatternKind.Equal,
                        value: ")",
                      },
                    ],
                  },
                  {
                    // Match $( and then recursively process until )
                    kind: PatternKind.Then,
                    patterns: [
                      {
                        kind: PatternKind.Equal,
                        value: "$",
                      },
                      {
                        kind: PatternKind.Equal,
                        value: "(",
                      },
                      {
                        kind: PatternKind.Variable,
                        name: "expr",
                        pattern: {
                          kind: PatternKind.Reference,
                          name: "Insignificant",
                          args: [],
                        },
                      },
                      {
                        kind: PatternKind.Equal,
                        value: ")",
                      },
                    ],
                  },
                  {
                    // Match any non-quote, non-$ character
                    kind: PatternKind.And,
                    patterns: [
                      {
                        kind: PatternKind.Not,
                        pattern: {
                          kind: PatternKind.Equal,
                          value: '"',
                        },
                      },
                      {
                        kind: PatternKind.Not,
                        pattern: {
                          kind: PatternKind.Equal,
                          value: "$",
                        },
                      },
                      {
                        kind: PatternKind.Type,
                        type: Type.Unknown,
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            kind: PatternKind.Equal,
            value: '"',
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ content }) => ['"', ...content.flat(), '"'],
      },
    },
    {
      name: "Insignificant",
      parameters: [],
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Reference,
              name: "StringExpressionPattern",
              args: [],
            },
            {
              kind: PatternKind.Reference,
              name: "NotWhitespacePattern",
              args: [],
            },
          ],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _.flat(),
      },
    },
  ],
};

export default Insignificant;
