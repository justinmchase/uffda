import { assertEquals } from "@std/assert";
import { one } from "./one.ts";

Deno.test("std.one returns the sole element unchanged", () => {
  assertEquals(one([{ kind: "any" }], "and"), { kind: "any" });
});

Deno.test("std.one wraps multiple elements under kind/key", () => {
  assertEquals(
    one([{ kind: "any" }, { kind: "fail" }], "and"),
    { kind: "and", patterns: [{ kind: "any" }, { kind: "fail" }] },
  );
  assertEquals(
    one([{ kind: "any" }, { kind: "end" }], "pipeline", "steps"),
    { kind: "pipeline", steps: [{ kind: "any" }, { kind: "end" }] },
  );
});
