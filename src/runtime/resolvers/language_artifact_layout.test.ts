import { assertEquals } from "@std/assert";
import { resolve } from "@std/path";
import { languageArtifactLayout } from "./language_artifact_layout.ts";

Deno.test("languageArtifactLayout uses Deno.cwd for in-tree runs", () => {
  assertEquals(Deno.build.standalone, false);
  assertEquals(languageArtifactLayout(import.meta.url), {
    root: Deno.cwd(),
    outDir: resolve(Deno.cwd(), "bin"),
  });
});
