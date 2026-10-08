import { assertEquals } from "@std/assert";
import { join, resolve, toFileUrl } from "@std/path";
import {
  artifactPathForSource,
  artifactPathForUffUrl,
  defaultArtifactLayout,
  outputNameForSource,
  packageArtifactUrl,
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

Deno.test("packageArtifactUrl maps a module URL under any package root", () => {
  // A published https package root (as a JSR consumer sees it).
  assertEquals(
    packageArtifactUrl(
      new URL("https://jsr.io/@justinmchase/uffda/0.9.1/"),
      new URL(
        "https://jsr.io/@justinmchase/uffda/0.9.1/src/lang/uffda/specifier.rules.uff",
      ),
    )?.href,
    "https://jsr.io/@justinmchase/uffda/0.9.1/bin/ast/src/lang/uffda/specifier.rules.uffda.ast.json",
  );
  // A local file: checkout root, matching the filesystem layout's mapping.
  const root = toFileUrl(resolve("/repo") + "/");
  assertEquals(
    packageArtifactUrl(root, new URL("src/lang/uffda/mod.uff", root))?.href,
    new URL("bin/ast/src/lang/uffda/mod.uffda.ast.json", root).href,
  );
});

Deno.test("packageArtifactUrl honors a project's custom outDir", () => {
  const root = new URL("https://example.test/pkg/1.0.0/");
  assertEquals(
    packageArtifactUrl(root, new URL("src/app.uff", root), "./build")?.href,
    "https://example.test/pkg/1.0.0/build/ast/src/app.uffda.ast.json",
  );
});

Deno.test("packageArtifactUrl gives no artifact outside the package root", () => {
  const root = new URL("https://example.test/pkg/1.0.0/");
  assertEquals(
    packageArtifactUrl(root, new URL("https://example.test/other/app.uff")),
    undefined,
  );
  assertEquals(packageArtifactUrl(root, root), undefined);
});
