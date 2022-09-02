import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests(() => [
  {
    id: "SLICE00",
    description: "zero or more matches ok without infinite looping",
    pattern: () => ({
      kind: PatternKind.Slice,
      pattern: {
        kind: PatternKind.Ok,
      },
    }),
    input: "",
    value: [],
  },
  {
    id: "SLICE01",
    description: "zero or more matches empty set",
    pattern: () => ({
      kind: PatternKind.Slice,
      pattern: {
        kind: PatternKind.Any,
      },
    }),
    input: "",
    value: [],
  },
  {
    id: "SLICE02",
    description: "zero or more matches a single element",
    pattern: () => ({
      kind: PatternKind.Slice,
      pattern: { kind: PatternKind.String },
    }),
    input: "a",
    value: ["a"],
  },
  {
    id: "SLICE03",
    description: "zero or more matches multiple elements",
    pattern: () => ({
      kind: PatternKind.Slice,
      pattern: { kind: PatternKind.String },
    }),
    input: "abc",
    value: ["a", "b", "c"],
  },
  {
    id: "SLICE04",
    description: "zero or more not matching is still a success",
    pattern: () => ({
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Slice,
          pattern: {
            kind: PatternKind.RegExp,
            pattern: /a/,
          },
        },
        { kind: PatternKind.Any },
      ],
    }),
    input: "b",
    value: [[], "b"],
  },
  {
    id: "SLICE05",
    description: "zero or more not matching at end is still a success",
    pattern: () => ({
      kind: PatternKind.Then,
      patterns: [
        { kind: PatternKind.Any },
        {
          kind: PatternKind.Slice,
          pattern: {
            kind: PatternKind.RegExp,
            pattern: /a/,
          },
        },
      ],
    }),
    input: "a",
    value: ["a", []],
  },
  {
    id: "SLICE06",
    description: "one or more fails ok without infinite looping",
    pattern: () => ({
      kind: PatternKind.Slice,
      pattern: { kind: PatternKind.Any },
      min: 1,
    }),
    input: "",
    matched: false,
  },
  {
    id: "SLICE07",
    description: "one or more fails on empty set",
    pattern: () => ({
      kind: PatternKind.Slice,
      pattern: { kind: PatternKind.Any },
      min: 1,
    }),
    input: "",
    matched: false,
  },
  {
    id: "SLICE08",
    description: "one or more matches one item",
    pattern: () => ({
      kind: PatternKind.Slice,
      pattern: { kind: PatternKind.String },
      min: 1,
    }),
    input: "a",
    value: ["a"],
  },
  {
    id: "SLICE09",
    description: "one or more matches multiple items",
    pattern: () => ({
      kind: PatternKind.Slice,
      pattern: { kind: PatternKind.String },
      min: 1,
    }),
    input: "abc",
    value: ["a", "b", "c"],
  },
  {
    id: "SLICE10",
    description: "exact number matches exactly",
    pattern: () => ({
      kind: PatternKind.Slice,
      pattern: { kind: PatternKind.String },
      min: 3,
      max: 3,
    }),
    input: "abc",
    value: ["a", "b", "c"],
  },
  {
    id: "SLICE11",
    description: "exact number fails with not enough items",
    pattern: () => ({
      kind: PatternKind.Slice,
      pattern: { kind: PatternKind.String },
      min: 3,
      max: 3,
    }),
    input: "ab",
    matched: false,
    done: false,
  },
  {
    id: "SLICE12",
    description: "exact number does not read too many items",
    pattern: () => ({
      kind: PatternKind.Slice,
      pattern: { kind: PatternKind.String },
      min: 3,
      max: 3,
    }),
    input: "abcd",
    value: ["a", "b", "c"],
    done: false,
  },
  {
    id: "SLICE13",
    description: "slice propagates errors properly",
    pattern: () => ({
      kind: PatternKind.Slice,
      pattern: {
        kind: PatternKind.Until,
        pattern: { kind: PatternKind.Any },
        name: "Test",
        message: "test",
      },
      min: 0,
    }),
    input: "a",
    errors: [{ name: "Test", message: "test", start: "0", end: "1" }],
    value: [undefined],
  },
]);
