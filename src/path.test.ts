import { assertEquals, assertStrictEquals } from "std/testing/asserts.ts";
import { Path } from "./path.ts";

const pathComparisons = [
  // number segements of same length
  { l: [0], r: [0], v: 0 },
  { l: [1], r: [0], v: 1 },
  { l: [0], r: [1], v: -1 },
  { l: [0, 0], r: [0, 0], v: 0 },
  { l: [0, 0], r: [0, 1], v: -1 },
  { l: [0, 0], r: [1, 0], v: -1 },
  { l: [0, 0], r: [1, 1], v: -1 },
  { l: [1, 0], r: [0, 0], v: 1 },
  { l: [1, 0], r: [0, 1], v: 1 },
  { l: [1, 0], r: [1, 0], v: 0 },
  { l: [1, 0], r: [1, 1], v: -1 },
  { l: [0, 1], r: [0, 0], v: 1 },
  { l: [0, 1], r: [0, 1], v: 0 },
  { l: [0, 1], r: [1, 0], v: -1 },
  { l: [0, 1], r: [1, 1], v: -1 },
  { l: [1, 1], r: [0, 0], v: 1 },
  { l: [1, 1], r: [0, 1], v: 1 },
  { l: [1, 1], r: [1, 0], v: 1 },
  { l: [1, 1], r: [1, 1], v: 0 },

  // string segments of same length
  { l: ["x"], r: ["y"], v: -1 },
  { l: ["y"], r: ["x"], v: 1 },
  { l: ["x", "x"], r: ["x", "x"], v: 0 },
  { l: ["x", "x"], r: ["y", "x"], v: -1 },
  { l: ["x", "x"], r: ["x", "y"], v: -1 },
  { l: ["x", "x"], r: ["y", "y"], v: -1 },
  { l: ["y", "x"], r: ["x", "x"], v: 1 },
  { l: ["y", "x"], r: ["y", "x"], v: 0 },
  { l: ["y", "x"], r: ["x", "y"], v: 1 },
  { l: ["y", "x"], r: ["y", "y"], v: -1 },
  { l: ["x", "y"], r: ["x", "x"], v: 1 },
  { l: ["x", "y"], r: ["y", "x"], v: -1 },
  { l: ["x", "y"], r: ["x", "y"], v: 0 },
  { l: ["x", "y"], r: ["y", "y"], v: -1 },
  { l: ["y", "y"], r: ["x", "x"], v: 1 },
  { l: ["y", "y"], r: ["y", "x"], v: 1 },
  { l: ["y", "y"], r: ["x", "y"], v: 1 },
  { l: ["y", "y"], r: ["y", "y"], v: 0 },

  // string segments of differing length
  { l: ["x", "x"], r: ["x"], v: 1 },
  { l: ["x", "x"], r: ["y"], v: -1 },
  { l: ["x", "y"], r: ["x"], v: 1 },
  { l: ["x", "y"], r: ["y"], v: -1 },
  { l: ["y", "y"], r: ["x"], v: 1 },
  { l: ["y", "y"], r: ["y"], v: 1 },
  { l: ["x"], r: ["x", "x"], v: -1 },
  { l: ["y"], r: ["x", "x"], v: 1 },
  { l: ["x"], r: ["x", "y"], v: -1 },
  { l: ["y"], r: ["x", "y"], v: 1 },
  { l: ["x"], r: ["y", "y"], v: -1 },
  { l: ["y"], r: ["y", "y"], v: -1 },
];

Deno.test("path comparisons", async (t) => {
  for (const { l, r, v } of pathComparisons) {
    await t.step({
      name: `${l.join(".")} <=> ${r.join(".")} == ${v}`,
      fn: () => {
        const left = new Path(...l);
        const right = new Path(...r);
        assertStrictEquals(left.compareTo(right), v);
      },
    });
  }
});

const pathFormats = [
  { p: [0, 1, 2], v: "[0].[1].[2]" },
  { p: ["x", "y", "z"], v: '"x"."y"."z"' },
  { p: [0, "x", 1, "y", 2, "z"], v: '[0]."x".[1]."y".[2]."z"' },
  { p: [1.23], v: '"1.23"' },
  { p: [Number.NaN], v: '"NaN"' },
  { p: [{} as string], v: '"[object Object]"' },
  { p: [{ toString: () => "abc" } as string], v: '"abc"' },
];
Deno.test("path formats", async (t) => {
  for (const { p, v } of pathFormats) {
    const path = new Path(...p);
    await t.step({
      name: path.toString(),
      fn: () => {
        assertStrictEquals(path.toString(), v);
      },
    });
  }
});

Deno.test({
  name: "path push",
  fn: () => {
    const p0 = Path.Default();
    const p1 = p0.push(1);
    assertEquals(p0.segments, [0]);
    assertEquals(p1.segments, [0, 1]);
  },
});

Deno.test({
  name: "path pop",
  fn: () => {
    const p0 = new Path(0, 1);
    const p1 = p0.pop();
    assertEquals(p0.segments, [0, 1]);
    assertEquals(p1.segments, [0]);
  },
});

Deno.test({
  name: "path set",
  fn: () => {
    const p0 = new Path(0, 1);
    const p1 = p0.set(2);
    assertEquals(p0.segments, [0, 1]);
    assertEquals(p1.segments, [0, 2]);
  },
});
