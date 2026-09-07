import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-adoption-001 - checks workflow uses uffda-setup with a published CLI",
  async () => {
    const yaml = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "checks.yml"),
    );
    assertEquals(yaml.includes("uses: ./.github/actions/uffda-setup"), true);
    // Prefer latest; allow a pinned published SemVer when latest cannot compile
    // the current tree (bootstrap chicken-egg after a bad release).
    assertEquals(
      /version:\s*(latest|"?\d+\.\d+\.\d+"?)/.test(yaml),
      true,
    );
  },
);

Deno.test(
  "req:cli-adoption-002 - checks compile language .uff modules into ./bin",
  async () => {
    const yaml = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "checks.yml"),
    );
    assertEquals(yaml.includes("src/lang/**/*.uff"), true);
    assertEquals(yaml.includes("uffda compile"), true);
    assertEquals(yaml.includes("deno task cli compile"), false);
    assertEquals(
      yaml.includes(
        "./bin/ast/src/lang/common/characters/digit.uffda.ast.json",
      ),
      true,
    );
    assertEquals(
      yaml.includes(
        "./bin/ast/src/lang/common/characters/combining.uffda.ast.json",
      ),
      true,
    );
    assertEquals(
      yaml.includes(
        "./bin/ast/src/lang/common/characters/whitespace.uffda.ast.json",
      ),
      true,
    );
    assertEquals(
      yaml.includes(
        "./bin/ast/src/lang/common/characters/newLine.uffda.ast.json",
      ),
      true,
    );
    assertEquals(
      yaml.includes(
        "./bin/ast/src/lang/common/characters/mod.uffda.ast.json",
      ),
      true,
    );
    assertEquals(
      yaml.includes(
        "./bin/ast/src/lang/common/identifier.uffda.ast.json",
      ),
      true,
    );
    assertEquals(
      yaml.includes(
        "./bin/ast/src/lang/common/surround.uffda.ast.json",
      ),
      true,
    );
    assertEquals(
      yaml.includes(
        "./bin/ast/src/lang/tokenizer/token.uffda.ast.json",
      ),
      true,
    );
    assertEquals(
      yaml.includes(
        "./bin/ast/src/lang/common/spread.uffda.ast.json",
      ),
      true,
    );
  },
);

Deno.test(
  "req:cli-adoption-002 - checks runs bootstrap import after compile",
  async () => {
    const yaml = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "checks.yml"),
    );
    assertEquals(
      yaml.includes(
        "005-ci-compile-then-import.requirement.test.ts",
      ),
      true,
    );
  },
);
