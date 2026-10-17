import process from "node:process";
import { fromFileUrl } from "@std/path";
import {
  type CompletionParams,
  type Connection,
  createProtocolConnection,
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
import { createConnection, type WatchDog } from "vscode-languageserver/server";
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

function pathFromFileUri(uri: string): string | undefined {
  try {
    return fromFileUrl(uri);
  } catch {
    return undefined;
  }
}

function rootFromInitializeParams(
  params: InitializeParams,
): string | undefined {
  const folderUri = params.workspaceFolders?.[0]?.uri;
  const uri = folderUri ?? params.rootUri ?? undefined;
  if (!uri) return params.rootPath ?? undefined;
  return pathFromFileUri(uri);
}

/**
 * Every workspace folder the client advertised, or a single root from
 * `rootUri` / `rootPath` / cwd when folders are absent.
 */
export function workspaceRootsFromInitialize(
  params: InitializeParams,
  override?: string,
): string[] {
  if (override) return [override];
  const roots: string[] = [];
  for (const folder of params.workspaceFolders ?? []) {
    const path = pathFromFileUri(folder.uri);
    if (path) roots.push(path);
  }
  if (roots.length > 0) return roots;
  return [rootFromInitializeParams(params) ?? Deno.cwd()];
}

/**
 * The workspace folder that owns `documentUri`: longest path prefix among
 * `roots`. Falls back to the first root when none contain the document.
 */
export function workspaceRootForDocument(
  documentUri: string,
  roots: readonly string[],
): string {
  if (roots.length === 0) return Deno.cwd();
  const path = pathFromFileUri(documentUri);
  if (!path) return roots[0]!;
  let best: string | undefined;
  for (const root of roots) {
    if (path === root || path.startsWith(`${root}/`)) {
      if (!best || root.length > best.length) best = root;
    }
  }
  return best ?? roots[0]!;
}

type WorkspaceFolderState = {
  root: string;
  languages: ProjectLanguage[];
  manager: LspDocumentManager;
};

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
  const folders = new Map<string, WorkspaceFolderState>();
  let folderOrder: string[] = [];
  let mergedLanguages: ProjectLanguage[] = [];

  const folderFor = (uri: string): WorkspaceFolderState | undefined => {
    if (folderOrder.length === 0) return undefined;
    const root = workspaceRootForDocument(uri, folderOrder);
    return folders.get(root);
  };

  connection.onInitialize(
    async (params: InitializeParams): Promise<InitializeResult> => {
      folders.clear();
      folderOrder = workspaceRootsFromInitialize(
        params,
        options?.workspaceRoot,
      );
      mergedLanguages = [];
      const seenLanguageIds = new Set<string>();
      for (const root of folderOrder) {
        const loaded = await loadProjectLanguages(root);
        for (const problem of loaded.problems) log(problem);
        const project = loaded.project;
        const packages = await projectPackages(project);
        if (!packages.ok) log(packages.message);
        folders.set(root, {
          root,
          languages: loaded.languages,
          manager: new LspDocumentManager(
            root,
            project?.imports,
            project && { root: project.root, outDir: project.outDir },
            packages.ok ? packages.packages : undefined,
          ),
        });
        for (const language of loaded.languages) {
          if (seenLanguageIds.has(language.id)) continue;
          seenLanguageIds.add(language.id);
          mergedLanguages.push(language);
        }
      }
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
      const folder = folderFor(uri);
      const language = languageForDocument(folder?.languages ?? [], uri);
      if (!folder || !language || !isBuiltinLanguage(language)) {
        return;
      }
      const diagnostics = await folder.manager.open(uri, text);
      connection.sendDiagnostics({ uri, diagnostics });
    },
  );

  connection.onDidChangeTextDocument(
    async (params: DidChangeTextDocumentParams) => {
      const { uri } = params.textDocument;
      const folder = folderFor(uri);
      const language = languageForDocument(folder?.languages ?? [], uri);
      if (!folder || !language || !isBuiltinLanguage(language)) {
        return;
      }
      const diagnostics = await folder.manager.change(
        uri,
        params.contentChanges,
      );
      connection.sendDiagnostics({ uri, diagnostics });
    },
  );

  connection.onDidCloseTextDocument(
    async (params: DidCloseTextDocumentParams) => {
      const { uri } = params.textDocument;
      await folderFor(uri)?.manager.close(uri);
      connection.sendDiagnostics({ uri, diagnostics: [] });
    },
  );

  connection.onHover(async (params: HoverParams) => {
    const { uri } = params.textDocument;
    const folder = folderFor(uri);
    const language = languageForDocument(folder?.languages ?? [], uri);
    if (!folder || !language || !isBuiltinLanguage(language)) {
      return null;
    }
    return await folder.manager.hover(uri, params.position);
  });

  connection.onDefinition(async (params: DefinitionParams) => {
    const { uri } = params.textDocument;
    const folder = folderFor(uri);
    const language = languageForDocument(folder?.languages ?? [], uri);
    if (!folder || !language || !isBuiltinLanguage(language)) {
      return [];
    }
    return await folder.manager.definition(uri, params.position);
  });

  connection.onCompletion(async (params: CompletionParams) => {
    const { uri } = params.textDocument;
    const folder = folderFor(uri);
    const language = languageForDocument(folder?.languages ?? [], uri);
    if (!folder || !language || !isBuiltinLanguage(language)) {
      return [];
    }
    return await folder.manager.completion(uri, params.position);
  });

  connection.onReferences(async (params: ReferenceParams) => {
    const { uri } = params.textDocument;
    const folder = folderFor(uri);
    const language = languageForDocument(folder?.languages ?? [], uri);
    if (!folder || !language || !isBuiltinLanguage(language)) {
      return [];
    }
    return await folder.manager.references(
      uri,
      params.position,
      params.context.includeDeclaration,
    );
  });

  connection.onPrepareRename(async (params: PrepareRenameParams) => {
    const { uri } = params.textDocument;
    const folder = folderFor(uri);
    const language = languageForDocument(folder?.languages ?? [], uri);
    if (!folder || !language || !isBuiltinLanguage(language)) {
      return null;
    }
    const prepared = await folder.manager.prepareRename(uri, params.position);
    if (prepared && "refusal" in prepared) {
      throw new ResponseError(LSPErrorCodes.RequestFailed, prepared.refusal);
    }
    return prepared;
  });

  connection.onRenameRequest(async (params: RenameParams) => {
    const { uri } = params.textDocument;
    const folder = folderFor(uri);
    const language = languageForDocument(folder?.languages ?? [], uri);
    if (!folder || !language || !isBuiltinLanguage(language)) {
      return null;
    }
    const plan = await folder.manager.rename(
      uri,
      params.position,
      params.newName,
    );
    if (!plan.ok) {
      throw new ResponseError(LSPErrorCodes.RequestFailed, plan.message);
    }
    return plan.edit;
  });

  connection.onDocumentFormatting(async (params: DocumentFormattingParams) => {
    const { uri } = params.textDocument;
    const folder = folderFor(uri);
    const language = languageForDocument(folder?.languages ?? [], uri);
    if (!folder || !language || !isBuiltinLanguage(language)) {
      return [];
    }
    return (await folder.manager.format(uri)) ?? [];
  });

  connection.onRequest(
    SemanticTokensRequest.type,
    async (params: SemanticTokensParams) => {
      const { uri } = params.textDocument;
      const folder = folderFor(uri);
      const language = languageForDocument(folder?.languages ?? [], uri);
      if (!folder || !language || !isBuiltinLanguage(language)) {
        return { data: [] };
      }
      return (await folder.manager.semanticTokens(uri)) ?? { data: [] };
    },
  );

  connection.onRequest(
    TOGGLE_COMMENT_METHOD,
    async (params: ToggleCommentParams) => {
      const { uri } = params.textDocument;
      const folder = folderFor(uri);
      const language = languageForDocument(folder?.languages ?? [], uri);
      if (!folder || !language || !isBuiltinLanguage(language)) {
        return [];
      }
      return (await folder.manager.toggleComment(uri, params.range)) ?? [];
    },
  );

  connection.onRequest(
    LANGUAGE_METADATA_METHOD,
    (params: LanguageMetadataParams = {}) =>
      languageMetadataFor(mergedLanguages, params),
  );
}

/**
 * Ties the language server's lifetime to its stdio connection (see
 * `language-server.spec.md#server-mode-and-invocation`): `exit` is called for
 * the client's `exit` notification and when standard input closes. The
 * client's `processId` is deliberately not polled, because checking whether
 * another process is alive needs permission to signal processes, which the
 * release binary is not granted.
 */
export function stdioWatchDog(exit: (code: number) => void): WatchDog {
  return {
    shutdownReceived: false,
    initialize() {},
    exit,
  };
}

/**
 * Connects the uffda language server to the standard stdio transport and
 * runs until that transport closes. Per
 * `.agents/specifications/languages/cli/language-server.spec.md#server-mode-and-invocation`,
 * standard input/output MUST carry only LSP protocol traffic once this is
 * running, and stdio is the only supported transport (no TCP/IPC).
 */
export function runLspServer(): Promise<void> {
  const watchDog = stdioWatchDog((code) => process.exit(code));
  const connection = createConnection(
    (logger) => createProtocolConnection(process.stdin, process.stdout, logger),
    watchDog,
  );
  const disconnected = () => watchDog.exit(watchDog.shutdownReceived ? 0 : 1);
  process.stdin.on("end", disconnected);
  process.stdin.on("close", disconnected);
  wireUffdaLspHandlers(connection);
  const closed = new Promise<void>((resolve) => {
    connection.onExit(resolve);
  });
  connection.listen();
  return closed;
}
