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
  "req:cli-distribution-002 - release-binaries attaches assets without managing git tags",
  async () => {
    const yaml = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "release-binaries.yml"),
    );
    assertEquals(yaml.includes("Replace assets on draft release"), true);
    assertEquals(yaml.includes("gh release upload"), true);
    assertEquals(yaml.includes("force=true"), false);
    assertEquals(yaml.includes("git/refs/tags/"), false);
  },
);

Deno.test(
  "req:cli-distribution-003 - linux install script installs uffda",
  async () => {
    assertEquals(installScriptFileName(), "install.sh");
    const script = await Deno.readTextFile(
      join(repoRoot, "scripts", installScriptFileName()),
    );
    assertEquals(script.includes('install_asset "uffda"'), true);
    assertEquals(script.includes("uffdar"), false);
    assertEquals(script.includes("SHA256SUMS"), true);
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
