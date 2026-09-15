import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { resolveUffdaServer, ResolveServerError, ResolvedServer } from "./binary";

/** Mirrors `LANGUAGE_METADATA_METHOD` in `src/cli/language_metadata.ts`. */
const LANGUAGE_METADATA_METHOD = "uffda/languageMetadata";

type EditorLanguageConfiguration = {
  comments?: { lineComment?: string };
  brackets?: [string, string][];
  autoClosingPairs?: Array<{ open: string; close: string }>;
  surroundingPairs?: [string, string][];
};

type LanguageMetadataResult = {
  languages: Array<{
    id: string;
    configuration: EditorLanguageConfiguration;
  }>;
};

let client: LanguageClient | undefined;
let outputChannel: vscode.LogOutputChannel | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel("Uffda", { log: true });
  context.subscriptions.push(outputChannel);

  await startLanguageClient(context);
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
    transport: TransportKind.stdio,
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "uffda" }],
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
    await applyLanguageConfigurationsFromServer(context, client);
  } catch (err) {
    reportStartError("language server", resolved, err);
  }
}

/**
 * Queries `uffda/languageMetadata` and applies each language's projected
 * editor configuration via `vscode.languages.setLanguageConfiguration()`,
 * per issue #192 / requirement 007's design note. The static
 * `language-configuration.json` contribution remains as a fallback when the
 * server is older or the request fails.
 */
async function applyLanguageConfigurationsFromServer(
  context: vscode.ExtensionContext,
  languageClient: LanguageClient,
): Promise<void> {
  try {
    const result = await languageClient.sendRequest<LanguageMetadataResult>(
      LANGUAGE_METADATA_METHOD,
      { languageId: "uffda" },
    );
    for (const entry of result.languages) {
      const disposable = vscode.languages.setLanguageConfiguration(
        entry.id,
        entry.configuration as vscode.LanguageConfiguration,
      );
      context.subscriptions.push(disposable);
      outputChannel?.appendLine(
        `Applied [Language] configuration for '${entry.id}' (comments=${
          entry.configuration.comments?.lineComment ?? "none"
        }, brackets=${entry.configuration.brackets?.length ?? 0})`,
      );
    }
    if (result.languages.length === 0) {
      outputChannel?.appendLine(
        "No [Language] metadata returned; keeping static language-configuration.json.",
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel?.appendLine(
      `Dynamic language configuration unavailable (${message}); keeping static language-configuration.json.`,
    );
  }
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
        // `./mod.ts` overrides rely on the host resolving against the
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
