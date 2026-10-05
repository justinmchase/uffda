import { assertEquals } from "@std/assert";
import {
  aliasOf,
  EMPTY_IMPORT_MAP,
  isUnderAlias,
  unfurlSpecifier,
} from "./import_map.ts";

const IMPORTS = new Map([
  ["@acme/kv", "jsr:@acme/kv@^1.2.0"],
  ["@tok", "jsr:@acme/tokens@^2/lang"],
]);

Deno.test("runtime.resolvers.import_map isUnderAlias compares by segment", () => {
  assertEquals(isUnderAlias("@acme/kv", "@acme/kv"), true);
  assertEquals(isUnderAlias("@acme/kv/tokens", "@acme/kv"), true);
  assertEquals(isUnderAlias("@acme/kvx", "@acme/kv"), false);
  assertEquals(isUnderAlias("@acme", "@acme/kv"), false);
});

Deno.test("runtime.resolvers.import_map aliasOf finds the declared module name", () => {
  assertEquals(aliasOf(IMPORTS, "@acme/kv"), "@acme/kv");
  assertEquals(aliasOf(IMPORTS, "@acme/kv/lang"), "@acme/kv");
  assertEquals(aliasOf(IMPORTS, "@acme/kvx"), undefined);
});

Deno.test("runtime.resolvers.import_map unfurlSpecifier", async (t) => {
  await t.step("writes an alias out as its jsr: specifier", () => {
    assertEquals(unfurlSpecifier(IMPORTS, "@acme/kv"), {
      ok: true,
      specifier: "jsr:@acme/kv@^1.2.0",
    });
  });

  await t.step("keeps the export name after the alias", () => {
    assertEquals(unfurlSpecifier(IMPORTS, "@acme/kv/tokens"), {
      ok: true,
      specifier: "jsr:@acme/kv@^1.2.0/tokens",
    });
    assertEquals(unfurlSpecifier(IMPORTS, "@tok/words"), {
      ok: true,
      specifier: "jsr:@acme/tokens@^2/lang/words",
    });
  });

  await t.step("keeps relative and jsr: specifiers as written", () => {
    for (const specifier of ["./a.uff", "../b/c.uff", "jsr:@x/y@^1/z"]) {
      assertEquals(unfurlSpecifier(IMPORTS, specifier), {
        ok: true,
        specifier,
      });
    }
  });

  await t.step("reports a module name no alias covers", () => {
    assertEquals(unfurlSpecifier(IMPORTS, "@acme/kvx"), {
      ok: false,
      message:
        '"@acme/kvx" is not a module name the project file\'s `imports` declares',
    });
    assertEquals(unfurlSpecifier(EMPTY_IMPORT_MAP, "@acme/kv").ok, false);
  });
});
