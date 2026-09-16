import process from "node:process";
import { fromFileUrl } from "@std/path";
import {
  type Connection,
  createConnection,
  type DidChangeTextDocumentParams,
  type DidCloseTextDocumentParams,
  type DidOpenTextDocumentParams,
  type InitializeParams,
  type InitializeResult,
  type SemanticTokensParams,
  SemanticTokensRequest,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import {
  LANGUAGE_METADATA_METHOD,
  languageMetadataForConfig,
  type LanguageMetadataParams,
} from "./language_metadata.ts";
import {
  BUILTIN_UFF_LANGUAGE,
  loadLspConfig,
  type LspConfig,
  resolveLanguageForDocument,
} from "./lsp.config.ts";
import { LspDocumentManager } from "./lsp.documents.ts";
import { SEMANTIC_TOKENS_LEGEND } from "./semantic_tokens.ts";

/**
 * The subset of `vscode-languageserver`'s `Connection` this module drives.
 * Kept narrow (rather than depending on the full SDK `Connection` type
 * directly in the handler-wiring function) so tests can exercise
 * `wireUffdaLspHandlers` against a lightweight fake instead of a real
 * stdio-backed connection (see `lsp.test.ts`).
 */
export type UffdaLspConnection = Pick<
  Connection,
  | "onInitialize"
  | "onDidOpenTextDocument"
  | "onDidChangeTextDocument"
  | "onDidCloseTextDocument"
  | "onRequest"
  | "sendDiagnostics"
  | "listen"
>;

function rootFromInitializeParams(
  params: InitializeParams,
): string | undefined {
  const folderUri = params.workspaceFolders?.[0]?.uri;
  const uri = folderUri ?? params.rootUri ?? undefined;
  if (!uri) return params.rootPath ?? undefined;
  try {
    return fromFileUrl(uri);
  } catch {
    return undefined;
  }
}

/**
 * Attaches the uffda language server's `initialize`/document-sync handlers
 * to `connection`, per
 * `.agents/specifications/languages/cli/language-server.spec.md`. Only the
 * built-in `.uff` language is wired end-to-end in this first phase (see
 * `.agents/requirements/cli-language-server/002-language-configuration.requirement.md`'s
 * "uff-only" v1 dogfooding scope) — documents resolving to any other
 * configured language are currently accepted (so a future phase can extend
 * them) but produce no diagnostics or semantic tokens.
 */
export function wireUffdaLspHandlers(
  connection: UffdaLspConnection,
  options?: { workspaceRoot?: string },
): void {
  let manager: LspDocumentManager | undefined;
  let config: LspConfig = { languages: [BUILTIN_UFF_LANGUAGE] };
  let workspaceRoot = options?.workspaceRoot ?? Deno.cwd();

  connection.onInitialize(
    async (params: InitializeParams): Promise<InitializeResult> => {
      workspaceRoot = options?.workspaceRoot ??
        rootFromInitializeParams(params) ?? Deno.cwd();
      const loaded = await loadLspConfig(workspaceRoot);
      config = loaded.ok
        ? loaded.config
        : { languages: [BUILTIN_UFF_LANGUAGE] };
      manager = new LspDocumentManager(workspaceRoot);
      return {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          semanticTokensProvider: {
            legend: SEMANTIC_TOKENS_LEGEND,
            full: true,
          },
          // Advertises the custom `uffda/languageMetadata` request so
          // clients (the VS Code extension) can derive editor language
          // configuration from grammar `[Language]` metadata (#192).
          experimental: {
            uffdaLanguageMetadata: true,
          },
        },
      };
    },
  );

  connection.onDidOpenTextDocument(
    async (params: DidOpenTextDocumentParams) => {
      const { uri, text } = params.textDocument;
      const language = resolveLanguageForDocument(config, uri);
      if (!manager || !language || language.id !== BUILTIN_UFF_LANGUAGE.id) {
        return;
      }
      const diagnostics = await manager.open(uri, text);
      connection.sendDiagnostics({ uri, diagnostics });
    },
  );

  connection.onDidChangeTextDocument(
    async (params: DidChangeTextDocumentParams) => {
      const { uri } = params.textDocument;
      const language = resolveLanguageForDocument(config, uri);
      if (!manager || !language || language.id !== BUILTIN_UFF_LANGUAGE.id) {
        return;
      }
      const diagnostics = await manager.change(uri, params.contentChanges);
      connection.sendDiagnostics({ uri, diagnostics });
    },
  );

  connection.onDidCloseTextDocument((params: DidCloseTextDocumentParams) => {
    const { uri } = params.textDocument;
    manager?.close(uri);
    connection.sendDiagnostics({ uri, diagnostics: [] });
  });

  connection.onRequest(
    SemanticTokensRequest.type,
    (params: SemanticTokensParams) => {
      const { uri } = params.textDocument;
      const language = resolveLanguageForDocument(config, uri);
      if (!manager || !language || language.id !== BUILTIN_UFF_LANGUAGE.id) {
        return { data: [] };
      }
      return manager.semanticTokens(uri) ?? { data: [] };
    },
  );

  connection.onRequest(
    LANGUAGE_METADATA_METHOD,
    (params: LanguageMetadataParams = {}) =>
      languageMetadataForConfig(config, workspaceRoot, params),
  );
}

/**
 * Connects the uffda language server to the standard stdio transport and
 * runs until that transport closes. Per
 * `.agents/specifications/languages/cli/language-server.spec.md#server-mode-and-invocation`,
 * standard input/output MUST carry only LSP protocol traffic once this is
 * running, and stdio is the only supported transport (no TCP/IPC).
 */
export function runLspServer(): Promise<void> {
  const connection = createConnection(process.stdin, process.stdout);
  wireUffdaLspHandlers(connection);
  const closed = new Promise<void>((resolve) => {
    connection.onExit(resolve);
  });
  connection.listen();
  return closed;
}
