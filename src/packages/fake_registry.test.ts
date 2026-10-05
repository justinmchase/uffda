import { assertEquals } from "@std/assert";
import { encodeHex } from "@std/encoding/hex";
import {
  fakeJsrPackages,
  fakeRegistry,
  fakeUffPackage,
} from "./fake_registry.ts";

Deno.test("fake_registry serves packages the way JSR does", async () => {
  const { registry, fetch, requests } = await fakeRegistry({
    "@acme/kv": {
      "1.0.0": { files: { "a.txt": "a" } },
      "1.1.0": { files: {}, yanked: true },
    },
  });
  const read = async (path: string) =>
    await (await fetch(new URL(path, registry))).text();

  assertEquals(JSON.parse(await read("@acme/kv/meta.json")), {
    scope: "acme",
    name: "kv",
    versions: { "1.0.0": {}, "1.1.0": { yanked: true } },
  });
  const sha = encodeHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode("a")),
  );
  assertEquals(JSON.parse(await read("@acme/kv/1.0.0_meta.json")), {
    manifest: { "/a.txt": { size: 1, checksum: `sha256-${sha}` } },
  });
  assertEquals(await read("@acme/kv/1.0.0/a.txt"), "a");
  assertEquals(
    (await fetch(new URL("@acme/kv/1.0.0/b.txt", registry))).status,
    404,
  );
  assertEquals(requests, [
    "@acme/kv/meta.json",
    "@acme/kv/1.0.0_meta.json",
    "@acme/kv/1.0.0/a.txt",
    "@acme/kv/1.0.0/b.txt",
  ]);
});

Deno.test("fake_registry.fakeJsrPackages loads a fakeUffPackage", async () => {
  const { packages, registry } = await fakeJsrPackages({
    "@acme/kv": {
      "1.0.0": fakeUffPackage({ "./tokens": "./src/tokens.uff" }, {
        "./tokens": "T",
      }),
    },
  });
  const resolution = await packages.resolve("jsr:@acme/kv@1/tokens");
  assertEquals(
    resolution.ok && resolution.url.href,
    new URL("@acme/kv/1.0.0/src/tokens.uff", registry).href,
  );
});
