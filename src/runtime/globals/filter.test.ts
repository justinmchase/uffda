import { assertEquals, assertStrictEquals } from "@std/assert";
import { collect } from "../collect.ts";
import { filter } from "./filter.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("globals.filter keeps elements whose async predicate is truthy", async () => {
  const result = await collect(filter(
    [1, 2, 3, 4],
    (v) => Promise.resolve((v as number) % 2 === 0),
  ));
  assertEquals(result, [2, 4]);
});

Deno.test("globals.filter works over strings", async () => {
  const result = await collect(filter("a\nb\n", (v) => v === "\n"));
  assertEquals(result, ["\n", "\n"]);
});

Deno.test("globals.filter returns an empty array when nothing matches", async () => {
  assertEquals(await collect(filter([1, 2], () => false)), []);
});

Deno.test("globals.filter is lazy: nothing runs until drained", async () => {
  let calls = 0;
  const gen = filter([1, 2, 3], (v) => {
    calls += 1;
    return v;
  });
  assertEquals(calls, 0);
  await collect(gen);
  assertEquals(calls, 3);
});

Deno.test("globals.filter carries metadata", () => {
  assertEquals(
    metadataOf(filter)?.parameters.map((p) => p.name),
    ["self", "predicate"],
  );
});

Deno.test("globals.filter tests the raw predicate result and carries elements", async () => {
  const keep = new Wrapped(1, rootOrigin(0));
  const predicate = (value: unknown) =>
    new Wrapped(value === keep, rootOrigin(0));
  const items = new Wrapped(
    [keep, new Wrapped(2, rootOrigin(1))],
    rootOrigin(0, 2),
  );
  const kept = await Array.fromAsync(
    filter(items, new Wrapped(predicate, rootOrigin(0))),
  );
  assertEquals(kept.length, 1);
  assertStrictEquals(kept[0], keep);
});
