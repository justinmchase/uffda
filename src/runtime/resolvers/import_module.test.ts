import { assertEquals } from "@std/assert";
import { importModule } from "./import_module.ts";

Deno.test("importModule loads a JSON module by runtime specifier", async () => {
  const module = await importModule(
    new URL("./test.module.json", import.meta.url).href,
    { with: { type: "json" } },
  );
  assertEquals((module.default as { kind?: string }).kind, "module");
});
