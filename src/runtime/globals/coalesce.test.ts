import { assertEquals } from "@std/assert";
import { metadataOf } from "../value_metadata.ts";
import { coalesce } from "./coalesce.ts";

Deno.test("globals.coalesce returns the first non-nullish argument", () => {
  assertEquals(coalesce(undefined, null, 0, 1), 0);
  assertEquals(coalesce(undefined, null), undefined);
});

Deno.test("globals.coalesce carries metadata", () => {
  assertEquals(
    metadataOf(coalesce)?.parameters.map((p) => p.name),
    ["values"],
  );
});
