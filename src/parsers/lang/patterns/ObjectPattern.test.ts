import { tests } from "../../../test.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { ObjectPattern } from "./ObjectPattern.ts";
import { TokenizerKind } from "../../mod.ts";

tests(() => [
  {
    id: "LANG.PATTERN.OBJECT00",
    module: () => ObjectPattern,
    input: [
      // "{}",
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangPatternKind.ObjectPattern,
      keys: [],
    },
  },
  {
    id: "LANG.PATTERN.OBJECT01",
    module: () => ObjectPattern,
    // input: "{ x }",
    input: [
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangPatternKind.ObjectPattern,
      keys: [
        {
          kind: LangPatternKind.ObjectKeyPattern,
          name: "x",
        },
      ],
    },
  },
  {
    id: "LANG.PATTERN.OBJECT02",
    module: () => ObjectPattern,
    input: [
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: ":" },
      { kind: TokenizerKind.Identifier, value: "y" },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangPatternKind.ObjectPattern,
      keys: [
        {
          kind: LangPatternKind.ObjectKeyPattern,
          alias: "x",
          name: "y",
          must: false,
        },
      ],
    },
  },
  {
    id: "LANG.PATTERN.OBJECT03",
    module: () => ObjectPattern,
    input: [
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: ":" },
      { kind: TokenizerKind.Identifier, value: "y" },
      { kind: TokenizerKind.Token, value: "=" },
      { kind: TokenizerKind.Identifier, value: "z" },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangPatternKind.ObjectPattern,
      keys: [
        {
          kind: LangPatternKind.ObjectKeyPattern,
          alias: "x",
          name: "y",
          pattern: {
            kind: LangPatternKind.ReferencePattern,
            name: "z",
          },
        },
      ],
    },
  },
  {
    id: "LANG.PATTERN.OBJECT04",
    module: () => ObjectPattern,
    // input: "{ x = y }",
    input: [
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "=" },
      { kind: TokenizerKind.Identifier, value: "y" },
      { kind: TokenizerKind.Token, value: "," },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangPatternKind.ObjectPattern,
      keys: [
        {
          kind: LangPatternKind.ObjectKeyPattern,
          name: "x",
          pattern: {
            kind: LangPatternKind.ReferencePattern,
            name: "y",
          },
        },
      ],
    },
  },
  {
    id: "LANG.PATTERN.OBJECT05",
    module: () => ObjectPattern,
    input: [
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "=" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "," },
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "=" },
      { kind: TokenizerKind.Identifier, value: "y" },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangPatternKind.ObjectPattern,
      keys: [
        {
          kind: LangPatternKind.ObjectKeyPattern,
          name: "a",
          pattern: {
            kind: LangPatternKind.ReferencePattern,
            name: "b",
          },
        },
        {
          kind: LangPatternKind.ObjectKeyPattern,
          name: "x",
          pattern: {
            kind: LangPatternKind.ReferencePattern,
            name: "y",
          },
        },
      ],
    },
  },
  {
    id: "LANG.PATTERN.OBJECT06",
    module: () => ObjectPattern,
    input: [
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "!" },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangPatternKind.ObjectPattern,
      keys: [
        {
          kind: LangPatternKind.ObjectKeyPattern,
          name: "a",
          must: true,
        },
      ],
    },
  },
  {
    id: "LANG.PATTERN.OBJECT07",
    module: () => ObjectPattern,
    input: [
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: ":" },
      { kind: TokenizerKind.Identifier, value: "y" },
      { kind: TokenizerKind.Token, value: "!" },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangPatternKind.ObjectPattern,
      keys: [
        {
          kind: LangPatternKind.ObjectKeyPattern,
          alias: "x",
          name: "y",
          must: true,
        },
      ],
    },
  },
  {
    id: "LANG.PATTERN.OBJECT08",
    module: () => ObjectPattern,
    input: [
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "=" },
      { kind: TokenizerKind.Identifier, value: "string" },
      { kind: TokenizerKind.Token, value: "!" },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangPatternKind.ObjectPattern,
      keys: [
        {
          kind: LangPatternKind.ObjectKeyPattern,
          name: "a",
          pattern: {
            kind: LangPatternKind.MustPattern,
            name: "PatternExpected",
            description: "StringPattern is expected",
            pattern: {
              kind: LangPatternKind.StringPattern,
            },
          },
        },
      ],
    },
  },
  {
    id: "LANG.PATTERN.OBJECT09",
    description: "can parse an object with trailing comma",
    module: () => ObjectPattern,
    input: [
      // "{ a = b, x = y, }",
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "=" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "," },
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "=" },
      { kind: TokenizerKind.Identifier, value: "y" },
      { kind: TokenizerKind.Token, value: "," },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangPatternKind.ObjectPattern,
      keys: [
        {
          kind: LangPatternKind.ObjectKeyPattern,
          name: "a",
          pattern: {
            kind: LangPatternKind.ReferencePattern,
            name: "b",
          },
        },
        {
          kind: LangPatternKind.ObjectKeyPattern,
          name: "x",
          pattern: {
            kind: LangPatternKind.ReferencePattern,
            name: "y",
          },
        },
      ],
    },
  },
]);
