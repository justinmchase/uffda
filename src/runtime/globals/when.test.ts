import { assertEquals, assertStrictEquals } from "@std/assert";
import { when } from "./when.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("std.when selects then or else by truthiness", () => {
  assertEquals(when(true, "a", "b"), "a");
  assertEquals(when(false, "a", "b"), "b");
  assertEquals(when(0, "a", "b"), "b");
  assertEquals(when("x", 1, 2), 1);
});

Deno.test("globals.when carries metadata", () => {
  assertEquals(
    metadataOf(when)?.parameters.map((p) => p.name),
    ["condition", "thenValue", "elseValue"],
  );
});

Deno.test("globals.when observes the condition and carries the branch", () => {
  const yes = new Wrapped("yes", rootOrigin(1));
  assertStrictEquals(
    when(
      new Wrapped(false, rootOrigin(0)),
      new Wrapped("no", rootOrigin(2)),
      yes,
    ),
    yes,
  );
});
