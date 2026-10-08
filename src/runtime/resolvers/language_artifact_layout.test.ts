import { assertEquals } from "@std/assert";
import {
  builtInUffResolver,
  languageArtifactPackageRoot,
} from "./language_artifact_layout.ts";
import { PackageUffArtifactResolver } from "./uff.artifact.resolver.ts";

Deno.test("languageArtifactPackageRoot is the package root, not the cwd's", () => {
  const packageRoot = new URL("../../../", import.meta.url);
  assertEquals(languageArtifactPackageRoot().href, packageRoot.href);
  const cwd = Deno.cwd();
  try {
    Deno.chdir(Deno.makeTempDirSync());
    assertEquals(languageArtifactPackageRoot().href, packageRoot.href);
  } finally {
    Deno.chdir(cwd);
  }
});

Deno.test("builtInUffResolver resolves .uff for the package root", () => {
  const resolver = builtInUffResolver();
  assertEquals(resolver instanceof PackageUffArtifactResolver, true);
  assertEquals(resolver.extension, ".uff");
});
