import { assertEquals } from "@std/assert";
import { join, resolve, toFileUrl } from "@std/path";
import {
  artifactPathForSource,
  artifactPathForUffUrl,
  defaultArtifactLayout,
  outputNameForSource,
  toStableSourcePath,
} from "./artifact_path.ts";

Deno.test("artifact_path maps source paths like CLI compile emission", () => {
  const root = resolve("/repo");
  const source = join(root, "src/lang/common/characters/digit.uff");
  assertEquals(
    toStableSourcePath(root, source),
    "src/lang/common/characters/digit.uff",
  );
  assertEquals(
    outputNameForSource("src/lang/common/characters/digit.uff"),
    "src/lang/common/characters/digit.uffda.ast.json",
  );
  assertEquals(
    artifactPathForSource(defaultArtifactLayout(root), source),
    join(root, "bin/ast/src/lang/common/characters/digit.uffda.ast.json"),
  );
  assertEquals(
    artifactPathForUffUrl(defaultArtifactLayout(root), toFileUrl(source)),
    join(root, "bin/ast/src/lang/common/characters/digit.uffda.ast.json"),
  );
});

Deno.test("artifact_path places artifacts under the layout's outDir", () => {
  const root = resolve("/repo");
  assertEquals(
    artifactPathForSource(
      { root, outDir: join(root, "build") },
      join(root, "nested", "mod.uff"),
    ),
    join(root, "build/ast/nested/mod.uffda.ast.json"),
  );
});

Deno.test("artifact_path gives no artifact for a source outside the root", () => {
  const layout = defaultArtifactLayout(resolve("/repo/project"));
  assertEquals(
    artifactPathForSource(layout, resolve("/repo/other/mod.uff")),
    undefined,
  );
  assertEquals(
    artifactPathForSource(layout, resolve("/repo/project")),
    undefined,
  );
  assertEquals(
    artifactPathForSource(layout, resolve("/repo/project/..x/mod.uff")),
    join(layout.outDir, "ast/..x/mod.uffda.ast.json"),
  );
});
