import { assertEquals } from "@std/assert";
import { metadataOf } from "../value_metadata.ts";
import { format } from "./format.ts";
import { charOrigins, rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("globals.format substitutes positional placeholders", () => {
  assertEquals(format("{0}-{1}-{2}", "a", 1), "a-1-{2}");
});

Deno.test("globals.format carries metadata", () => {
  assertEquals(
    metadataOf(format)?.parameters.map((p) => p.name),
    ["value", "args"],
  );
});

Deno.test("globals.format observes raw template and arguments", () => {
  const result = format(
    new Wrapped("{0}-{1}-{2}", rootOrigin(0)),
    new Wrapped(1, rootOrigin(1)),
    "b",
  ) as Wrapped<string>;
  assertEquals(result.raw, "1-b-{2}");
});

Deno.test("globals.format keeps each character's provenance", () => {
  const origin = rootOrigin(10, 17);
  const template = new Wrapped("<{0}>{1}", origin, [
    { length: 8, origin, linear: false },
  ]);
  const name = new Wrapped("ab", rootOrigin(3, 5), [
    { length: 2, origin: rootOrigin(3, 5), linear: true },
  ]);
  const result = format(template, name, 7) as Wrapped<string>;
  assertEquals(result.raw, "<ab>7");
  assertEquals(result.origin, origin);
  assertEquals(charOrigins(result), [
    origin,
    rootOrigin(3),
    rootOrigin(4),
    origin,
    origin,
  ]);
});
