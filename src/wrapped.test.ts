import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import {
  carryItem,
  charOrigin,
  charRuns,
  concat,
  isWrapped,
  originOf,
  rawOf,
  rootOrigin,
  shallow,
  sliceString,
  unwrap,
  wrap,
  wrapFrom,
  wrapItem,
  Wrapped,
  wrapRoot,
} from "./wrapped.ts";

const at = (start: number, end = start + 1) => rootOrigin(start, end);

Deno.test("wrapped", async (t) => {
  await t.step("wrap carries an existing wrapper unchanged", () => {
    const inner = new Wrapped("a", at(0));
    assertStrictEquals(wrap(inner, at(5)), inner);
  });

  await t.step("wrap wraps a raw value at the given origin", () => {
    const origin = at(3);
    const w = wrap(42, origin);
    assertEquals(isWrapped(w), true);
    assertEquals(w.raw, 42);
    assertStrictEquals(w.origin, origin);
  });

  await t.step("rawOf removes one level only", () => {
    const inner = new Wrapped("x", at(0));
    const outer = new Wrapped([inner], at(0));
    assertStrictEquals(rawOf(outer), outer.raw);
    assertStrictEquals(rawOf("plain"), "plain");
  });

  await t.step("unwrap removes wrappers at every level", () => {
    const o = at(0);
    const value = new Wrapped({
      kind: new Wrapped("word", o),
      items: new Wrapped([new Wrapped(1, o), 2], o),
    }, o);
    assertEquals(unwrap(value), { kind: "word", items: [1, 2] });
  });

  await t.step("unwrap preserves shared and cyclic structure", () => {
    const shared = { n: new Wrapped(1, at(0)) };
    const cyclic: Record<string, unknown> = { shared, again: shared };
    cyclic.self = cyclic;
    const out = unwrap(cyclic) as Record<string, unknown>;
    assertStrictEquals(out.shared, out.again);
    assertStrictEquals(out.self, out);
  });

  await t.step("unwrap keeps symbol-keyed properties", () => {
    const key = Symbol("k");
    const out = unwrap({ [key]: new Wrapped("v", at(0)) }) as Record<
      symbol,
      unknown
    >;
    assertEquals(out[key], "v");
  });

  await t.step("unwrap leaves class instances untouched", () => {
    const date = new Date(0);
    assertStrictEquals(unwrap(new Wrapped(date, at(0))), date);
    const map = new Map();
    assertStrictEquals(unwrap(map), map);
  });

  await t.step("a single-character string at a unit span is linear", () => {
    assertEquals(charRuns(new Wrapped("a", at(4))), [
      { length: 1, origin: at(4), linear: true },
    ]);
  });

  await t.step("characters without runs share the whole origin", () => {
    const origin = at(10, 12);
    const w = new Wrapped("\n", origin);
    assertStrictEquals(charOrigin(w, 0), origin);
  });

  await t.step("concat merges contiguous single characters", () => {
    const w = concat([
      new Wrapped("r", at(10)),
      new Wrapped("u", at(11)),
      new Wrapped("l", at(12)),
    ], at(10, 13));
    assertEquals(w.raw, "rul");
    assertEquals(w.chars, [{ length: 3, origin: at(10, 13), linear: true }]);
    assertEquals(charOrigin(w, 1), at(11));
  });

  await t.step("concat keeps a replacement character's wider span", () => {
    const crlf = at(1, 3);
    const w = concat([
      new Wrapped("a", at(0)),
      new Wrapped("\n", crlf),
      new Wrapped("b", at(3)),
    ], at(0, 4));
    assertEquals(w.raw, "a\nb");
    assertEquals(charOrigin(w, 0), at(0));
    assertStrictEquals(charOrigin(w, 1), crlf);
    assertEquals(charOrigin(w, 2), at(3));
  });

  await t.step("concat preserves nested runs", () => {
    const word = concat(
      [new Wrapped("a", at(0)), new Wrapped("b", at(1))],
      at(0, 2),
    );
    const w = concat([word, new Wrapped("!", at(5))], at(0, 6));
    assertEquals(w.raw, "ab!");
    assertEquals(charOrigin(w, 1), at(1));
    assertEquals(charOrigin(w, 2), at(5));
  });

  await t.step(
    "concat gives raw and non-string parts the operation origin",
    () => {
      const origin = at(7, 9);
      const w = concat(["x", 1], origin);
      assertEquals(w.raw, "x1");
      assertEquals(w.chars, [{ length: 2, origin, linear: false }]);
    },
  );

  await t.step("concat of nothing is an empty string with no runs", () => {
    const w = concat([], at(0, 0));
    assertEquals(w.raw, "");
    assertEquals(w.chars, []);
  });

  await t.step("charOrigin rejects an out-of-range index", () => {
    assertThrows(() => charOrigin(new Wrapped("a", at(0)), 1), RangeError);
  });

  await t.step("charOrigin counts code points, not UTF-16 units", () => {
    const origin = at(0, 3);
    const w = new Wrapped("😀ab", origin, [{
      length: 3,
      origin,
      linear: true,
    }]);
    assertEquals(charOrigin(w, 1), at(1));
  });

  await t.step("sliceString keeps each character's origin", () => {
    const w = concat([new Wrapped("a", at(4)), new Wrapped("b", at(9))], at(0));
    const s = sliceString(w, 1);
    assertEquals(s.raw, "b");
    assertEquals(charOrigin(s, 0), at(9));
  });

  await t.step("sliceString indexes in UTF-16 units like String#slice", () => {
    const w = concat(["😀", new Wrapped("z", at(6))], at(0, 2));
    assertEquals(sliceString(w, 2).raw, "z");
    assertEquals(charOrigin(sliceString(w, -1), 0), at(6));
  });

  await t.step("wrapItem carries an item that is already wrapped", () => {
    const item = new Wrapped(1, at(3));
    assertStrictEquals(wrapItem(new Wrapped([item], at(0, 5)), item, 0), item);
  });

  await t.step("wrapItem gives a string character its own origin", () => {
    const source = concat(
      [new Wrapped("a", at(2)), new Wrapped("b", at(8))],
      at(0),
    );
    assertEquals(wrapItem(source, "b", 1).origin, at(8));
  });

  await t.step("wrapItem gives other raw items the container's origin", () => {
    const source = new Wrapped([1, 2], at(0, 2));
    assertStrictEquals(wrapItem(source, 2, 1).origin, source.origin);
  });

  await t.step("carryItem leaves items of a raw container unchanged", () => {
    assertEquals(carryItem([1, 2], 2, 1), 2);
    assertEquals(isWrapped(carryItem(new Wrapped([1, 2], at(0)), 2, 1)), true);
  });

  await t.step("shallow unwraps one level of elements and properties", () => {
    const inner = new Wrapped({ x: new Wrapped(1, at(1)) }, at(1));
    assertEquals(shallow(new Wrapped([inner], at(0))), [{ x: inner.raw.x }]);
    assertEquals(shallow(new Wrapped({ a: inner }, at(0))), { a: inner.raw });
  });

  await t.step("unwrap unwraps items yielded by iteration hooks", async () => {
    const items = [new Wrapped("a", at(0)), new Wrapped("b", at(1))];
    const value = unwrap({
      [Symbol.iterator]: () => items[Symbol.iterator](),
      async *[Symbol.asyncIterator]() {
        yield* items;
      },
    }) as Iterable<unknown> & AsyncIterable<unknown>;
    assertEquals([...value], ["a", "b"]);
    assertEquals(await Array.fromAsync(value), ["a", "b"]);
  });

  await t.step(
    "unwrap unwraps the remaining items of an iterator",
    async () => {
      const generator = (async function* () {
        yield new Wrapped([new Wrapped(1, at(0))], at(0));
      })();
      assertEquals(
        await Array.fromAsync(unwrap(generator) as AsyncIterable<unknown>),
        [[1]],
      );
    },
  );

  await t.step("originOf takes only a match's span", () => {
    const match = { kind: "ok", scope: {}, originalSpan: at(2, 4) };
    const origin = originOf(match);
    assertStrictEquals(origin, match.originalSpan);
    assertEquals("scope" in origin, false);
  });

  await t.step(
    "wrapFrom carries a wrapped value or wraps at the match's span",
    () => {
      const inner = new Wrapped("a", at(0));
      const match = { kind: "ok", originalSpan: at(5) };
      assertStrictEquals(wrapFrom(inner, match), inner);
      assertEquals(wrapFrom(1, match).origin, at(5));
    },
  );

  await t.step("coercion sees the raw value", () => {
    const n = new Wrapped(2, at(0)) as unknown as number;
    assertEquals(n + 1, 3);
    assertEquals(`${new Wrapped("a", at(0))}!`, "a!");
    assertEquals(new Wrapped("a", at(0)) == ("a" as unknown), true);
    assertEquals(`${new Wrapped([1, 2], at(0))}`, "1,2");
    assertEquals(+new Wrapped(new Date(5), at(0)), 5);
    assertEquals(typeof new Wrapped("a", at(0)), "object");
  });

  await t.step("JSON serializes the raw value at every level", () => {
    const value = new Wrapped([new Wrapped(1, at(0)), {
      k: new Wrapped("v", at(1)),
    }], at(0, 2));
    assertEquals(JSON.stringify(value), '[1,{"k":"v"}]');
  });

  await t.step("wrapRoot gives a string's characters their offsets", () => {
    const w = wrapRoot("héy");
    assertEquals(w.origin, at(0, 3));
    assertEquals(charOrigin(w as Wrapped<string>, 2), at(2));
    assertEquals(wrapRoot("").origin, at(0, 0));
  });

  await t.step("wrapRoot puts other values at offset 0", () => {
    assertEquals(wrapRoot([1, 2]).origin, at(0));
    const inner = new Wrapped(1, at(4));
    assertStrictEquals(wrapRoot(inner), inner);
  });

  await t.step("charOrigin finds the run of any character", () => {
    const parts = Array.from(
      { length: 50 },
      (_, i) => new Wrapped("x", at(i * 2)),
    );
    const w = concat(parts, at(0));
    assertEquals(w.chars?.length, 50);
    assertEquals(charOrigin(w, 0), at(0));
    assertEquals(charOrigin(w, 37), at(74));
    assertEquals(charOrigin(w, 49), at(98));
    assertThrows(() => charOrigin(w, 50), RangeError);
  });
});
