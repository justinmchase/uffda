import { assertEquals } from "@std/assert";
import { metadataOf } from "../value_metadata.ts";
import { format } from "./format.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

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
  assertEquals(
    format(
      new Wrapped("{0}-{1}", rootOrigin(0)),
      new Wrapped(1, rootOrigin(1)),
      "b",
    ),
    "1-b",
  );
});
