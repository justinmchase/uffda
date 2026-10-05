import { assertEquals } from "@std/assert";
import { fromFileUrl, resolve } from "@std/path";
import { languageArtifactLayout } from "./language_artifact_layout.ts";

Deno.test("languageArtifactLayout is the package's ./bin, not the cwd's", () => {
  const packageRoot = resolve(
    fromFileUrl(new URL("../../../", import.meta.url)),
  );
  const layout = languageArtifactLayout();
  assertEquals(layout, {
    root: packageRoot,
    outDir: resolve(packageRoot, "bin"),
  });
  const cwd = Deno.cwd();
  try {
    Deno.chdir(Deno.makeTempDirSync());
    assertEquals(languageArtifactLayout(), layout);
  } finally {
    Deno.chdir(cwd);
  }
});
