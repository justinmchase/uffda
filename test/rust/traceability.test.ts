import { assert, assertEquals } from "@std/assert";
import { walk } from "@std/fs/walk";

Deno.test("req:runtime-memory-005 - Rust inline tests cite existing requirement documents", async () => {
  const ids = new Set<string>();
  for await (const file of walk(".agents/requirements", { exts: [".md"] })) {
    const source = await Deno.readTextFile(file.path);
    const id = /^id:\s*(\S+)/m.exec(source)?.[1];
    if (id) ids.add(id);
  }
  let tests = 0;
  for await (
    const file of walk("rust", {
      exts: [".rs"],
      skip: [/[/\\]target(?:[/\\]|$)/],
    })
  ) {
    const source = await Deno.readTextFile(file.path);
    const annotations = source.match(/#\[test\]/g) ?? [];
    const declarations = [
      ...source.matchAll(/#\[test\]([\s\S]*?)\bfn\s+(\w+)\s*\(/g),
    ];
    assertEquals(declarations.length, annotations.length, file.path);
    for (const [, between, name] of declarations) {
      const citations = [...between.matchAll(/\breq:([a-z0-9-]+)/g)];
      assert(
        citations.length > 0,
        `${file.path}: ${name} has no requirement citation`,
      );
      for (const [, id] of citations) {
        assert(
          ids.has(id),
          `${file.path}: ${name} cites unknown requirement ${id}`,
        );
      }
      tests++;
    }
  }
  assert(tests > 0, "Rust test discovery must not silently find zero tests");
});
