import { assertEquals } from "@std/assert";
import { resolve } from "@std/path";
import { DEFAULT_ARTIFACT_ROOT } from "./artifact_path.ts";
import { languageArtifactRoots } from "./language_artifact_roots.ts";

Deno.test("languageArtifactRoots uses Deno.cwd for in-tree runs", () => {
  assertEquals(Deno.build.standalone, false);
  const roots = languageArtifactRoots(import.meta.url);
  assertEquals(roots.cwd, Deno.cwd());
  assertEquals(roots.artifactRoot, resolve(Deno.cwd(), DEFAULT_ARTIFACT_ROOT));
});
