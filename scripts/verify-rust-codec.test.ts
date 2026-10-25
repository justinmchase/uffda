import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { verifyRustCodec } from "./verify-rust-codec.ts";

const suffix = process.platform === "win32" ? ".exe" : "";
const cli = resolve(`target/release/uffda${suffix}`);
const probe = resolve(`target/release/examples/codec_probe${suffix}`);

test(
  "req:data-codec-004 - installed CLI and streaming consumer execute without runtime tools or external grammars",
  {
    skip:
      !existsSync(cli) || !existsSync(probe)
        ? "release CLI and codec probe are not built"
        : false,
  },
  async () => {
    await verifyRustCodec(cli, probe);
  },
);
