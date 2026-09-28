import { assertEquals, assertStrictEquals } from "@std/assert";
import { symbol } from "./symbol.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("globals.symbol resolves well-known symbols to the built-in singleton", () => {
  assertStrictEquals(symbol("iterator"), Symbol.iterator);
  assertStrictEquals(symbol("asyncIterator"), Symbol.asyncIterator);
});

Deno.test("globals.symbol returns the same well-known symbol on every call", () => {
  assertStrictEquals(symbol("iterator"), symbol("iterator"));
});

Deno.test("globals.symbol interns custom names via the global symbol registry", () => {
  const a = symbol("example");
  const b = symbol("example");
  assertEquals(typeof a, "symbol");
  assertStrictEquals(a, b);
  assertStrictEquals(a, Symbol.for("example"));
});

Deno.test("globals.symbol does not conflate custom names with well-known ones", () => {
  const custom = symbol("iterator-but-not-really");
  assertEquals(typeof custom, "symbol");
  assertStrictEquals(custom, Symbol.for("iterator-but-not-really"));
});

Deno.test("globals.symbol carries metadata", () => {
  assertEquals(
    metadataOf(symbol)?.parameters.map((p) => p.name),
    ["name"],
  );
});

Deno.test("globals.symbol observes the raw name", () => {
  assertEquals(
    symbol(new Wrapped("asyncIterator", rootOrigin(0))),
    Symbol.asyncIterator,
  );
});
