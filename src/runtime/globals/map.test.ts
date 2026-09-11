import { assertEquals } from "@std/assert";
import { collect } from "../collect.ts";
import { enumerate } from "./enumerate.ts";
import { filter } from "./filter.ts";
import { map } from "./map.ts";

Deno.test("globals.map projects each element through an async callback", async () => {
  const result = await collect(map(
    [1, 2, 3],
    (v) => Promise.resolve((v as number) * 2),
  ));
  assertEquals(result, [2, 4, 6]);
});

Deno.test("globals.map works over strings", async () => {
  const result = await collect(map("ab", (v) => `${v}!`));
  assertEquals(result, ["a!", "b!"]);
});

Deno.test("globals.map returns an empty array for empty input", async () => {
  assertEquals(await collect(map([], (v) => v)), []);
});

Deno.test("globals.map is lazy: nothing runs until drained", async () => {
  let calls = 0;
  const gen = map([1, 2, 3], (v) => {
    calls += 1;
    return v;
  });
  assertEquals(calls, 0);
  await collect(gen);
  assertEquals(calls, 3);
});

Deno.test("globals.map composes with a lazy enumerate/filter chain", async () => {
  const result = await collect(
    map(
      filter(
        enumerate(["a", "b", "c"]),
        (e) => (e as { index: number }).index % 2 === 0,
      ),
      (e) => (e as { value: string }).value,
    ),
  );
  assertEquals(result, ["a", "c"]);
});
