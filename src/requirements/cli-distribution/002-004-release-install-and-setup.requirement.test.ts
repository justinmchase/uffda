import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import {
  checksumFileName,
  installScriptFileName,
} from "../../cli/distribution.ts";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-distribution-002 - release packaging publishes checksum asset name",
  async () => {
    assertEquals(checksumFileName(), "SHA256SUMS");
    await Deno.stat(
      join(repoRoot, ".github", "workflows", "release-binaries.yml"),
    );
  },
);

Deno.test(
  "req:cli-distribution-002 - release-binaries points draft at build commit without moving tags",
  async () => {
    const yaml = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "release-binaries.yml"),
    );
    assertEquals(yaml.includes("Point draft release at build commit"), true);
    assertEquals(yaml.includes("target_commitish"), true);
    assertEquals(yaml.includes("force=true"), false);
    assertEquals(
      yaml.includes("Git tag ${tag} already exists"),
      true,
    );
  },
);

Deno.test(
  "req:cli-distribution-003 - linux install script is checked in",
  async () => {
    assertEquals(installScriptFileName(), "install.sh");
    await Deno.stat(join(repoRoot, "scripts", installScriptFileName()));
  },
);

Deno.test(
  "req:cli-distribution-004 - uffda-setup action is checked in",
  async () => {
    await Deno.stat(
      join(repoRoot, ".github", "actions", "uffda-setup", "action.yml"),
    );
  },
);
