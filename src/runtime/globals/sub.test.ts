import { assertEquals, assertThrows } from "@std/assert";
import { sub } from "./sub.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("runtime.sub subtracts right from left", () => {
  assertEquals(sub(5, 2), 3);
  assertEquals(sub(2, 5), -3);
});

Deno.test("runtime.sub rejects non-numeric operands", () => {
  assertThrows(() => sub("5", 2));
  assertThrows(() => sub(5, "2"));
});

Deno.test("globals.sub carries metadata", () => {
  assertEquals(
    metadataOf(sub)?.parameters.map((p) => p.name),
    ["left", "right"],
  );
});

Deno.test("globals.sub observes raw operands", () => {
  assertEquals(
    sub(new Wrapped(11, rootOrigin(0)), new Wrapped(7, rootOrigin(1))),
    4,
  );
});
