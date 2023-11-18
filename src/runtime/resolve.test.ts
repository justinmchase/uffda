import { assertEquals } from "std/testing/asserts.ts";
import { dirname, fromFileUrl } from "std/path/mod.ts";
import { Resolver } from "./resolve.ts";

const MODULE_DIR = dirname(fromFileUrl(import.meta.url));
const pathNormalizationTests = [
  ["./test.uff", "/var/test/mod.ts", "file:///var/test/test.uff"],
  ["./test.uff", "file:///var/test.uff", "file:///var/test.uff"],
  ["./test.uff", "http://example.com/mod.ts", "http://example.com/test.uff"],
  ["./test.uff", "http://test.com/x/mod.js", "http://test.com/x/test.uff"],
  ["/var/example/test.uff", "/var/test/mod.ts", "file:///var/example/test.uff"],
  [
    "file:///var/example/test.uff",
    "file:///var/test/mod.uff",
    "file:///var/example/test.uff",
  ],
  [
    "http://example.com/test.uff",
    "http://test.com/mod.js",
    "http://example.com/test.uff",
  ],
];

const readPermissions = await Deno.permissions.query({ name: "read" });
if (readPermissions.state === "granted") {
  pathNormalizationTests.forEach(([moduleUrl, parentPath, expectedPath], i) => {
    Deno.test({
      name: `NORM${i.toString().padStart(2, "0")}`,
      fn: () => {
        const resolved = Resolver.normalizeModulePath(moduleUrl, parentPath);
        assertEquals(resolved, expectedPath);
      },
    });
  });

  Deno.test({
    name: "RESOLVE00",
    fn: async () => {
      const resolver = new Resolver({ moduleUrl: import.meta.url });
      const resolved = await resolver.load("./resolvers/test.module.json");
      assertEquals(
        resolved.moduleUrl,
        `file://${MODULE_DIR}/resolvers/test.module.json`,
      );
    },
  });
  Deno.test({
    name: "RESOLVE01",
    fn: async () => {
      const resolver = new Resolver({ moduleUrl: import.meta.url });
      const resolved = await resolver.load("./resolvers/test.module.js");
      assertEquals(
        resolved.moduleUrl,
        `file://${MODULE_DIR}/resolvers/test.module.js`,
      );
    },
  });
  Deno.test({
    name: "RESOLVE02",
    fn: async () => {
      const resolver = new Resolver({ moduleUrl: import.meta.url });
      const resolved = await resolver.load("./resolvers/test0.module.ts");
      assertEquals(
        resolved.moduleUrl,
        `file://${MODULE_DIR}/resolvers/test0.module.ts`,
      );
    },
  });
  Deno.test({
    name: "RESOLVE03",
    fn: async () => {
      const resolver = new Resolver({ moduleUrl: import.meta.url });
      const resolved = await resolver.load("./resolvers/test0.module.ts");
      assertEquals(
        resolved.moduleUrl,
        `file://${MODULE_DIR}/resolvers/test0.module.ts`,
      );
    },
  });
  Deno.test({
    name: "RESOLVE04",
    fn: async () => {
      const resolver = new Resolver({ moduleUrl: import.meta.url });
      const resolved = await resolver.load("./resolvers/test1.module.ts");
      assertEquals(
        resolved.moduleUrl,
        `file://${MODULE_DIR}/resolvers/test1.module.ts`,
      );
      assertEquals(
        resolved.imports.get("A")?.module.moduleUrl,
        `file://${MODULE_DIR}/resolvers/test0.module.ts`,
      );
    },
  });
} else {
  Deno.test({
    name: "resolve tests require read permissions",
    ignore: true,
    fn: () => {},
  });
}
