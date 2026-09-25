import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  declarationSpanInMatch,
  definitionAtPosition,
  fileUrlForPath,
} from "./lsp.definition.ts";
import { offsetToPosition } from "./lsp.positions.ts";
import { RuntimeSession } from "./mcp.session.ts";

Deno.test("cli.lsp.definition declarationSpanInMatch", async (t) => {
  await t.step("finds a rule declaration span by projected name", async () => {
    const cwd = await Deno.makeTempDir({ prefix: "uffda-lsp-def-" });
    try {
      const path = join(cwd, "main.uff");
      const source = "export Main;\nrule Main = any;";
      await Deno.writeTextFile(path, source);
      const session = new RuntimeSession("def-span", { cwd });
      const load = await session.load(source, path);
      assertEquals(load.ok, true);
      const state = session.getLatestParseState();
      assert(state);
      const span = declarationSpanInMatch(state.match, "Main");
      assert(span);
      assertEquals(
        source.slice(span.start, span.end).includes("rule Main"),
        true,
      );
    } finally {
      await Deno.remove(cwd, { recursive: true });
    }
  });
});

Deno.test("cli.lsp.definition definitionAtPosition", async (t) => {
  await t.step(
    "resolves a same-file rule reference to its declaration span",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-lsp-def-" });
      try {
        const path = join(cwd, "main.uff");
        const source = "export Main;\nrule Main = any;";
        await Deno.writeTextFile(path, source);
        const session = new RuntimeSession("def-same", { cwd });
        const load = await session.load(source, path);
        assertEquals(load.ok, true);
        const state = session.getLatestParseState();
        assert(state);

        // Hover the name in `export Main`
        const offset = source.indexOf("Main");
        const locations = await definitionAtPosition(
          session,
          source,
          offsetToPosition(source, offset),
          state.match,
        );
        assertEquals(locations.length, 1);
        assertEquals(locations[0].uri, fileUrlForPath(path));
        const span = declarationSpanInMatch(state.match, "Main");
        assert(span);
        assertEquals(
          locations[0].range,
          {
            start: offsetToPosition(source, span.start),
            end: offsetToPosition(source, span.end),
          },
        );
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "resolves an imported name to the defining module's declaration",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-lsp-def-" });
      try {
        const depPath = join(cwd, "dep.uff");
        const mainPath = join(cwd, "main.uff");
        const depSource = "export Foo;\nrule Foo = any;";
        const mainSource =
          'import "./dep.uff" Foo;\nexport Main;\nrule Main = Foo;';
        await Deno.writeTextFile(depPath, depSource);
        await Deno.writeTextFile(mainPath, mainSource);

        const session = new RuntimeSession("def-import", { cwd });
        const load = await session.load(mainSource, mainPath);
        assertEquals(load.ok, true);
        const state = session.getLatestParseState();
        assert(state);

        // The `Foo` in `rule Main = Foo`
        const offset = mainSource.lastIndexOf("Foo");
        const locations = await definitionAtPosition(
          session,
          mainSource,
          offsetToPosition(mainSource, offset),
          state.match,
        );
        assertEquals(locations.length, 1);
        assertEquals(locations[0].uri, fileUrlForPath(depPath));
        assertEquals(
          locations[0].range.start.line >= 0,
          true,
        );
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "returns an empty list for an unresolved identifier",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-lsp-def-" });
      try {
        const path = join(cwd, "main.uff");
        const source = "export Main;\nrule Main = any;";
        await Deno.writeTextFile(path, source);
        const session = new RuntimeSession("def-miss", { cwd });
        await session.load(source, path);
        const state = session.getLatestParseState();
        assert(state);
        const offset = source.lastIndexOf("any");
        const locations = await definitionAtPosition(
          session,
          source,
          offsetToPosition(source, offset),
          state.match,
        );
        assertEquals(locations, []);
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );
});
