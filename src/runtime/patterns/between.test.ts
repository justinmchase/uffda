import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { MatchErrorCode } from "../../match.ts";
import { Path } from "../../mod.ts";
import type { ToJson } from "@justinmchase/serializable";
import type { Comparable } from "../../comparable.ts";

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

Deno.test("runtime.patterns.between", async (t) => {
  await t.step({
    name: "BETWEEN00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: 0,
        right: 2,
      },
      input: Input.Iterable([1]),
      value: 1,
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "BETWEEN01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: 0,
        right: 0,
      },
      input: Input.Iterable([0]),
      value: 0,
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "BETWEEN02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: 0,
        right: 1,
      },
      input: Input.Iterable([1]),
      value: 1,
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "BETWEEN03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: "a",
        right: "a",
      },
      input: Input.Iterable("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "BETWEEN04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: "a",
        right: "b",
      },
      input: Input.Iterable("b"),
      value: "b",
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "BETWEEN05",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: "a",
        right: "c",
      },
      input: Input.Iterable("b"),
      value: "b",
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "BETWEEN06",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: "a",
        right: "b",
      },
      input: Input.Iterable("v"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });
  await t.step({
    name: "BETWEEN07",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: 0,
        right: 1,
      },
      input: Input.Iterable([2]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "BETWEEN08",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: new Test(1),
        right: new Test(1),
      },
      input: Input.Iterable([test]),
      value: test,
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "BETWEEN09",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: new Test(1),
        right: new Test(2),
      },
      input: Input.Iterable([test]),
      kind: MatchKind.Ok,
      value: test,
    }),
  });
  await t.step({
    name: "BETWEEN10",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: new Test(0),
        right: new Test(1),
      },
      input: Input.Iterable([test]),
      kind: MatchKind.Ok,
      value: test,
    }),
  });
  await t.step({
    name: "BETWEEN11",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: new Test(0),
        right: new Test(0),
      },
      input: Input.Iterable([test]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });
  await t.step({
    name: "BETWEEN12",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: {} as Comparable,
        right: new Test(0),
      },
      input: Input.Iterable([test]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });
  await t.step({
    name: "BETWEEN13",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: new Test(0),
        right: {} as Comparable,
      },
      input: Input.Iterable([test]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });
  await t.step({
    name: "BETWEEN14",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: 0,
        right: 0,
      },
      input: Input.Iterable([undefined]),
      kind: MatchKind.Error,
      code: MatchErrorCode.NullValue,
      message: "expected value to be non-null",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });
  await t.step({
    name: "BETWEEN15",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: 0,
        right: 0,
      },
      input: Input.Iterable([null]),
      kind: MatchKind.Error,
      code: MatchErrorCode.NullValue,
      message: "expected value to be non-null",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });
  await t.step({
    name: "BETWEEN16",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: 0,
        right: "a",
      },
      input: Input.Iterable([0]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });
  await t.step({
    name: "BETWEEN17",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: "a",
        right: 0,
      },
      input: Input.Iterable([0]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });
  await t.step({
    name: "BETWEEN18",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Between,
        left: true as unknown as Comparable,
        right: false as unknown as Comparable,
      },
      input: Input.Iterable([true]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });
});
