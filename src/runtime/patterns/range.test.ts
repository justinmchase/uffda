import { Comparable } from "../../comparable.ts";
import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

class Test {
  constructor(public readonly value: number) {}
  public compareTo(obj: Test) {
    return this.value == obj.value ? 0 : this.value > obj.value ? -1 : 1;
  }
}

const t = new Test(1);

tests(() => [
  {
    id: "RANGE00",
    pattern: () => ({
      kind: PatternKind.Range,
      left: 0,
      right: 2,
    }),
    input: [1],
    matched: true,
    value: 1,
  },
  {
    id: "RANGE01",
    pattern: () => ({
      kind: PatternKind.Range,
      left: 0,
      right: 0,
    }),
    input: [0],
    matched: true,
    value: 0,
  },
  {
    id: "RANGE02",
    pattern: () => ({
      kind: PatternKind.Range,
      left: 0,
      right: 1,
    }),
    input: [1],
    matched: true,
    value: 1,
  },
  {
    id: "RANGE03",
    pattern: () => ({
      kind: PatternKind.Range,
      left: "a",
      right: "a",
    }),
    input: "a",
    matched: true,
    value: "a",
  },
  {
    id: "RANGE04",
    pattern: () => ({
      kind: PatternKind.Range,
      left: "a",
      right: "b",
    }),
    input: "b",
    matched: true,
    value: "b",
  },
  {
    id: "RANGE05",
    pattern: () => ({
      kind: PatternKind.Range,
      left: "a",
      right: "c",
    }),
    input: "b",
    matched: true,
    value: "b",
  },
  {
    id: "RANGE06",
    pattern: () => ({
      kind: PatternKind.Range,
      left: "a",
      right: "b",
    }),
    input: "v",
    matched: false,
    done: false,
  },
  {
    id: "RANGE07",
    pattern: () => ({
      kind: PatternKind.Range,
      left: 0,
      right: 1,
    }),
    input: [2],
    matched: false,
    done: false,
  },

  {
    id: "RANGE08",
    pattern: () => ({
      kind: PatternKind.Range,
      left: new Test(1),
      right: new Test(1),
    }),
    input: [t],
    matched: true,
    value: t,
  },
  {
    id: "RANGE09",
    pattern: () => ({
      kind: PatternKind.Range,
      left: new Test(1),
      right: new Test(2),
    }),
    input: [t],
    matched: true,
    value: t,
  },
  {
    id: "RANGE10",
    pattern: () => ({
      kind: PatternKind.Range,
      left: new Test(0),
      right: new Test(1),
    }),
    input: [t],
    matched: true,
    value: t,
  },
  {
    id: "RANGE11",
    pattern: () => ({
      kind: PatternKind.Range,
      left: new Test(0),
      right: new Test(0),
    }),
    input: [t],
    matched: false,
    done: false,
  },
  {
    id: "RANGE12",
    pattern: () => ({
      kind: PatternKind.Range,
      left: {} as Comparable,
      right: new Test(0),
    }),
    input: [t],
    matched: false,
    done: false,
    errors: [
      {
        name: "InvalidType",
        message:
          "Range cannot compare left object without a compareTo function",
        start: "0",
        end: "0",
      },
    ],
  },
  {
    id: "RANGE13",
    pattern: () => ({
      kind: PatternKind.Range,
      left: new Test(0),
      right: {} as Comparable,
    }),
    input: [t],
    matched: false,
    done: false,
    errors: [
      {
        name: "InvalidType",
        message:
          "Range cannot compare right object without a compareTo function",
        start: "0",
        end: "0",
      },
    ],
  },
  {
    id: "RANGE14",
    pattern: () => ({
      kind: PatternKind.Range,
      left: 0,
      right: 0,
    }),
    input: [undefined],
    matched: false,
    done: false,
    errors: [
      {
        name: "InvalidType",
        message: "Range cannot compare null or undefined value",
        start: "0",
        end: "0",
      },
    ],
  },
  {
    id: "RANGE15",
    pattern: () => ({
      kind: PatternKind.Range,
      left: 0,
      right: 0,
    }),
    input: [null],
    matched: false,
    done: false,
    errors: [
      {
        name: "InvalidType",
        message: "Range cannot compare null or undefined value",
        start: "0",
        end: "0",
      },
    ],
  },
  {
    id: "RANGE16",
    pattern: () => ({
      kind: PatternKind.Range,
      left: 0,
      right: "a",
    }),
    input: [0],
    matched: false,
    done: false,
    errors: [
      {
        name: "InvalidType",
        message: "Range cannot compare type number to right type string",
        start: "0",
        end: "0",
      },
    ],
  },
  {
    id: "RANGE17",
    pattern: () => ({
      kind: PatternKind.Range,
      left: "a",
      right: 0,
    }),
    input: [0],
    matched: false,
    done: false,
    errors: [
      {
        name: "InvalidType",
        message: "Range cannot compare type number to left type string",
        start: "0",
        end: "0",
      },
    ],
  },
  {
    id: "RANGE17",
    pattern: () => ({
      kind: PatternKind.Range,
      left: true as unknown as Comparable,
      right: false as unknown as Comparable,
    }),
    input: [true],
    matched: false,
    done: false,
    errors: [
      {
        name: "InvalidType",
        message: "Range cannot compare value of type boolean",
        start: "0",
        end: "0",
      },
    ],
  },
]);
