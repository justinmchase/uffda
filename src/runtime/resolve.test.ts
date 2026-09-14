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

  Deno.test({
    name:
      "RESOLVE08 - resolvedModules/moduleDeclarations expose every resolved module",
    fn: async () => {
      const resolver = new Resolver();
      const moduleUrl = new URL(
        "./resolvers/test.module.json",
        import.meta.url,
      );
      const resolved = await resolver.import(moduleUrl, context());
      assertEquals(resolved.kind, ModuleImportResultKind.Module);
      if (resolved.kind !== ModuleImportResultKind.Module) return;

      assert(resolver.resolvedModules.has(moduleUrl.href));
      assertEquals(
        resolver.resolvedModules.get(moduleUrl.href),
        resolved.module,
      );
      assert(resolver.moduleDeclarations.has(moduleUrl.href));
    },
  });

  Deno.test({
    name: "RESOLVE09 - a failed import is rolled back, not cached as a success",
    fn: async () => {
      const resolver = new Resolver();
      const moduleUrl = new URL(
        "./resolvers/test.bad.module.json",
        import.meta.url,
      );
      const first = await resolver.import(moduleUrl, context());
      assertEquals(first.kind, ModuleImportResultKind.Error);

      // The failed URL must not be memoized as if it had succeeded:
      // `resolvedModules` must not carry a half-built entry for it, and a
      // second `import()` of the same URL must fail again rather than
      // returning a cached "success" for the broken module.
      assert(!resolver.resolvedModules.has(moduleUrl.href));

      const second = await resolver.import(moduleUrl, context());
      assertEquals(second.kind, ModuleImportResultKind.Error);
    },
  });
} else {
  Deno.test({
    name: "resolve tests require read permissions",
    ignore: true,
    fn: () => {},
  });
}
