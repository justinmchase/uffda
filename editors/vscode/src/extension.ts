import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { resolveUffdaServer, ResolveServerError, ResolvedServer } from "./binary";

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

  const serverOptions: ServerOptions = {
    command: resolved.command,
    args: resolved.args,
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
  } catch (err) {
    reportStartError("language server", resolved, err);
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
