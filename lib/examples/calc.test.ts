import { assert, equal } from "../../deps/std.ts";

Deno.test({
  name: "CALC00",
  fn: async () => {
    const { calc } = await import("./calc.js");
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

// describe('/examples/calc2', () => {
//   it('add two numbers', () => {
//     const result = calc`7 + 11`
//     strictEqual(result, 18)
//   })
//   it('can add three numbers', () => {
//     const result = calc`7 + 11 + 100`
//     strictEqual(result, 118)
//   })
//   it('can sub two numbers', () => {
//     const result = calc`11 - 7`
//     strictEqual(result, 4)
//   })
//   it('can sub three numbers', () => {
//     const result = calc`3 - 2 - 1`
//     strictEqual(result, 0)
//   })
//   it('sub has correct precedence', () => {
//     const result = calc`1 + 2 - 3 + 4`
//     strictEqual(result, 4)
//   })
// })
