import { assert } from "../../deps/std.ts";
import { tests } from "../test.ts";
import { DeclarationKind } from "./declarations/declaration.kind.ts";
import { IModuleDeclaration } from "./declarations/module.ts";
import { ExpressionKind } from "./expressions/expression.kind.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";

tests(() => [
  {
    id: "RULE00",
    description: "can parse a non-recursive rule",
    module: () => ({
      kind: DeclarationKind.Module,
      imports: [],
      rules: [
        {
          kind: DeclarationKind.Rule,
          name: "R",
          pattern: {
            kind: PatternKind.Equal,
            value: "a",
          },
        }
      ]
    }),
    input: "a",
    value: "a",
  },
  {
    id: "RULE01",
    description: "non-progressive recursive patterns only match a single item",
    module: () => ({
      kind: DeclarationKind.Module,
      imports: [],
      rules: [
        {
          // a = a | 'a'
          kind: DeclarationKind.Rule,
          name: "a",
          pattern: {
            kind: PatternKind.Or,
            patterns: [
              {
                kind: PatternKind.Reference,
                name: "a",
              },
              {
                kind: PatternKind.Equal,
                value: "a",
              },
            ],
          },
        },
      ],
    }),
    input: "aa",
    value: "a",
    done: false,
  },
  {
    id: "RULE02",
    description: "lr patterns match multiple items",
    module: () => ({
      kind: DeclarationKind.Module,
      imports: [],
      rules: [
        {
          kind: DeclarationKind.Rule,
          name: "a",
          // a = a 'a' | 'a'
          pattern: {
            kind: PatternKind.Or,
            patterns: [
              {
                kind: PatternKind.Then,
                patterns: [
                  { kind: PatternKind.Reference, name: "a" },
                  { kind: PatternKind.Equal, value: "a" },
                ],
              },
              { kind: PatternKind.Equal, value: "a" },
            ],
          },
        },
      ],
    }),
    input: "aaa",
    value: [["a", "a"], "a"],
  },
  {
    id: "RULE03",
    description: "indirect left recursion results in an error",
    module: () => ({
      kind: DeclarationKind.Module,
      imports: [],
      rules: [
        {
          kind: DeclarationKind.Rule,
          name: "a",
          pattern: {
            kind: PatternKind.Reference,
            name: "b",
          },
        },
        {
          kind: DeclarationKind.Rule,
          name: "b",
          pattern: {
            kind: PatternKind.Reference,
            name: "a",
          },
        },
      ]
    }),
    input: "ab",
    matched: false,
    done: false,
  },
  {
    id: "RULE04",
    description: "right recursion is fine",
    module: () => ({
      kind: DeclarationKind.Module,
      imports: [],
      rules: [
        {
          // a = 'a' a | 'a'
          kind: DeclarationKind.Rule,
          name: "a",
          pattern: {
            kind: PatternKind.Or,
            patterns: [
              {
                kind: PatternKind.Then,
                patterns: [
                  { kind: PatternKind.Equal, value: "a" },
                  { kind: PatternKind.Reference, name: "a" },
                ],
              },
              { kind: PatternKind.Equal, value: "a" },
            ],
          },
        },
      ],
    }),
    input: "aaa",
    value: ["a", ["a", "a"]],
  },
  {
    id: "RULE05",
    description: "upper variables should not be available in lower scopes",
    module: () => ({
      kind: DeclarationKind.Module,
      imports: [],
      rules: [
        {
          kind: DeclarationKind.Rule,
          name: "P0",
          pattern: {
            kind: PatternKind.Projection,
            pattern: { kind: PatternKind.Any },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ x }) => (assert(x === undefined, `x should be undefined but is '${x}'`), true),
            },
          },
        },
        {
          kind: DeclarationKind.Rule,
          name: "P1",
          pattern: {
            kind: PatternKind.Then,
            patterns: [
              {
                kind: PatternKind.Variable,
                name: "x",
                pattern: { kind: PatternKind.Any },
              },
              {
                kind: PatternKind.Or,
                patterns: [
                  { kind: PatternKind.Reference, name: "P0" },
                  { kind: PatternKind.Any },
                ],
              },
            ],
          },
        },
      ],
    }),
    input: "ab",
    value: ["a", true],
  },
  {
    id: "RULE06",
    description: "lower variables should not be available in upper scope",
    module: () => ({
      kind: DeclarationKind.Module,
      imports: [],
      rules: [
        {
          kind: DeclarationKind.Rule,
          name: "P0",
          pattern: {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Variable,
              name: "x",
              pattern: { kind: PatternKind.Any },
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ x }) => (assert(x === "a"), x),
            },
          },
        },
        {
          kind: DeclarationKind.Rule,
          name: "P1",
          pattern: {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Reference,
              name: "P0",
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: (
                { x, _ },
              ) => (assert(x === undefined), _),
            },
          },
        },
      ],
    }),
    input: "a",
    value: "a",
  },
  {
    id: "RULE07",
    description: "variables in different modules should not be available",
    module: () => {
      const m0: IModuleDeclaration = {
        kind: DeclarationKind.Module,
        imports: [],
        rules: [
          {
            kind: DeclarationKind.Rule,
            name: "P0",
            pattern: {
              kind: PatternKind.Projection,
              pattern: { kind: PatternKind.Any },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ x }) => (assert(x === undefined, `x should be undefined but is '${x}'`), true),
              },
            },
          },
        ]
      };
      const m1: IModuleDeclaration = {
        kind: DeclarationKind.Module,
        imports: [
          {
            kind: DeclarationKind.NativeImport,
            module: m0,
            moduleUrl: "./m0.ts",
            names: ["P0"],
          }
        ],
        rules: [
          {
            kind: DeclarationKind.Rule,
            name: "P1",
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                {
                  kind: PatternKind.Variable,
                  name: "x",
                  pattern: { kind: PatternKind.Any },
                },
                {
                  kind: PatternKind.Or,
                  patterns: [
                    { kind: PatternKind.Reference, name: "P0" },
                    { kind: PatternKind.Any },
                  ],
                },
              ],
            },
          },
        ],
      }
      return m1;
    },
    input: "ab",
    value: ["a", true],
  },
  // todo: two identical rules with different native projections should not trigger DLR
]);
