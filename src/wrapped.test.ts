import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import {
  charOrigin,
  charRuns,
  concat,
  isWrapped,
  rawOf,
  rootOrigin,
  unwrap,
  wrap,
  Wrapped,
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
});
