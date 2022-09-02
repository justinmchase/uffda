import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests(import.meta.url, () => [
  {
    id: "UNLESS00",
    description: "'a'!",
    pattern: () => ({
      kind: PatternKind.Unless,
      name: "Test",
      message: "testing",
      pattern: {
        kind: PatternKind.Equal,
        value: "a",
      },
    }),
    input: "",
    matched: true,
    errors: [
      { name: 'Test', message: "testing", start: "0", end: "0" }
    ]
  },
  {
    id: "UNLESS01",
    description: "'a'!",
    pattern: () => ({
      kind: PatternKind.Unless,
      name: "Test",
      message: "testing",
      pattern: {
        kind: PatternKind.Equal,
        value: "a",
      },
    }),
    input: "b",
    matched: true,
    done: false,
    errors: [
      { name: 'Test', message: "testing", start: "0", end: "0" }
    ]
  },
  {
    id: "UNLESS02",
    description: "'a'!",
    pattern: () => ({
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Equal,
          value: 'a'
        },
        {
          kind: PatternKind.Unless,
          name: "Test",
          message: "testing",
          pattern: {
            kind: PatternKind.Equal,
            value: ";",
          },
        }
      ]
    }),
    input: "a;",
    value: ['a', ';'],
  },
  {
    id: "UNLESS03",
    description: "'a'!",
    pattern: () => ({
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Equal,
          value: 'a'
        },
        {
          kind: PatternKind.Unless,
          name: "Test",
          message: "testing",
          pattern: {
            kind: PatternKind.Equal,
            value: ";",
          },
        }
      ]
    }),
    input: "a:",
    matched: true,
    done: false,
    value: ['a', undefined],
    errors: [
      { name: 'Test', message: "testing", start: "1", end: "1" }
    ],
  }
]);
