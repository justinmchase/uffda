import { assertEquals } from "@std/assert";
import {
  fileUrl,
  parseFileUrl,
  parseJsrSpecifier,
  specifierKey,
} from "./jsr_specifier.ts";

const REGISTRY = new URL("https://jsr.io/");

Deno.test("jsr_specifier.parseJsrSpecifier", async (t) => {
  await t.step("takes apart package, range and export", () => {
    assertEquals(parseJsrSpecifier("jsr:@acme/kv@^1.2.0/lang/tokens"), {
      scope: "acme",
      name: "kv",
      range: "^1.2.0",
      exportName: "./lang/tokens",
    });
  });

  await t.step("defaults to no range and the default export", () => {
    assertEquals(parseJsrSpecifier("jsr:@acme/kv"), {
      scope: "acme",
      name: "kv",
      range: undefined,
      exportName: ".",
    });
  });

  await t.step("rejects what is not a jsr: specifier", () => {
    for (
      const text of [
        "@acme/kv",
        "jsr:acme/kv",
        "jsr:@acme",
        "jsr:@acme/kv@",
        "jsr:@acme/kv/../x",
        "jsr:@acme/kv//x",
      ]
    ) {
      assertEquals(parseJsrSpecifier(text), undefined, text);
    }
  });
});

Deno.test("jsr_specifier.specifierKey names the package and range", () => {
  assertEquals(
    specifierKey(parseJsrSpecifier("jsr:@acme/kv@^1.2.0/tokens")!),
    "jsr:@acme/kv@^1.2.0",
  );
  assertEquals(
    specifierKey(parseJsrSpecifier("jsr:@acme/kv")!),
    "jsr:@acme/kv",
  );
});

Deno.test("jsr_specifier file URLs round-trip", async (t) => {
  const file = {
    scope: "acme",
    name: "kv",
    version: "1.2.3",
    path: "src/tokens.uff",
  };

  await t.step("fileUrl", () => {
    assertEquals(
      fileUrl(REGISTRY, file).href,
      "https://jsr.io/@acme/kv/1.2.3/src/tokens.uff",
    );
  });

  await t.step("parseFileUrl", () => {
    assertEquals(parseFileUrl(REGISTRY, fileUrl(REGISTRY, file)), file);
  });

  await t.step("parseFileUrl rejects URLs outside a package version", () => {
    for (
      const href of [
        "https://example.com/@acme/kv/1.2.3/a.uff",
        "https://jsr.io/@acme/kv/1.2.3",
        "https://jsr.io/acme/kv/1.2.3/a.uff",
      ]
    ) {
      assertEquals(parseFileUrl(REGISTRY, new URL(href)), undefined, href);
    }
  });
});
