import { assertEquals } from "@std/assert";
import { join, resolve, toFileUrl } from "@std/path";
import {
  astArtifactPathForSource,
  astArtifactPathForUffUrl,
  DEFAULT_ARTIFACT_ROOT,
  outputNameForSource,
  toStableSourcePath,
} from "./artifact_path.ts";

Deno.test("artifact_path maps source paths like CLI compile emission", () => {
  const cwd = "/repo";
  const source = "/repo/src/lang/common/characters/digit.uff";
  assertEquals(
    toStableSourcePath(cwd, source),
    "src/lang/common/characters/digit.uff",
  );
  assertEquals(
    outputNameForSource("src/lang/common/characters/digit.uff"),
    "src/lang/common/characters/digit.uffda.ast.json",
  );
  assertEquals(
    astArtifactPathForSource(cwd, DEFAULT_ARTIFACT_ROOT, source),
    resolve(cwd, "bin/ast/src/lang/common/characters/digit.uffda.ast.json"),
  );
  assertEquals(
    astArtifactPathForUffUrl(cwd, "./bin", toFileUrl(source)),
    resolve(cwd, "bin/ast/src/lang/common/characters/digit.uffda.ast.json"),
  );
});

Deno.test("artifact_path joins custom artifact roots under ast/", () => {
  const cwd = "/repo";
  const source = join(cwd, "nested", "mod.uff");
  assertEquals(
    astArtifactPathForSource(cwd, ".uffda", source),
    resolve(cwd, ".uffda/ast/nested/mod.uffda.ast.json"),
  );
});
