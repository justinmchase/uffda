import { assertEquals, assertStrictEquals } from "@std/assert";
import { metadataOf } from "../value_metadata.ts";
import { coalesce } from "./coalesce.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

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

Deno.test("globals.coalesce tests raw values and carries the chosen one", () => {
  const chosen = new Wrapped(0, rootOrigin(1));
  assertStrictEquals(
    coalesce(new Wrapped(undefined, rootOrigin(0)), chosen),
    chosen,
  );
});
