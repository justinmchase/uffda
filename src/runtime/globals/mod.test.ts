import { assert } from "@std/assert";
import { metadataOf } from "../value_metadata.ts";
import { defaultGlobals } from "./mod.ts";

Deno.test("every default global carries function metadata", () => {
  for (const [name, fn] of defaultGlobals) {
    const metadata = metadataOf(fn);
    assert(metadata, `${name} has no metadata`);
    assert(metadata.description.length > 0, `${name} has no description`);
  }
});
