import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "OBJECT00",
    description: "can parse empty object",
    pattern: () => TestLang,
    input: "{}",
    value: {
      kind: LangPatternKind.ObjectPattern,
      keys: [],
    },
  },
  {
    id: "OBJECT01",
    description: "can parse an object with a key",
    pattern: () => TestLang,
    input: "{ x }",
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
    id: "OBJECT02",
    description: "can parse an object with a variable key",
    pattern: () => TestLang,
    input: "{ x:y }",
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
    id: "OBJECT03",
    description: "can parse an object with a pattern key",
    pattern: () => TestLang,
    input: "{ x:y = z }",
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
    id: "OBJECT04",
    description: "can parse an object with a pattern key",
    pattern: () => TestLang,
    input: "{ x = y }",
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
    id: "OBJECT05",
    description: "can parse an object with two pattern keys",
    pattern: () => TestLang,
    input: "{ a = b, x = y }",
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
    id: "OBJECT06",
    description: "{ a! }",
    pattern: () => TestLang,
    input: "{ a! }",
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
    id: "OBJECT07",
    description: "{ x:y! }",
    pattern: () => TestLang,
    input: "{ x:y! }",
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
    id: "OBJECT08",
    description: "{ a = string }",
    pattern: () => TestLang,
    input: "{ a = string! }",
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
    id: "OBJECT09",
    description: "can parse an object with trailing comma",
    pattern: () => TestLang,
    input: "{ a = b, x = y, }",
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
