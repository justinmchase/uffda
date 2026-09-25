import { assert, assertEquals } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import type {
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  InitializeParams,
  InitializeResult,
  SemanticTokensParams,
} from "vscode-languageserver/node";
import { SemanticTokensRequest } from "vscode-languageserver/node";
import { LANGUAGE_METADATA_METHOD } from "./language_metadata.ts";
import { type UffdaLspConnection, wireUffdaLspHandlers } from "./lsp.ts";
import { SEMANTIC_TOKENS_LEGEND } from "./semantic_tokens.ts";

/**
 * A minimal fake of the `Connection` surface `wireUffdaLspHandlers` uses,
 * capturing registered handlers so this test can invoke them directly
 * without a real stdio-backed LSP transport (see
 * `.agents/requirements/cli-language-server/001-server-mode-and-invocation.requirement.md`
 * and `.../003-document-synchronization-and-incremental-reparsing.requirement.md`).
 */
function createFakeConnection() {
  // deno-lint-ignore no-explicit-any
  const handlers: Record<string, (params: any) => unknown> = {};
  const sentDiagnostics: { uri: string; diagnostics: unknown[] }[] = [];

  const connection: UffdaLspConnection = {
    // deno-lint-ignore no-explicit-any
    onInitialize: (handler: (params: any) => unknown) => {
      handlers.initialize = handler;
    },
    // deno-lint-ignore no-explicit-any
    onDidOpenTextDocument: (handler: (params: any) => unknown) => {
      handlers.open = handler;
    },
    // deno-lint-ignore no-explicit-any
    onDidChangeTextDocument: (handler: (params: any) => unknown) => {
      handlers.change = handler;
    },
    // deno-lint-ignore no-explicit-any
    onDidCloseTextDocument: (handler: (params: any) => unknown) => {
      handlers.close = handler;
    },
    // deno-lint-ignore no-explicit-any
    onHover: (handler: (params: any) => unknown) => {
      handlers.hover = handler;
    },
    // deno-lint-ignore no-explicit-any
    onDefinition: (handler: (params: any) => unknown) => {
      handlers.definition = handler;
    },
    // deno-lint-ignore no-explicit-any
    onCompletion: (handler: (params: any) => unknown) => {
      handlers.completion = handler;
    },
    // deno-lint-ignore no-explicit-any
    onRequest: (type: any, handler: (params: any) => unknown) => {
      const method = typeof type === "string" ? type : type.method;
      handlers[method] = handler;
      return { dispose: () => {} };
    },
    // deno-lint-ignore no-explicit-any
    sendDiagnostics: (params: any) => {
      sentDiagnostics.push(
        params as { uri: string; diagnostics: unknown[] },
      );
    },
    listen: () => {},
    // deno-lint-ignore no-explicit-any
  } as any;

  return { connection, handlers, sentDiagnostics };
}

Deno.test("cli.lsp wireUffdaLspHandlers", async (t) => {
  await t.step(
    "publishes empty diagnostics for a valid .uff document",
    async () => {
      const { connection, handlers, sentDiagnostics } = createFakeConnection();
      wireUffdaLspHandlers(connection, { workspaceRoot: Deno.cwd() });

      await handlers.initialize({} as InitializeParams);
      await handlers.open({
        textDocument: {
          uri: "file:///workspace/main.uff",
          languageId: "uffda",
          version: 1,
          text: "export Main; rule Main = any;",
        },
      } as DidOpenTextDocumentParams);

      assertEquals(sentDiagnostics.length, 1);
      assertEquals(sentDiagnostics[0].uri, "file:///workspace/main.uff");
      assertEquals(sentDiagnostics[0].diagnostics, []);
    },
  );

  await t.step(
    "publishes a diagnostic for an invalid .uff document",
    async () => {
      const { connection, handlers, sentDiagnostics } = createFakeConnection();
      wireUffdaLspHandlers(connection, { workspaceRoot: Deno.cwd() });

      await handlers.initialize({} as InitializeParams);
      await handlers.open({
        textDocument: {
          uri: "file:///workspace/broken.uff",
          languageId: "uffda",
          version: 1,
          text: "rule Main = ",
        },
      } as DidOpenTextDocumentParams);

      assertEquals(sentDiagnostics.length, 1);
      assertEquals(
        (sentDiagnostics[0].diagnostics as unknown[]).length,
        1,
      );
    },
  );

  await t.step("ignores documents for unrecognized extensions", async () => {
    const { connection, handlers, sentDiagnostics } = createFakeConnection();
    wireUffdaLspHandlers(connection, { workspaceRoot: Deno.cwd() });

    await handlers.initialize({} as InitializeParams);
    await handlers.open({
      textDocument: {
        uri: "file:///workspace/notes.txt",
        languageId: "plaintext",
        version: 1,
        text: "hello",
      },
    } as DidOpenTextDocumentParams);

    assertEquals(sentDiagnostics.length, 0);
  });

  await t.step(
    "republishes diagnostics on didChange and clears them on didClose",
    async () => {
      const { connection, handlers, sentDiagnostics } = createFakeConnection();
      wireUffdaLspHandlers(connection, { workspaceRoot: Deno.cwd() });

      await handlers.initialize({} as InitializeParams);
      await handlers.open({
        textDocument: {
          uri: "file:///workspace/edit.uff",
          languageId: "uffda",
          version: 1,
          text: "export Main; rule Main = any;",
        },
      } as DidOpenTextDocumentParams);

      await handlers.change({
        textDocument: { uri: "file:///workspace/edit.uff", version: 2 },
        contentChanges: [{ text: "export Main; rule Main = " }],
      } as DidChangeTextDocumentParams);

      assertEquals(sentDiagnostics.length, 2);
      assertEquals(
        (sentDiagnostics[1].diagnostics as unknown[]).length,
        1,
      );

      handlers.close({
        textDocument: { uri: "file:///workspace/edit.uff" },
      } as DidCloseTextDocumentParams);

      assertEquals(sentDiagnostics.length, 3);
      assertEquals(sentDiagnostics[2].diagnostics, []);
    },
  );

  await t.step(
    "declares a semanticTokensProvider and returns tokens for an open .uff document",
    async () => {
      const { connection, handlers } = createFakeConnection();
      wireUffdaLspHandlers(connection, { workspaceRoot: Deno.cwd() });

      const init = await handlers.initialize(
        {} as InitializeParams,
      ) as InitializeResult;
      assertEquals(
        init.capabilities.semanticTokensProvider,
        { legend: SEMANTIC_TOKENS_LEGEND, full: true },
      );

      await handlers.open({
        textDocument: {
          uri: "file:///workspace/tokens.uff",
          languageId: "uffda",
          version: 1,
          text: "export Main; rule Main = any;",
        },
      } as DidOpenTextDocumentParams);

      const tokens = await handlers[SemanticTokensRequest.method]({
        textDocument: { uri: "file:///workspace/tokens.uff" },
      } as SemanticTokensParams) as { data: number[] };

      // At least one keyword token should be present (`export` / `rule`).
      assertEquals(tokens.data.length > 0, true);
      assertEquals(tokens.data.length % 5, 0);
    },
  );

  await t.step(
    "still returns semantic tokens for a document with a parse error",
    async () => {
      const { connection, handlers } = createFakeConnection();
      wireUffdaLspHandlers(connection, { workspaceRoot: Deno.cwd() });

      await handlers.initialize({} as InitializeParams);
      await handlers.open({
        textDocument: {
          uri: "file:///workspace/partial.uff",
          languageId: "uffda",
          version: 1,
          text: "export Main; rule Main = ",
        },
      } as DidOpenTextDocumentParams);

      const tokens = await handlers[SemanticTokensRequest.method]({
        textDocument: { uri: "file:///workspace/partial.uff" },
      } as SemanticTokensParams) as { data: number[] };

      // The successfully matched prefix (`export`/`rule`/...) must still
      // contribute tokens rather than blanking the whole document.
      assertEquals(tokens.data.length > 0, true);
    },
  );

  await t.step(
    "declares hoverProvider and describes a rule under the cursor",
    async () => {
      const { connection, handlers } = createFakeConnection();
      wireUffdaLspHandlers(connection, { workspaceRoot: Deno.cwd() });

      const init = await handlers.initialize(
        {} as InitializeParams,
      ) as InitializeResult;
      assertEquals(init.capabilities.hoverProvider, true);

      const text = "export Main; rule Main = any;";
      await handlers.open({
        textDocument: {
          uri: "file:///workspace/hover.uff",
          languageId: "uffda",
          version: 1,
          text,
        },
      } as DidOpenTextDocumentParams);

      const hover = await handlers.hover({
        textDocument: { uri: "file:///workspace/hover.uff" },
        position: { line: 0, character: text.indexOf("Main") + 1 },
      }) as { contents: { kind: string; value: string } } | null;

      assert(hover);
      assertEquals(hover.contents.kind, "markdown");
      assertEquals(
        hover.contents.value.includes("(exported rule) `Main`"),
        true,
      );
    },
  );

  await t.step(
    "declares definitionProvider and jumps to a same-file rule declaration",
    async () => {
      const { connection, handlers } = createFakeConnection();
      const cwd = await Deno.makeTempDir({ prefix: "uffda-lsp-def-wire-" });
      try {
        const path = join(cwd, "main.uff");
        const text = "export Main;\nrule Main = any;";
        await Deno.writeTextFile(path, text);
        const uri = toFileUrl(path).href;

        wireUffdaLspHandlers(connection, { workspaceRoot: cwd });
        const init = await handlers.initialize(
          {} as InitializeParams,
        ) as InitializeResult;
        assertEquals(init.capabilities.definitionProvider, true);

        await handlers.open({
          textDocument: {
            uri,
            languageId: "uffda",
            version: 1,
            text,
          },
        } as DidOpenTextDocumentParams);

        const locations = await handlers.definition({
          textDocument: { uri },
          position: { line: 0, character: text.indexOf("Main") + 1 },
        }) as Array<{ uri: string; range: unknown }>;

        assertEquals(locations.length, 1);
        assertEquals(locations[0].uri, uri);
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "declares completionProvider and offers in-scope declaration names",
    async () => {
      const { connection, handlers } = createFakeConnection();
      wireUffdaLspHandlers(connection, { workspaceRoot: Deno.cwd() });

      const init = await handlers.initialize(
        {} as InitializeParams,
      ) as InitializeResult;
      assertEquals(init.capabilities.completionProvider, {
        resolveProvider: false,
      });

      await handlers.open({
        textDocument: {
          uri: "file:///workspace/completion.uff",
          languageId: "uffda",
          version: 1,
          text: "export Main; rule Main = any;",
        },
      } as DidOpenTextDocumentParams);

      const items = await handlers.completion({
        textDocument: { uri: "file:///workspace/completion.uff" },
        position: { line: 0, character: 0 },
      }) as Array<{ label: string }>;
      assertEquals(items.map((item) => item.label), ["Main"]);
    },
  );

  await t.step(
    "advertises and serves uffda/languageMetadata from [Language] decorators",
    async () => {
      const { connection, handlers } = createFakeConnection();
      wireUffdaLspHandlers(connection, { workspaceRoot: Deno.cwd() });

      const init = await handlers.initialize(
        {} as InitializeParams,
      ) as InitializeResult;
      assertEquals(init.capabilities.experimental, {
        uffdaLanguageMetadata: true,
      });

      const result = await handlers[LANGUAGE_METADATA_METHOD]({
        languageId: "uffda",
      }) as {
        languages: Array<{
          id: string;
          configuration: { comments?: { lineComment?: string } };
        }>;
      };
      assertEquals(result.languages.length, 1);
      assertEquals(result.languages[0].id, "uffda");
      assertEquals(result.languages[0].configuration.comments, {
        lineComment: "#",
      });
    },
  );
});
