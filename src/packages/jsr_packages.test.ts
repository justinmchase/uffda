import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { ModuleDeclarationResultKind } from "../runtime/resolvers/resolver.ts";
import { Scope } from "../runtime/scope.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../runtime/patterns/pattern.ts";
import { fakeRegistry, type FakeVersion } from "./fake_registry.ts";
import { JsrPackages } from "./jsr_packages.ts";
import { Lockfile } from "./lockfile.ts";

const declaration = (rule: string) =>
  JSON.stringify({
    imports: [],
    exports: [{ kind: "rule", name: rule }],
    rules: [{ name: rule, parameters: [], pattern: { kind: "any" } }],
  });

/** A package version exporting `src/kv.uff` and `src/tokens.uff`. */
const kv = (rule: string, extra: Partial<FakeVersion> = {}): FakeVersion => ({
  files: {
    "uffda.jsonc": JSON.stringify({
      exports: { ".": "./src/kv.uff", "./tokens": "./src/tokens.uff" },
      outDir: "./out",
    }),
    "src/kv.uff": "export rule = any",
    "out/ast/src/kv.uffda.ast.json": declaration(rule),
    "out/ast/src/tokens.uffda.ast.json": declaration("T"),
  },
  ...extra,
});

const context = () => ({
  scope: Scope.Default(),
  pattern: {
    kind: PatternKind.Resolve,
    targetKind: ResolveTargetKind.Run,
  } as const,
});

async function setup(
  versions: Record<string, FakeVersion>,
  lockfile?: Lockfile,
) {
  const fake = await fakeRegistry({ "@acme/kv": versions });
  const cacheDir = await Deno.makeTempDir();
  const packages = new JsrPackages({
    registry: fake.registry,
    fetch: fake.fetch,
    cacheDir,
    lockfile,
  });
  return { fake, cacheDir, packages };
}

Deno.test("jsr_packages.JsrPackages", async (t) => {
  await t.step("resolves the highest matching version's export", async () => {
    const { fake, packages } = await setup({
      "1.2.0": kv("A"),
      "1.3.0": kv("B"),
      "1.4.0": kv("C", { yanked: true }),
      "2.0.0": kv("D"),
    });
    const resolution = await packages.resolve("jsr:@acme/kv@^1.2.0");
    assertEquals(resolution, {
      ok: true,
      url: new URL("@acme/kv/1.3.0/src/kv.uff", fake.registry),
    });
    const tokens = await packages.resolve("jsr:@acme/kv@^1.2.0/tokens");
    assertEquals(
      tokens.ok && tokens.url.href,
      new URL("@acme/kv/1.3.0/src/tokens.uff", fake.registry).href,
    );
  });

  await t.step("without a range takes the highest stable version", async () => {
    const { fake, packages } = await setup({
      "1.0.0": kv("A"),
      "2.0.0-pre.1": kv("B"),
    });
    const resolution = await packages.resolve("jsr:@acme/kv");
    assertEquals(
      resolution.ok && resolution.url.href,
      new URL("@acme/kv/1.0.0/src/kv.uff", fake.registry).href,
    );
  });

  await t.step("reuses a version already chosen that matches", async () => {
    const { packages } = await setup({ "1.2.0": kv("A"), "1.3.0": kv("B") });
    const exact = await packages.resolve("jsr:@acme/kv@1.2.0");
    const ranged = await packages.resolve("jsr:@acme/kv@^1.0.0");
    assertEquals(
      exact.ok && ranged.ok && ranged.url.href,
      exact.ok && exact.url.href,
    );
  });

  await t.step("loads the compiled artifact from the outDir", async () => {
    const { packages } = await setup({ "1.0.0": kv("A") });
    const resolution = await packages.resolve("jsr:@acme/kv@1");
    assert(resolution.ok);
    assertEquals(packages.packageOf(resolution.url), "@acme/kv@1.0.0");
    const result = await packages.load(resolution.url, context());
    assertEquals(result.kind, ModuleDeclarationResultKind.ModuleDeclaration);
    assertEquals(
      result.kind === ModuleDeclarationResultKind.ModuleDeclaration &&
        result.moduleDeclaration.rules[0].name,
      "A",
    );
  });

  await t.step("reads files from the cache once downloaded", async () => {
    const { fake, packages, cacheDir } = await setup({ "1.0.0": kv("A") });
    const url = new URL("@acme/kv/1.0.0/src/kv.uff", fake.registry);
    await packages.load(url, context());
    const downloads = fake.requests.length;
    const again = new JsrPackages({
      registry: fake.registry,
      fetch: fake.fetch,
      cacheDir,
    });
    const result = await again.load(url, context());
    assertEquals(result.kind, ModuleDeclarationResultKind.ModuleDeclaration);
    assertEquals(fake.requests.length, downloads);
    assert(
      (await Deno.stat(
        join(cacheDir, "jsr", "@acme", "kv", "1.0.0", "uffda.jsonc"),
      )).isFile,
    );
  });

  await t.step(
    "downloads again a cached file that fails its checksum",
    async () => {
      const { fake, packages, cacheDir } = await setup({ "1.0.0": kv("A") });
      const url = new URL("@acme/kv/1.0.0/src/kv.uff", fake.registry);
      await packages.load(url, context());
      const artifact = join(
        cacheDir,
        ...["jsr", "@acme", "kv", "1.0.0", "out", "ast", "src"],
        "kv.uffda.ast.json",
      );
      await Deno.writeTextFile(artifact, declaration("TAMPERED"));
      const again = new JsrPackages({
        registry: fake.registry,
        fetch: fake.fetch,
        cacheDir,
      });
      const result = await again.load(url, context());
      assertEquals(
        result.kind === ModuleDeclarationResultKind.ModuleDeclaration &&
          result.moduleDeclaration.rules[0].name,
        "A",
      );
    },
  );

  await t.step("records and follows the lockfile", async () => {
    const lockfile = new Lockfile();
    const { packages } = await setup(
      { "1.2.0": kv("A"), "1.3.0": kv("B") },
      lockfile,
    );
    await packages.resolve("jsr:@acme/kv@^1.2.0");
    assertEquals(lockfile.version("jsr:@acme/kv@^1.2.0"), "1.3.0");
    assert(lockfile.integrity("@acme/kv@1.3.0"));

    const pinned = new Lockfile({
      specifiers: { "jsr:@acme/kv@^1.2.0": "1.2.0" },
      jsr: {},
    });
    const locked = await setup({ "1.2.0": kv("A"), "1.3.0": kv("B") }, pinned);
    const resolution = await locked.packages.resolve("jsr:@acme/kv@^1.2.0");
    assertEquals(
      resolution.ok && resolution.url.href,
      new URL("@acme/kv/1.2.0/src/kv.uff", locked.fake.registry).href,
    );
    assert(!locked.fake.requests.includes("@acme/kv/meta.json"));
  });

  await t.step("a version meta that is not the locked one fails", async () => {
    const lockfile = new Lockfile({
      specifiers: {},
      jsr: { "@acme/kv@1.0.0": { integrity: "0".repeat(64) } },
    });
    const { packages } = await setup({ "1.0.0": kv("A") }, lockfile);
    const resolution = await packages.resolve("jsr:@acme/kv@1.0.0");
    assert(!resolution.ok);
    assertStringIncludes(resolution.message, "lockfile");
  });

  await t.step("reports what it cannot resolve", async () => {
    const { packages } = await setup({
      "1.0.0": kv("A"),
      "2.0.0": {
        files: {
          "uffda.jsonc": JSON.stringify({ exports: { ".": "./mod.ts" } }),
          "mod.ts": "",
        },
      },
      "3.0.0": { files: { "uffda.jsonc": "{ nope" } },
      "4.0.0": { files: {} },
    });
    const message = async (specifier: string) => {
      const resolution = await packages.resolve(specifier);
      assert(!resolution.ok);
      return resolution.message;
    };
    assertStringIncludes(await message("jsr:@acme/kv@^9"), "no version");
    assertStringIncludes(
      await message("jsr:@acme/kv@1.0.0/nope"),
      'does not export "./nope"',
    );
    assertStringIncludes(await message("jsr:@acme/kv@2.0.0"), "not a .uff");
    assertStringIncludes(await message("jsr:@acme/kv@3.0.0"), "not valid");
    assertStringIncludes(await message("jsr:@acme/kv@4.0.0"), "has no file");
    assertStringIncludes(await message("jsr:@acme/missing"), "not found");
  });

  await t.step("loads .uff modules of a package only", async () => {
    const { fake, packages } = await setup({ "1.0.0": kv("A") });
    const result = await packages.load(
      new URL("@acme/kv/1.0.0/mod.ts", fake.registry),
      context(),
    );
    assertEquals(result.kind, ModuleDeclarationResultKind.Error);
    assertStringIncludes(
      result.kind === ModuleDeclarationResultKind.Error
        ? result.error.message
        : "",
      ".uff modules only",
    );
  });

  await t.step("rejects a file its manifest does not match", async () => {
    const fake = await fakeRegistry({ "@acme/kv": { "1.0.0": kv("A") } });
    const packages = new JsrPackages({
      registry: fake.registry,
      cacheDir: await Deno.makeTempDir(),
      fetch: async (url) =>
        url.href.endsWith(".uffda.ast.json")
          ? new Response(declaration("EVIL"))
          : await fake.fetch(url),
    });
    const result = await packages.load(
      new URL("@acme/kv/1.0.0/src/kv.uff", fake.registry),
      context(),
    );
    assertEquals(result.kind, ModuleDeclarationResultKind.Error);
    assertStringIncludes(
      result.kind === ModuleDeclarationResultKind.Error
        ? result.error.message
        : "",
      "does not match its manifest",
    );
  });
});
