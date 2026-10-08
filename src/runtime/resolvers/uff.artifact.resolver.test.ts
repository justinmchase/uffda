import { assert, assertEquals } from "@std/assert";
import { fromFileUrl, join, toFileUrl } from "@std/path";
import { MatchErrorCode } from "../../match.ts";
import { compileSourcesToAstArtifacts } from "../../cli/compile.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../patterns/pattern.ts";
import { Resolver } from "../resolve.ts";
import {
  ModuleDeclarationResultKind,
  ModuleImportResultKind,
} from "./resolver.ts";
import { PackageUffArtifactResolver } from "./uff.artifact.resolver.ts";
import { Scope } from "../scope.ts";

function context() {
  return {
    scope: Scope.Default(),
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
    } as const,
  };
}

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test("uff.artifact.resolver loads Digit from mirrored bin AST", async () => {
  const artifactRoot = await Deno.makeTempDir({ prefix: "uffda-uff-resolve-" });
  try {
    const digitUff = join(
      repoRoot,
      "src/lang/common/characters/digit.uff",
    );
    const compiled = await compileSourcesToAstArtifacts({
      cwd: repoRoot,
      sourcePaths: [digitUff],
      artifacts: { root: repoRoot, outDir: artifactRoot },
      overwrite: true,
    });
    assertEquals(compiled.ok, true);

    const resolver = new Resolver({
      artifacts: { root: repoRoot, outDir: artifactRoot },
    });
    const result = await resolver.import(toFileUrl(digitUff), context());
    assertEquals(result.kind, ModuleImportResultKind.Module);
    if (result.kind !== ModuleImportResultKind.Module) return;
    assertEquals([...result.module.exports.keys()], ["Digit"]);
    assertEquals(result.module.moduleUrl.href, toFileUrl(digitUff).href);
  } finally {
    await Deno.remove(artifactRoot, { recursive: true });
  }
});

Deno.test("uff.artifact.resolver fails clearly when artifact is missing", async () => {
  const artifactRoot = await Deno.makeTempDir({
    prefix: "uffda-uff-missing-",
  });
  try {
    const digitUff = join(
      repoRoot,
      "src/lang/common/characters/digit.uff",
    );
    const resolver = new Resolver({
      artifacts: { root: repoRoot, outDir: artifactRoot },
    });
    const result = await resolver.import(toFileUrl(digitUff), context());
    assertEquals(result.kind, ModuleImportResultKind.Error);
    if (result.kind !== ModuleImportResultKind.Error) return;
    assertEquals(result.error.code, MatchErrorCode.ModuleResolution);
    assert(result.error.message.includes("compile the .uff source first"));
    assert(result.error.message.includes("digit.uffda.ast.json"));
  } finally {
    await Deno.remove(artifactRoot, { recursive: true });
  }
});

Deno.test("uff.artifact.resolver fails for a module outside the layout's root", async () => {
  const root = await Deno.makeTempDir({ prefix: "uffda-uff-outside-" });
  try {
    const resolver = new Resolver({
      artifacts: { root, outDir: join(root, "bin") },
    });
    const result = await resolver.import(
      toFileUrl(join(repoRoot, "src/lang/common/characters/digit.uff")),
      context(),
    );
    assertEquals(result.kind, ModuleImportResultKind.Error);
    if (result.kind !== ModuleImportResultKind.Error) return;
    assertEquals(result.error.code, MatchErrorCode.ModuleResolution);
    assert(
      result.error.message.includes(`is outside ${root}`),
      result.error.message,
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("uff.artifact.resolver resolves nested .uff imports via artifacts", async () => {
  const cwd = await Deno.makeTempDir({ prefix: "uffda-uff-nested-" });
  const artifactRoot = join(cwd, "bin");
  try {
    const leafPath = join(cwd, "leaf.uff");
    const rootPath = join(cwd, "root.uff");
    await Deno.writeTextFile(leafPath, "export rule Leaf = any;\n");
    await Deno.writeTextFile(
      rootPath,
      `import "./leaf.uff" Leaf;\nexport rule Root = Leaf;\n`,
    );

    const compiled = await compileSourcesToAstArtifacts({
      cwd,
      sourcePaths: [leafPath, rootPath],
      artifacts: { root: cwd, outDir: artifactRoot },
      overwrite: true,
    });
    assertEquals(compiled.ok, true, JSON.stringify(compiled.failures));

    const resolver = new Resolver({
      artifacts: { root: cwd, outDir: artifactRoot },
    });
    const result = await resolver.import(toFileUrl(rootPath), context());
    assertEquals(result.kind, ModuleImportResultKind.Module);
    if (result.kind !== ModuleImportResultKind.Module) return;
    assertEquals([...result.module.exports.keys()], ["Root"]);
    assertEquals(result.module.imports.has("Leaf"), true);
  } finally {
    await Deno.remove(cwd, { recursive: true });
  }
});

Deno.test(
  "PackageUffArtifactResolver loads a .uff from a file: package root",
  async () => {
    const packageRoot = new URL("../../../", import.meta.url);
    const digitUff = join(
      repoRoot,
      "src/lang/common/characters/digit.uff",
    );
    const resolver = new PackageUffArtifactResolver(packageRoot);
    const result = await resolver.resolveModule(toFileUrl(digitUff), context());
    assertEquals(result.kind, ModuleDeclarationResultKind.ModuleDeclaration);
    if (result.kind !== ModuleDeclarationResultKind.ModuleDeclaration) return;
    assertEquals(
      result.moduleDeclaration.exports.some((e) => e.name === "Digit"),
      true,
    );
  },
);

Deno.test(
  "req:cli-distribution-006 - PackageUffArtifactResolver loads a .uff from an https: package root (#271)",
  async () => {
    // The published JSR package is served over https. The old filesystem-only
    // layout threw for non-file roots; a consumer importing jsr:@justinmchase/
    // uffda must still load the built-in grammar artifacts over the network.
    const artifactText = await Deno.readTextFile(
      join(repoRoot, "bin/ast/src/lang/common/characters/digit.uffda.ast.json"),
    );
    const packageRoot = new URL("https://jsr.io/@justinmchase/uffda/0.9.1/");
    const moduleUrl = new URL(
      "src/lang/common/characters/digit.uff",
      packageRoot,
    );
    const expectedArtifact = new URL(
      "bin/ast/src/lang/common/characters/digit.uffda.ast.json",
      packageRoot,
    );
    const originalFetch = globalThis.fetch;
    const fetched: string[] = [];
    globalThis.fetch = ((input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      fetched.push(url);
      return Promise.resolve(new Response(artifactText, { status: 200 }));
    }) as typeof fetch;
    try {
      const resolver = new PackageUffArtifactResolver(packageRoot);
      const result = await resolver.resolveModule(moduleUrl, context());
      assertEquals(result.kind, ModuleDeclarationResultKind.ModuleDeclaration);
      if (result.kind !== ModuleDeclarationResultKind.ModuleDeclaration) return;
      assertEquals(
        result.moduleDeclaration.exports.some((e) => e.name === "Digit"),
        true,
      );
      assertEquals(fetched, [expectedArtifact.href]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "PackageUffArtifactResolver fails for a module outside the package root",
  async () => {
    const resolver = new PackageUffArtifactResolver(
      new URL("https://jsr.io/@justinmchase/uffda/0.9.1/"),
    );
    const result = await resolver.resolveModule(
      new URL("https://example.test/other/mod.uff"),
      context(),
    );
    assertEquals(result.kind, ModuleDeclarationResultKind.Error);
    if (result.kind !== ModuleDeclarationResultKind.Error) return;
    assertEquals(result.error.code, MatchErrorCode.ModuleResolution);
    assert(result.error.message.includes("outside the package"));
  },
);

Deno.test(
  "PackageUffArtifactResolver honors the package's custom outDir",
  async () => {
    const packageRoot = new URL("https://example.test/@acme/dsl/1.0.0/");
    const moduleUrl = new URL("src/grammar.uff", packageRoot);
    const artifactUrl = new URL(
      "build/ast/src/grammar.uffda.ast.json",
      packageRoot,
    );
    const artifactText = JSON.stringify({
      imports: [],
      exports: [],
      rules: [],
    });
    const originalFetch = globalThis.fetch;
    const fetched: string[] = [];
    globalThis.fetch = ((input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      fetched.push(url);
      return Promise.resolve(new Response(artifactText, { status: 200 }));
    }) as typeof fetch;
    try {
      const resolver = new PackageUffArtifactResolver(
        packageRoot,
        "./build",
      );
      const result = await resolver.resolveModule(moduleUrl, context());
      assertEquals(result.kind, ModuleDeclarationResultKind.ModuleDeclaration);
      assertEquals(fetched, [artifactUrl.href]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
