import { assert, assertEquals } from "@std/assert";
import { MatchErrorCode, MatchKind } from "../match.ts";
import { Resolver } from "./resolve.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { ResolveTargetKind } from "./patterns/pattern.ts";
import { ModuleImportResultKind } from "./resolvers/resolver.ts";
import { Scope } from "./scope.ts";

function context() {
  return {
    scope: Scope.Default(),
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
    } as const,
  };
}

const readPermissions = await Deno.permissions.query({ name: "read" });
if (readPermissions.state === "granted") {
  Deno.test({
    name: "RESOLVE00",
    fn: async () => {
      const resolver = new Resolver();
      const resolved = await resolver.import(
        new URL("./resolvers/test.module.json", import.meta.url),
        context(),
      );
      assertEquals(resolved.kind, ModuleImportResultKind.Module);
      if (resolved.kind !== ModuleImportResultKind.Module) return;
      assertEquals(
        [...resolved.module.rules.keys()],
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
        context(),
      );
      assertEquals(resolved.kind, ModuleImportResultKind.Module);
      if (resolved.kind !== ModuleImportResultKind.Module) return;
      assertEquals(
        [...resolved.module.rules.keys()],
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
        context(),
      );
      assertEquals(resolved.kind, ModuleImportResultKind.Module);
      if (resolved.kind !== ModuleImportResultKind.Module) return;
      assertEquals(
        [...resolved.module.rules.keys()],
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
        context(),
      );
      assertEquals(resolved.kind, ModuleImportResultKind.Module);
      if (resolved.kind !== ModuleImportResultKind.Module) return;
      assertEquals(
        [...resolved.module.rules.keys()],
        [],
      );
      assertEquals(
        [...resolved.module.imports.get("A")!.module.rules.keys()],
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
        context(),
      );
      const t2 = await resolver.import(
        new URL("./resolvers/test2.module.ts", import.meta.url),
        context(),
      );
      assertEquals(t1.kind, ModuleImportResultKind.Module);
      assertEquals(t2.kind, ModuleImportResultKind.Module);
      if (
        t1.kind !== ModuleImportResultKind.Module ||
        t2.kind !== ModuleImportResultKind.Module
      ) return;
      assertEquals(
        t1.module.imports.get("A")?.module,
        t2.module.imports.get("A")?.module,
      );
    },
  });

  Deno.test({
    name: "RESOLVE05",
    fn: async () => {
      const resolver = new Resolver();
      const m = await resolver.import(
        new URL("./resolvers/test.bad.module.txt", import.meta.url),
        context(),
      );
      assertEquals(m.kind, ModuleImportResultKind.Error);
      if (m.kind !== ModuleImportResultKind.Error) return;
      assertEquals(m.error.kind, MatchKind.Error);
      assertEquals(m.error.code, MatchErrorCode.ModuleResolution);
      assertEquals(
        m.error.message,
        "Unable to resolve file of unknown extension .txt",
      );
    },
  });

  Deno.test({
    name: "RESOLVE06",
    fn: async () => {
      const resolver = new Resolver();
      const m = await resolver.import(
        new URL("./resolvers/test.bad.module.js", import.meta.url),
        context(),
      );
      assertEquals(m.kind, ModuleImportResultKind.Error);
      if (m.kind !== ModuleImportResultKind.Error) return;
      assertEquals(m.error.kind, MatchKind.Error);
      assertEquals(m.error.code, MatchErrorCode.ModuleResolution);
      assertEquals(
        m.error.message,
        `Imported module ${new URL(
          "./resolvers/test.bad.module.js",
          import.meta.url,
        )} must export a ModuleDeclaration as a default export`,
      );
    },
  });

  Deno.test({
    name: "RESOLVE07",
    fn: async () => {
      const resolver = new Resolver();
      const m = await resolver.import(
        new URL("./resolvers/test.bad.module.json", import.meta.url),
        context(),
      );
      assertEquals(m.kind, ModuleImportResultKind.Error);
      if (m.kind !== ModuleImportResultKind.Error) return;
      assertEquals(m.error.kind, MatchKind.Error);
      assertEquals(m.error.code, MatchErrorCode.ModuleResolution);
      assertEquals(
        m.error.message,
        `Unable to import module declaration from ${new URL(
          "./resolvers/test.bad.module.json",
          import.meta.url,
        )}`,
      );
      assert(m.error.cause instanceof Error);
    },
  });
} else {
  Deno.test({
    name: "resolve tests require read permissions",
    ignore: true,
    fn: () => {},
  });
}
