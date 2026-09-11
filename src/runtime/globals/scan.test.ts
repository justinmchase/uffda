import { assertEquals } from "@std/assert";
import { assertRejects } from "@std/assert/rejects";
import { scan } from "./scan.ts";

async function collect<T>(it: AsyncGenerator<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of it) {
    result.push(item);
  }
  return result;
}

Deno.test("globals.scan yields the running accumulator, not the final value", async () => {
  const result = await collect(
    scan(
      [1, 2, 3, 4],
      0,
      (acc, item) => (acc as number) + (item as number),
    ),
  );
  assertEquals(result, [1, 3, 6, 10]);
});

Deno.test("globals.scan is lazy", async () => {
  const calls: number[] = [];
  const it = scan(
    [1, 2, 3],
    0,
    (acc, item) => {
      calls.push(item as number);
      return (acc as number) + (item as number);
    },
  );
  // Nothing has run yet — scan must not eagerly drain.
  assertEquals(calls, []);
  const first = await it.next();
  assertEquals(first.value, 1);
  assertEquals(calls, [1]);
});

Deno.test("globals.scan awaits async callbacks", async () => {
  const result = await collect(
    scan(
      [1, 2, 3],
      0,
      (acc, item) => Promise.resolve((acc as number) + (item as number)),
    ),
  );
  assertEquals(result, [1, 3, 6]);
});

Deno.test("globals.scan works over strings", async () => {
  const result = await collect(
    scan(
      "abc",
      "",
      (acc, item) => `${acc}${item}`,
    ),
  );
  assertEquals(result, ["a", "ab", "abc"]);
});

Deno.test("globals.scan yields nothing for empty input", async () => {
  assertEquals(await collect(scan([], 42, (acc) => acc)), []);
});

Deno.test("globals.scan keeps an astral character as one item, not two", async () => {
  // U+1F600 GRINNING FACE is a surrogate pair (2 UTF-16 code units) but one
  // Unicode code point; scan must not split it.
  const emoji = "\u{1F600}";
  const result = await collect(
    scan(
      `a${emoji}b`,
      [] as string[],
      (acc, item) => [...(acc as string[]), item as string],
    ),
  );
  assertEquals(result, [["a"], ["a", emoji], ["a", emoji, "b"]]);
});

Deno.test("globals.scan does not rebuild output on each step (O(n) not O(n^2))", async () => {
  // A running accumulator that is itself small (a number), threaded across
  // many items, must remain fast even for large n — this is the whole
  // point of scan over hand-rolled reduce+spread.
  const n = 200_000;
  const items = Array.from({ length: n }, (_, i) => i);
  const t0 = performance.now();
  let last = 0;
  for await (
    const acc of scan(
      items,
      0,
      (acc, item) => (acc as number) + (item as number),
    )
  ) {
    last = acc as number;
  }
  const elapsedMs = performance.now() - t0;
  assertEquals(last, (n * (n - 1)) / 2);
  // Generous ceiling: a healthy O(n) implementation finishes in well under
  // a second even for 200k items; an accidental O(n^2) implementation
  // would take many seconds to minutes.
  if (elapsedMs > 5000) {
    throw new Error(
      `scan over ${n} items took ${elapsedMs}ms, expected well under 5000ms`,
    );
  }
});

Deno.test("globals.scan drains a lazy map/filter/enumerate chain", async () => {
  const { enumerate } = await import("./enumerate.ts");
  const { filter } = await import("./filter.ts");
  const { map } = await import("./map.ts");
  const result = await collect(
    scan(
      map(
        filter(
          enumerate([1, 2, 3, 4]),
          (e) => (e as { index: number }).index % 2 === 0,
        ),
        (e) => (e as { value: number }).value,
      ),
      0,
      (acc, item) => (acc as number) + (item as number),
    ),
  );
  assertEquals(result, [1, 4]); // items at index 0, 2 -> values 1, 3
});

Deno.test("globals.scan rejects unsupported values", async () => {
  await assertRejects(
    async () => {
      for await (const _ of scan(42 as unknown as string, 0, (a) => a)) {
        // no-op
      }
    },
    TypeError,
  );
  await assertRejects(
    async () => {
      for await (const _ of scan(null as unknown as string, 0, (a) => a)) {
        // no-op
      }
    },
    TypeError,
  );
});
