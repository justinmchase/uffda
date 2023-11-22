import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { ValueType } from "./pattern.ts";

tests(() => [
  {
    id: "RUNTIME.PATTERN.OBJECT00",
    description: "matches an object without keys",
    pattern: () => ({
      kind: PatternKind.Object,
      keys: {},
    }),
    input: [{}],
    value: {},
  },
  {
    id: "RUNTIME.PATTERN.OBJECT01",
    description: "matches an object with extra keys",
    pattern: () => ({
      kind: PatternKind.Object,
      keys: {},
    }),
    input: [{ x: "a" }],
    value: { x: "a" },
  },
  {
    id: "RUNTIME.PATTERN.OBJECT02",
    description: "matches an object and key",
    pattern: () => ({
      kind: PatternKind.Object,
      keys: {
        x: { kind: PatternKind.Type, type: ValueType.String },
      },
    }),
    input: [{ x: "a" }],
    value: { x: "a" },
  },
  {
    id: "RUNTIME.PATTERN.OBJECT03",
    description: "fails to match an object missing a key",
    pattern: () => ({
      kind: PatternKind.Object,
      keys: {
        x: { kind: PatternKind.Type, type: ValueType.String },
      },
    }),
    input: [{}],
    matched: false,
    done: false,
  },
  {
    id: "RUNTIME.PATTERN.OBJECT04",
    description: "matches if all keys match",
    pattern: () => ({
      kind: PatternKind.Object,
      keys: {
        type: {
          kind: PatternKind.Equal,
          value: "x",
        },
        value: {
          kind: PatternKind.Equal,
          value: "y",
        },
      },
    }),
    input: [{ type: "x", value: "y" }],
    value: { type: "x", value: "y" },
  },
]);
