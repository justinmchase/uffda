import { assertEquals } from "@std/assert";
import type {
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  InitializeParams,
} from "vscode-languageserver/node";
import { type UffdaLspConnection, wireUffdaLspHandlers } from "./lsp.ts";

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
});
