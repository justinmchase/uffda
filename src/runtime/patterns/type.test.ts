import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { ValueType } from "./pattern.ts";

tests(() => [
  {
    id: "TYPE00",
    description: "reads a string successfully",
    pattern: () => ({ kind: PatternKind.Type, type: ValueType.String }),
    input: ["a"],
    value: "a",
  },
  {
    id: "TYPE01",
    description: "does not read a non-string",
    pattern: () => ({ kind: PatternKind.Type, type: ValueType.String }),
    input: [7],
    matched: false,
    done: false,
  },
  {
    id: "TYPE02",
    description: "reads a number successfully",
    pattern: () => ({ kind: PatternKind.Type, type: ValueType.Number }),
    input: [7],
    value: 7,
  },
  {
    id: "TYPE03",
    description: "does not read a non-number",
    pattern: () => ({ kind: PatternKind.Type, type: ValueType.Number }),
    input: ["a"],
    matched: false,
    done: false,
  },
  {
    id: "TYPE04",
    description: "boolean",
    pattern: () => ({ kind: PatternKind.Type, type: ValueType.Boolean }),
    input: [true],
    value: true,
  },
  {
    id: "TYPE05",
    description: "boolean",
    pattern: () => ({ kind: PatternKind.Type, type: ValueType.Boolean }),
    input: [7],
    matched: false,
    done: false,
  },
  // todo: the other types too
]);
