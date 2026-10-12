import { assertEquals, assertRejects } from "@std/assert";
import { importModule } from "./import_module.ts";

Deno.test("req:modules-runtime-002 - importModule loads a JSON module by runtime specifier", async () => {
  const module = await importModule(
    new URL("./test.module.json", import.meta.url).href,
    { with: { type: "json" } },
  );
  assertEquals((module.default as { kind?: string }).kind, "module");
});

Deno.test("req:modules-runtime-002 - network JSON is data and HTTP failures stay errors", async () => {
  const controller = new AbortController();
  const server = Deno.serve(
    {
      hostname: "127.0.0.1",
      port: 0,
      signal: controller.signal,
      onListen() {},
    },
    (request) =>
      new URL(request.url).pathname === "/module.json"
        ? new Response('{"imports":[],"exports":[],"rules":[]}', {
          headers: { "content-type": "application/json" },
        })
        : new Response("not found", { status: 404 }),
  );
  try {
    const base = `http://127.0.0.1:${server.addr.port}`;
    const result = await importModule(`${base}/module.json`, {
      with: { type: "json" },
    });
    assertEquals(result.default, { imports: [], exports: [], rules: [] });
    await assertRejects(
      () => importModule(`${base}/missing.json`, { with: { type: "json" } }),
      Error,
      "failed with 404",
    );
    await assertRejects(
      () =>
        importModule("data:application/json,{}", { with: { type: "json" } }),
      Error,
      "unknown extension",
    );
    await assertRejects(
      () => importModule(`${base}/module.json`),
      Error,
      "requires type json",
    );
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("req:modules-runtime-001 - data loader rejects executable and unknown extensions before reading", async () => {
  for (const extension of [".ts", ".js", ".mjs", ".txt", ".uff"]) {
    await assertRejects(
      () =>
        importModule(new URL(`./not-read${extension}`, import.meta.url).href, {
          with: { type: "json" },
        }),
      Error,
      `unknown extension ${extension}`,
    );
  }
});
