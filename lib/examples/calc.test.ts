import { assert, equal } from "../../deps/std.ts";
import { Calc, calc } from "./calc.ts";
import { tests } from "../test.ts";

Deno.test({
  name: "CALC00",
  fn: () => {
    const { matched, end, value, errors } = calc`7 + 11`;
    const actual = { matched, done: end.stream.done, value, errors };
    const expected = {
      matched: true,
      done: true,
      value: 18,
      errors: [],
    };
    assert(
      equal(expected, actual),
      `Expected:\n${
        Deno.inspect(expected, { colors: true, depth: 5 })
      }\nActual:\n${Deno.inspect(actual, { colors: true, depth: 5 })}`,
    );
  },
});

tests(import.meta.url, () => [
  {
    id: "CALC01",
    pattern: () => Calc,
    input: "7 + 11",
    value: 18,
  },
  {
    id: "CALC02",
    pattern: () => Calc,
    input: "7 + 11 + 100",
    value: 118,
  },
  {
    id: "CALC03",
    pattern: () => Calc,
    input: "11 - 7",
    value: 4,
  },
  {
    id: "CALC04",
    pattern: () => Calc,
    input: "3 - 2 - 1",
    value: 0,
  },
  {
    id: "CALC05",
    pattern: () => Calc,
    input: "1 + 2 - 3 + 4",
    value: 4,
  },
]);
