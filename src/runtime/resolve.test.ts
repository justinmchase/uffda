import { assertEquals } from "std/assert/mod.ts";
import { Resolver } from "./resolve.ts";

const readPermissions = await Deno.permissions.query({ name: "read" });
if (readPermissions.state === "granted") {
  Deno.test({
    name: "RESOLVE00",
    fn: async () => {
      const resolver = new Resolver();
      const resolved = await resolver.import(
        new URL("./resolvers/test.module.json", import.meta.url),
      );
      assertEquals(
        [...resolved.rules.keys()],
        ["A", "B"],
      );
    },
  });

  Deno.test({
    name: "RESOLVE01",
    fn: async () => {
      const resolver = new Resolver();
      const resolved = await resolver.import(
        new URL("./resolvers/test.module.js", import.meta.url),
      );
      assertEquals(
        [...resolved.rules.keys()],
        ["A", "B"],
      );
    },
  });

  Deno.test({
    name: "RESOLVE02",
    fn: async () => {
      const resolver = new Resolver();
      const resolved = await resolver.import(
        new URL("./resolvers/test0.module.ts", import.meta.url),
      );
      assertEquals(
        [...resolved.rules.keys()],
        ["A", "B"],
      );
    },
  });

  Deno.test({
    name: "RESOLVE03",
    fn: async () => {
      const resolver = new Resolver();
      const resolved = await resolver.import(
        new URL("./resolvers/test1.module.ts", import.meta.url),
      );
      assertEquals(
        [...resolved.rules.keys()],
        [],
      );
      assertEquals(
        [...resolved.imports.get("A")!.module.rules.keys()],
        ["A", "B"],
      );
    },
  });

  Deno.test({
    name: "RESOLVE04",
    fn: async () => {
      const resolver = new Resolver();
      const t1 = await resolver.import(
        new URL("./resolvers/test1.module.ts", import.meta.url),
      );
      const t2 = await resolver.import(
        new URL("./resolvers/test2.module.ts", import.meta.url),
      );
      assertEquals(
        t1.imports.get("A")?.module,
        t2.imports.get("A")?.module,
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
