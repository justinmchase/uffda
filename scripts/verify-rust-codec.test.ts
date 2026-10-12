import { fromFileUrl } from "@std/path";
import { verifyRustCodec } from "./verify-rust-codec.ts";

Deno.test({
  name:
    "req:data-codec-004 - installed CLI and streaming consumer execute without runtime tools or external grammars",
  ignore: (await Deno.permissions.query({ name: "run" })).state !== "granted",
  fn: async () => {
    const suffix = Deno.build.os === "windows" ? ".exe" : "";
    await verifyRustCodec(
      fromFileUrl(
        new URL(`../rust/target/release/uffda${suffix}`, import.meta.url),
      ),
      fromFileUrl(
        new URL(
          `../rust/target/release/examples/codec_probe${suffix}`,
          import.meta.url,
        ),
      ),
    );
  },
});
