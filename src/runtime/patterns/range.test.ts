import { ToJson } from "serializable/mod.ts";
import { Comparable } from "../../comparable.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { Input } from "../../input.ts";

class Test implements ToJson {
  constructor(public readonly value: number) {}
  public compareTo(obj: Test) {
    return this.value == obj.value ? 0 : this.value > obj.value ? -1 : 1;
  }
  public toJSON() {
    return { value: this.value };
  }
  public toString() {
    return `Test(${this.value})`;
  }
}

const test = new Test(1);

Deno.test("runtime.patterns.range", async (t) => {
  await t.step({
    name: "RANGE00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: 0,
        right: 2,
      },
      input: Input.From([1]),
      matched: true,
      value: 1,
    }),
  });
  await t.step({
    name: "RANGE01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: 0,
        right: 0,
      },
      input: Input.From([0]),
      matched: true,
      value: 0,
    }),
  });
  await t.step({
    name: "RANGE02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: 0,
        right: 1,
      },
      input: Input.From([1]),
      matched: true,
      value: 1,
    }),
  });
  await t.step({
    name: "RANGE03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: "a",
        right: "a",
      },
      input: Input.From("a"),
      matched: true,
      value: "a",
    }),
  });
  await t.step({
    name: "RANGE04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: "a",
        right: "b",
      },
      input: Input.From("b"),
      matched: true,
      value: "b",
    }),
  });
  await t.step({
    name: "RANGE05",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: "a",
        right: "c",
      },
      input: Input.From("b"),
      matched: true,
      value: "b",
    }),
  });
  await t.step({
    name: "RANGE06",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: "a",
        right: "b",
      },
      input: Input.From("v"),
      matched: false,
      done: false,
    }),
  });
  await t.step({
    name: "RANGE07",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: 0,
        right: 1,
      },
      input: Input.From([2]),
      matched: false,
      done: false,
    }),
  });

  await t.step({
    name: "RANGE08",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: new Test(1),
        right: new Test(1),
      },
      input: Input.From([test]),
      matched: true,
      value: test,
    }),
  });
  await t.step({
    name: "RANGE09",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: new Test(1),
        right: new Test(2),
      },
      input: Input.From([test]),
      matched: true,
      value: test,
    }),
  });
  await t.step({
    name: "RANGE10",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: new Test(0),
        right: new Test(1),
      },
      input: Input.From([test]),
      matched: true,
      value: test,
    }),
  });
  await t.step({
    name: "RANGE11",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: new Test(0),
        right: new Test(0),
      },
      input: Input.From([test]),
      matched: false,
      done: false,
    }),
  });
  await t.step({
    name: "RANGE12",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: {} as Comparable,
        right: new Test(0),
      },
      input: Input.From([test]),
      matched: false,
      done: false,
    }),
  });
  await t.step({
    name: "RANGE13",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: new Test(0),
        right: {} as Comparable,
      },
      input: Input.From([test]),
      matched: false,
      done: false,
    }),
  });
  await t.step({
    name: "RANGE14",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: 0,
        right: 0,
      },
      input: Input.From([undefined]),
      matched: false,
      done: false,
    }),
  });
  await t.step({
    name: "RANGE15",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: 0,
        right: 0,
      },
      input: Input.From([null]),
      matched: false,
      done: false,
    }),
  });
  await t.step({
    name: "RANGE16",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: 0,
        right: "a",
      },
      input: Input.From([0]),
      matched: false,
      done: false,
    }),
  });
  await t.step({
    name: "RANGE17",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: "a",
        right: 0,
      },
      input: Input.From([0]),
      matched: false,
      done: false,
    }),
  });
  await t.step({
    name: "RANGE18",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Range,
        left: true as unknown as Comparable,
        right: false as unknown as Comparable,
      },
      input: Input.From([true]),
      matched: false,
      done: false,
    }),
  });
});
