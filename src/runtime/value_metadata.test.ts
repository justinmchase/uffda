import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import {
  defineMetadata,
  formatSignature,
  METADATA,
  metadataOf,
} from "./value_metadata.ts";

Deno.test("value_metadata", async (t) => {
  await t.step("METADATA is the registered uffda.metadata symbol", () => {
    assertStrictEquals(METADATA, Symbol.for("uffda.metadata"));
  });

  await t.step("defineMetadata attaches inert, read-only metadata", () => {
    const fn = (a: number) => a + 1;
    const returned = defineMetadata(fn, {
      description: "Adds one.",
      parameters: [{ name: "a" }],
    });
    assertStrictEquals(returned, fn);
    assertEquals(fn(1), 2);
    assertEquals(Object.keys(fn), []);
    assertEquals(metadataOf(fn), {
      description: "Adds one.",
      parameters: [{ name: "a" }],
    });
    assertThrows(() => defineMetadata(fn, { description: "", parameters: [] }));
  });

  await t.step("metadataOf ignores missing or malformed metadata", () => {
    assertEquals(metadataOf(() => 1), undefined);
    assertEquals(metadataOf({ [METADATA]: { description: "x" } }), undefined);
    const noParameters = Object.assign(() => 1, {
      [METADATA]: { description: "x" },
    });
    assertEquals(metadataOf(noParameters), undefined);
    const badParameter = Object.assign(() => 1, {
      [METADATA]: { description: "x", parameters: [{ name: 1 }] },
    });
    assertEquals(metadataOf(badParameter), undefined);
  });

  await t.step("metadataOf reads host-attached metadata by symbol", () => {
    const fn = Object.assign(() => 1, {
      [Symbol.for("uffda.metadata")]: {
        description: "Host value.",
        parameters: [{ name: "xs", rest: true }, { name: "n", optional: true }],
      },
    });
    assertEquals(metadataOf(fn), {
      description: "Host value.",
      parameters: [{ name: "xs", rest: true }, { name: "n", optional: true }],
    });
  });

  await t.step("formatSignature writes an invocation shape", () => {
    assertEquals(
      formatSignature("f", {
        description: "",
        parameters: [
          { name: "a" },
          { name: "b", optional: true },
          { name: "c", rest: true },
        ],
      }),
      "(f a b? ...c)",
    );
    assertEquals(
      formatSignature("g", { description: "", parameters: [] }),
      "(g)",
    );
  });
});
