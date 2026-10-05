import process from "node:process";
import { fromFileUrl } from "@std/path";
import {
  type CompletionParams,
  type Connection,
  createConnection,
  type DefinitionParams,
  type DidChangeTextDocumentParams,
  type DidCloseTextDocumentParams,
  type DidOpenTextDocumentParams,
  type DocumentFormattingParams,
  type HoverParams,
  type InitializeParams,
  type InitializeResult,
  LSPErrorCodes,
  type PrepareRenameParams,
  type ReferenceParams,
  type RenameParams,
  ResponseError,
  type SemanticTokensParams,
  SemanticTokensRequest,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import {
  LANGUAGE_METADATA_METHOD,
  languageMetadataFor,
  type LanguageMetadataParams,
} from "./language_metadata.ts";
import {
  isBuiltinLanguage,
  languageForDocument,
  loadProjectLanguages,
  type ProjectLanguage,
} from "./project_languages.ts";
import { LspDocumentManager } from "./lsp.documents.ts";
import { projectPackages } from "./command_project.ts";
import type { Range } from "vscode-languageserver-types";
import { SEMANTIC_TOKENS_LEGEND } from "./semantic_tokens.ts";

/** The custom request that toggles comments on the lines a range touches. */
export const TOGGLE_COMMENT_METHOD = "uffda/toggleComment";

export type ToggleCommentParams = {
  textDocument: { uri: string };
  range: Range;
};

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
  | "onHover"
  | "onDefinition"
  | "onCompletion"
  | "onReferences"
  | "onPrepareRename"
  | "onRenameRequest"
  | "onDocumentFormatting"
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
  options?: {
    workspaceRoot?: string;
    /** Reports configuration problems; standard error by default. */
    log?: (message: string) => void;
  },
): void {
  const log = options?.log ?? ((message: string) => console.error(message));
  let manager: LspDocumentManager | undefined;
  let languages: ProjectLanguage[] = [];
  let workspaceRoot = options?.workspaceRoot ?? Deno.cwd();

  connection.onInitialize(
    async (params: InitializeParams): Promise<InitializeResult> => {
      workspaceRoot = options?.workspaceRoot ??
        rootFromInitializeParams(params) ?? Deno.cwd();
      const loaded = await loadProjectLanguages(workspaceRoot);
      languages = loaded.languages;
      for (const problem of loaded.problems) log(problem);
      const project = loaded.project;
      const packages = await projectPackages(project);
      if (!packages.ok) log(packages.message);
      manager = new LspDocumentManager(
        workspaceRoot,
        project?.imports,
        project && { root: project.root, outDir: project.outDir },
        packages.ok ? packages.packages : undefined,
      );
      return {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          hoverProvider: true,
          definitionProvider: true,
          referencesProvider: true,
          renameProvider: { prepareProvider: true },
          documentFormattingProvider: true,
          completionProvider: {
            resolveProvider: false,
            triggerCharacters: ['"', "/"],
          },
          semanticTokensProvider: {
            legend: SEMANTIC_TOKENS_LEGEND,
            full: true,
          },
          // Advertises the custom `uffda/languageMetadata` request so
          // clients (the VS Code extension) can derive editor language
          // configuration from grammar `[Language]` metadata (#192), and the
          // custom `uffda/toggleComment` request behind its Ctrl+/ command.
          experimental: {
            uffdaLanguageMetadata: true,
            uffdaToggleComment: true,
          },
        },
      };
    },
  );

  connection.onDidOpenTextDocument(
    async (params: DidOpenTextDocumentParams) => {
      const { uri, text } = params.textDocument;
      const language = languageForDocument(languages, uri);
      if (!manager || !language || !isBuiltinLanguage(language)) {
        return;
      }
      const diagnostics = await manager.open(uri, text);
      connection.sendDiagnostics({ uri, diagnostics });
    },
  );

  connection.onDidChangeTextDocument(
    async (params: DidChangeTextDocumentParams) => {
      const { uri } = params.textDocument;
      const language = languageForDocument(languages, uri);
      if (!manager || !language || !isBuiltinLanguage(language)) {
        return;
      }
      const diagnostics = await manager.change(uri, params.contentChanges);
      connection.sendDiagnostics({ uri, diagnostics });
    },
  );

  connection.onDidCloseTextDocument(
    async (params: DidCloseTextDocumentParams) => {
      const { uri } = params.textDocument;
      await manager?.close(uri);
      connection.sendDiagnostics({ uri, diagnostics: [] });
    },
  );

  connection.onHover(async (params: HoverParams) => {
    const { uri } = params.textDocument;
    const language = languageForDocument(languages, uri);
    if (!manager || !language || !isBuiltinLanguage(language)) {
      return null;
    }
    return await manager.hover(uri, params.position);
  });

  connection.onDefinition(async (params: DefinitionParams) => {
    const { uri } = params.textDocument;
    const language = languageForDocument(languages, uri);
    if (!manager || !language || !isBuiltinLanguage(language)) {
      return [];
    }
    return await manager.definition(uri, params.position);
  });

  connection.onCompletion(async (params: CompletionParams) => {
    const { uri } = params.textDocument;
    const language = languageForDocument(languages, uri);
    if (!manager || !language || !isBuiltinLanguage(language)) {
      return [];
    }
    return await manager.completion(uri, params.position);
  });

  connection.onReferences(async (params: ReferenceParams) => {
    const { uri } = params.textDocument;
    const language = languageForDocument(languages, uri);
    if (!manager || !language || !isBuiltinLanguage(language)) {
      return [];
    }
    return await manager.references(
      uri,
      params.position,
      params.context.includeDeclaration,
    );
  });

  connection.onPrepareRename(async (params: PrepareRenameParams) => {
    const { uri } = params.textDocument;
    const language = languageForDocument(languages, uri);
    if (!manager || !language || !isBuiltinLanguage(language)) {
      return null;
    }
    const prepared = await manager.prepareRename(uri, params.position);
    if (prepared && "refusal" in prepared) {
      throw new ResponseError(LSPErrorCodes.RequestFailed, prepared.refusal);
    }
    return prepared;
  });

  connection.onRenameRequest(async (params: RenameParams) => {
    const { uri } = params.textDocument;
    const language = languageForDocument(languages, uri);
    if (!manager || !language || !isBuiltinLanguage(language)) {
      return null;
    }
    const plan = await manager.rename(uri, params.position, params.newName);
    if (!plan.ok) {
      throw new ResponseError(LSPErrorCodes.RequestFailed, plan.message);
    }
    return plan.edit;
  });

  connection.onDocumentFormatting(async (params: DocumentFormattingParams) => {
    const { uri } = params.textDocument;
    const language = languageForDocument(languages, uri);
    if (!manager || !language || !isBuiltinLanguage(language)) {
      return [];
    }
    return (await manager.format(uri)) ?? [];
  });

  connection.onRequest(
    SemanticTokensRequest.type,
    async (params: SemanticTokensParams) => {
      const { uri } = params.textDocument;
      const language = languageForDocument(languages, uri);
      if (!manager || !language || !isBuiltinLanguage(language)) {
        return { data: [] };
      }
      return (await manager.semanticTokens(uri)) ?? { data: [] };
    },
  );

  connection.onRequest(
    TOGGLE_COMMENT_METHOD,
    async (params: ToggleCommentParams) => {
      const { uri } = params.textDocument;
      const language = languageForDocument(languages, uri);
      if (!manager || !language || !isBuiltinLanguage(language)) {
        return [];
      }
      return (await manager.toggleComment(uri, params.range)) ?? [];
    },
  );

  connection.onRequest(
    LANGUAGE_METADATA_METHOD,
    (params: LanguageMetadataParams = {}) =>
      languageMetadataFor(languages, params),
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
