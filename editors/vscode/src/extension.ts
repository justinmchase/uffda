import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TextEdit as ProtocolTextEdit,
} from "vscode-languageclient/node";
import { resolveUffdaServer, ResolveServerError, ResolvedServer } from "./binary";

/** Mirrors `LANGUAGE_METADATA_METHOD` in `src/cli/language_metadata.ts`. */
const LANGUAGE_METADATA_METHOD = "uffda/languageMetadata";

/** Mirrors `TOGGLE_COMMENT_METHOD` in `src/cli/lsp.ts`. */
const TOGGLE_COMMENT_METHOD = "uffda/toggleComment";

type LanguageMetadataResult = {
  languages: Array<{
    id: string;
    metadata: { ext?: string; name?: string };
  }>;
};

let client: LanguageClient | undefined;
let outputChannel: vscode.LogOutputChannel | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel("Uffda", { log: true });
  context.subscriptions.push(outputChannel);

  await startLanguageClient(context);
  registerToggleLineComment(context);
  registerMcpServerProvider(context);
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
    client = undefined;
  }
}

function currentOverrides() {
  const config = vscode.workspace.getConfiguration("uffda");
  const serverPathOverride = config.get<string>("lsp.serverPath")?.trim() || undefined;
  const lspArgsOverride = config.get<string[]>("lsp.serverArgs") ?? [];
  const mcpArgsOverride = config.get<string[]>("mcp.serverArgs") ?? [];
  return { serverPathOverride, lspArgsOverride, mcpArgsOverride };
}

function workspaceCwd(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function extensionOf(fsPath: string): string {
  const lastDot = fsPath.lastIndexOf(".");
  const lastSlash = Math.max(fsPath.lastIndexOf("/"), fsPath.lastIndexOf("\\"));
  if (lastDot === -1 || lastDot < lastSlash) return "";
  return fsPath.slice(lastDot + 1).toLowerCase();
}

function normalizeExt(ext: string): string {
  const trimmed = ext.trim().toLowerCase();
  return trimmed.startsWith(".") ? trimmed.slice(1) : trimmed;
}

async function startLanguageClient(context: vscode.ExtensionContext): Promise<void> {
  const { serverPathOverride, lspArgsOverride } = currentOverrides();

  let resolved: ResolvedServer;
  try {
    resolved = await resolveUffdaServer({
      serverPathOverride,
      serverArgsOverride: lspArgsOverride,
      defaultArgs: ["lsp"],
      storageDir: context.globalStorageUri.fsPath,
    });
  } catch (err) {
    reportResolveError("language server", err);
    return;
  }
  outputChannel?.appendLine(
    `Starting language server: ${resolved.command} ${resolved.args.join(" ")} (${resolved.source})`,
  );

  const cwd = workspaceCwd();
  const serverOptions: ServerOptions = {
    command: resolved.command,
    args: resolved.args,
    options: cwd ? { cwd } : undefined,
    // Omit `transport`: vscode-languageclient defaults to stdio for
    // Executable servers. Setting `TransportKind.stdio` would also append a
    // literal `--stdio` argv token, which uffda does not use.
  };
  const clientOptions: LanguageClientOptions = {
    // Scheme-only selector: the server filters by configured extensions, and
    // workspace languages may receive a dynamic language id via
    // `setTextDocumentLanguage` after `[Language].ext` discovery (#192).
    documentSelector: [{ scheme: "file" }],
    outputChannel,
  };

  client = new LanguageClient(
    "uffda",
    "Uffda Language Server",
    serverOptions,
    clientOptions,
  );

  try {
    await client.start();
    context.subscriptions.push({ dispose: () => void client?.stop() });
    await applyLanguageMetadataFromServer(context, client);
  } catch (err) {
    reportStartError("language server", resolved, err);
  }
}

/**
 * Queries `uffda/languageMetadata`, maps `[Language].ext` → language id, and
 * assigns language ids at runtime via `setTextDocumentLanguage` for
 * workspace-declared languages (#192).
 */
async function applyLanguageMetadataFromServer(
  context: vscode.ExtensionContext,
  languageClient: LanguageClient,
): Promise<void> {
  try {
    const result = await languageClient.sendRequest<LanguageMetadataResult>(
      LANGUAGE_METADATA_METHOD,
      {},
    );
    const extToLanguageId = new Map<string, string>();

    for (const entry of result.languages) {
      if (entry.metadata.ext) {
        extToLanguageId.set(normalizeExt(entry.metadata.ext), entry.id);
      }
    }

    if (extToLanguageId.size > 0) {
      registerDynamicLanguageIds(context, extToLanguageId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel?.appendLine(
      `Language metadata unavailable (${message}); workspace languages keep their default language ids.`,
    );
  }
}

/**
 * Assigns language ids to open/opening documents whose extension is declared
 * by a grammar's `[Language].ext` (or equivalent metadata), so workspace
 * languages do not need a static `contributes.languages` package.json entry.
 */
function registerDynamicLanguageIds(
  context: vscode.ExtensionContext,
  extToLanguageId: Map<string, string>,
): void {
  const assign = async (document: vscode.TextDocument): Promise<void> => {
    if (document.uri.scheme !== "file") return;
    const ext = extensionOf(document.uri.fsPath);
    const languageId = extToLanguageId.get(ext);
    if (!languageId || document.languageId === languageId) return;
    try {
      await vscode.languages.setTextDocumentLanguage(document, languageId);
      outputChannel?.appendLine(
        `Set language id '${languageId}' for ${document.uri.fsPath}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      outputChannel?.appendLine(
        `Failed to set language id '${languageId}' for ${document.uri.fsPath}: ${message}`,
      );
    }
  };

  for (const document of vscode.workspace.textDocuments) {
    void assign(document);
  }
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      void assign(document);
    }),
  );
}

/**
 * Ctrl+/ (Cmd+/ on Mac) in Uffda documents: asks `uffda lsp` to toggle
 * comments on the lines each selection touches, through the rule the
 * language names with `[ToggleComment]`, and applies the returned edits.
 * Selections on the same or adjacent lines are toggled together, so no two
 * requests cover the same line.
 */
function registerToggleLineComment(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "uffda.toggleLineComment",
      async (editor) => {
        if (!client) return;
        const languageClient = client;
        const document = editor.document;
        const uri = languageClient.code2ProtocolConverter.asUri(document.uri);
        const edits: vscode.TextEdit[] = [];
        for (const range of lineRanges(document, editor.selections)) {
          const result = await languageClient.sendRequest<ProtocolTextEdit[]>(
            TOGGLE_COMMENT_METHOD,
            {
              textDocument: { uri },
              range: languageClient.code2ProtocolConverter.asRange(range),
            },
          );
          edits.push(
            ...await languageClient.protocol2CodeConverter.asTextEdits(result) ??
              [],
          );
        }
        if (edits.length === 0) return;
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(document.uri, edits);
        await vscode.workspace.applyEdit(workspaceEdit);
      },
    ),
  );
}

/**
 * The line spans the selections touch, merged when they share or adjoin a
 * line. A selection ending at the start of a later line leaves that line
 * out, as the server does.
 */
function lineRanges(
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
): vscode.Range[] {
  const spans = selections
    .map((selection) => {
      const first = selection.start.line;
      const last = selection.end.character === 0 && selection.end.line > first
        ? selection.end.line - 1
        : selection.end.line;
      return [first, last] as const;
    })
    .sort(([a], [b]) => a - b);
  const merged: Array<[number, number]> = [];
  for (const [first, last] of spans) {
    const previous = merged.at(-1);
    if (previous && first <= previous[1] + 1) {
      previous[1] = Math.max(previous[1], last);
    } else {
      merged.push([first, last]);
    }
  }
  return merged.map(([first, last]) =>
    new vscode.Range(first, 0, last, document.lineAt(last).range.end.character)
  );
}

function registerMcpServerProvider(context: vscode.ExtensionContext): void {
  // vscode.lm.registerMcpServerDefinitionProvider is available on VS Code
  // versions that support MCP server contributions (see engines.vscode in
  // package.json). Guard defensively so older hosts degrade gracefully
  // instead of throwing on activation.
  const lm = vscode.lm as unknown as {
    registerMcpServerDefinitionProvider?: (
      id: string,
      provider: {
        onDidChangeMcpServerDefinitions?: vscode.Event<void>;
        provideMcpServerDefinitions(): Promise<unknown[]>;
      },
    ) => vscode.Disposable;
  };
  if (!lm.registerMcpServerDefinitionProvider) {
    outputChannel?.appendLine(
      "This VS Code version does not support MCP server definition providers; skipping MCP registration.",
    );
    return;
  }

  const McpStdioServerDefinition = (
    vscode as unknown as {
      McpStdioServerDefinition: new (
        label: string,
        command: string,
        args: string[],
      ) => unknown;
    }
  ).McpStdioServerDefinition;

  const disposable = lm.registerMcpServerDefinitionProvider("uffda", {
    provideMcpServerDefinitions: async () => {
      const { serverPathOverride, mcpArgsOverride } = currentOverrides();
      try {
        const resolved = await resolveUffdaServer({
          serverPathOverride,
          serverArgsOverride: mcpArgsOverride,
          defaultArgs: ["mcp"],
          storageDir: context.globalStorageUri.fsPath,
        });
        outputChannel?.appendLine(
          `Registering MCP server: ${resolved.command} ${resolved.args.join(" ")} (${resolved.source})`,
        );
        // McpStdioServerDefinition takes command/args only; relative
        // `./src/cli/main.ts` overrides rely on the host resolving against the
        // workspace folder the same way the language client cwd does.
        return [new McpStdioServerDefinition("Uffda", resolved.command, resolved.args)];
      } catch (err) {
        reportResolveError("MCP server", err);
        return [];
      }
    },
  });
  context.subscriptions.push(disposable);
}

function reportResolveError(what: string, err: unknown): void {
  const message = err instanceof ResolveServerError || err instanceof Error
    ? err.message
    : String(err);
  outputChannel?.appendLine(`Failed to resolve uffda for the ${what}: ${message}`);
  void vscode.window.showErrorMessage(
    `Uffda: could not resolve a uffda binary for the ${what}. ${message}`,
  );
}

function reportStartError(what: string, resolved: ResolvedServer, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  outputChannel?.appendLine(
    `Failed to start ${what} (${resolved.command} ${resolved.args.join(" ")}): ${message}`,
  );
  void vscode.window.showErrorMessage(
    `Uffda: the ${what} failed to start (${resolved.command}). ${message}`,
  );
}
