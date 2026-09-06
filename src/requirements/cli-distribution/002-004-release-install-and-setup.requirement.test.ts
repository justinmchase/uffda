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
