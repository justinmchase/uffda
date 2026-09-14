import { dirname, fromFileUrl, join } from "@std/path";
import { version } from "../version.ts";
import { type DisplayNode, renderDisplayHtml } from "./display_transform.ts";

/**
 * Session display surface tool (see
 * `.agents/requirements/mcp-server/011-session-display-surface-tool.requirement.md`
 * and `mcp-server.spec.md#session-display-surface-tool`): an explicit,
 * session-scoped, human-observable native window, backed by a loopback-only
 * local HTTP+WebSocket endpoint this process serves. Opening a session never
 * creates one; a caller must explicitly open it.
 *
 * The native window itself is a generic, session-agnostic `deno desktop`
 * binary (`display_shell.ts`), compiled once and cached, then spawned as a
 * subprocess per surface and pointed (via an environment variable) at this
 * surface's own local endpoint — so the compiled shell never needs
 * recompiling per session, and all session-specific content lives entirely
 * in this (already-running) process, not in the spawned subprocess.
 */

/** Launches (or otherwise provides) the human-observable window for a
 * display surface at `url`, returning a handle to release it. Exists so
 * tests can substitute a no-op launcher instead of actually compiling and
 * spawning a native `deno desktop` process (which needs a real GUI/webview
 * stack unavailable in most CI environments). */
export type DisplaySurfaceLauncher = (
  url: string,
  title: string,
) => Promise<DisplaySurfaceHandle>;

export type DisplaySurfaceHandle = {
  close(): Promise<void>;
};

let cachedShellBinaryPath: Promise<string> | undefined;

/** Compiles the generic display-shell binary once per process (and once per
 * cache directory across process restarts, keyed by the running uffda
 * version), reusing it for every display surface. */
function getDisplayShellBinaryPath(): Promise<string> {
  if (cachedShellBinaryPath) return cachedShellBinaryPath;
  cachedShellBinaryPath = (async () => {
    const cacheRoot = Deno.env.get("XDG_CACHE_HOME") ??
      join(Deno.env.get("HOME") ?? ".", ".cache");
    const outDir = join(cacheRoot, "uffda", `display-shell-${version}`);
    const binaryPath = join(outDir, "display-shell", "display-shell");
    try {
      await Deno.stat(binaryPath);
      return binaryPath;
    } catch {
      // Not cached yet; fall through and compile.
    }
    await Deno.mkdir(outDir, { recursive: true });
    const sourcePath = fromFileUrl(
      new URL("./display_shell.ts", import.meta.url),
    );
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "desktop",
        "--allow-env=UFFDA_DISPLAY_URL,UFFDA_DISPLAY_TITLE",
        "-o",
        join(outDir, "display-shell"),
        sourcePath,
      ],
      cwd: dirname(sourcePath),
      stdout: "piped",
      stderr: "piped",
    });
    const { success, stderr } = await command.output();
    if (!success) {
      throw new Error(
        `Failed to compile the display shell: ${
          new TextDecoder().decode(stderr)
        }`,
      );
    }
    return binaryPath;
  })();
  return cachedShellBinaryPath;
}

/** Real launcher: compiles (if needed) and spawns the native `deno desktop`
 * window as a subprocess, pointed at `url`. */
export const defaultDisplaySurfaceLauncher: DisplaySurfaceLauncher = async (
  url,
  title,
) => {
  const binaryPath = await getDisplayShellBinaryPath();
  const command = new Deno.Command(binaryPath, {
    env: { UFFDA_DISPLAY_URL: url, UFFDA_DISPLAY_TITLE: title },
    stdout: "null",
    stderr: "null",
  });
  const child = command.spawn();
  return {
    close: async () => {
      try {
        child.kill();
      } catch {
        // Already exited.
      }
      await child.status.catch(() => {});
    },
  };
};

const PAGE_STYLE = `
body { background:#282c34; color:#e5e5e5; font-family:monospace;
  font-size:14px; line-height:1.5; padding:1em; white-space:pre-wrap; }
.hl-keyword { color:#c678dd; }
.hl-identifier { color:#e5e5e5; }
.hl-string { color:#98c379; }
.hl-comment { color:#5c6370; }
.hl-punctuation { color:#56b6c2; }
.match-ok { color:#98c379; }
.match-fail { color:#e06c75; }
.match-error { color:#e5c07b; }
.match-lr { color:#61afef; }
.node { border-left:1px solid #3a3f4b; margin-left:0.75em; padding-left:0.75em; }
.node-label { font-weight:bold; }
`;

function pageHtml(initialContent: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">` +
    `<style>${PAGE_STYLE}</style></head><body>` +
    `<div id="uffda-display-content">${initialContent}</div>` +
    `<script>
      const ws = new WebSocket("ws://" + location.host + "/ws");
      ws.onmessage = (e) => {
        document.getElementById("uffda-display-content").innerHTML = e.data;
      };
    </script></body></html>`;
}

/**
 * A single session's live display surface: a loopback-only HTTP+WebSocket
 * server (the actual content, always controlled by this process) plus a
 * spawned native window pointed at it (see module docs above).
 */
export class DisplaySurface {
  public readonly sessionId: string;
  private readonly launcher: DisplaySurfaceLauncher;
  private server?: Deno.HttpServer;
  private handle?: DisplaySurfaceHandle;
  private readonly sockets = new Set<WebSocket>();
  private currentHtml = "<em>Waiting for content…</em>";

  constructor(sessionId: string, launcher: DisplaySurfaceLauncher) {
    this.sessionId = sessionId;
    this.launcher = launcher;
  }

  /** The loopback URL this surface's content is served from. Only valid
   * after `open()` resolves. */
  public get url(): string {
    if (!this.server) {
      throw new Error("Display surface is not open");
    }
    const addr = this.server.addr as Deno.NetAddr;
    return `http://127.0.0.1:${addr.port}/`;
  }

  /**
   * Starts this surface's local content server bound to loopback only, then
   * launches its human-observable window pointed at that server. Resolves
   * once both are ready.
   */
  public async open(): Promise<void> {
    if (this.server) {
      throw new Error(
        `Display surface for '${this.sessionId}' is already open`,
      );
    }
    this.server = Deno.serve(
      { hostname: "127.0.0.1", port: 0, onListen: () => {} },
      (req) => this.handleRequest(req),
    );
    this.handle = await this.launcher(
      this.url,
      `uffda display — ${this.sessionId}`,
    );
  }

  private handleRequest(req: Request): Response {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const { socket, response } = Deno.upgradeWebSocket(req);
      socket.onopen = () => socket.send(this.currentHtml);
      socket.onclose = () => this.sockets.delete(socket);
      this.sockets.add(socket);
      return response;
    }
    return new Response(pageHtml(this.currentHtml), {
      headers: { "content-type": "text/html" },
    });
  }

  /**
   * Renders `nodes` into this surface, updating its already-open window in
   * place (never opening a new window). Deterministic for fixed `nodes` and
   * fixed surface state: computes the same HTML for the same input every
   * time (see `renderDisplayHtml`).
   */
  public render(nodes: DisplayNode[]): void {
    this.currentHtml = renderDisplayHtml(nodes);
    for (const socket of this.sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(this.currentHtml);
      }
    }
  }

  /** Releases this surface: closes the window, then shuts down its content
   * server. Idempotent. */
  public async close(): Promise<void> {
    for (const socket of this.sockets) {
      try {
        socket.close();
      } catch {
        // Already closed.
      }
    }
    this.sockets.clear();
    await this.handle?.close();
    this.handle = undefined;
    await this.server?.shutdown();
    this.server = undefined;
  }
}

/**
 * Tracks at most one open `DisplaySurface` per session id. A session's
 * display surface is only created in response to an explicit open call
 * (never implicitly by session-open), and is released by `close()` — which
 * `SessionManager` calls when the owning session itself closes (see
 * `mcp.sessions.ts`).
 */
export class DisplaySurfaceManager {
  private readonly surfaces = new Map<string, DisplaySurface>();
  private readonly launcher: DisplaySurfaceLauncher;

  constructor(
    launcher: DisplaySurfaceLauncher = defaultDisplaySurfaceLauncher,
  ) {
    this.launcher = launcher;
  }

  public has(sessionId: string): boolean {
    return this.surfaces.has(sessionId);
  }

  public get(sessionId: string): DisplaySurface | undefined {
    return this.surfaces.get(sessionId);
  }

  /** Opens a new display surface for `sessionId`. Throws if one is already
   * open for that session (callers should check `has()` first to produce a
   * deterministic tool-level error instead). */
  public async open(sessionId: string): Promise<DisplaySurface> {
    if (this.surfaces.has(sessionId)) {
      throw new Error(`Session '${sessionId}' already has a display surface`);
    }
    const surface = new DisplaySurface(sessionId, this.launcher);
    await surface.open();
    this.surfaces.set(sessionId, surface);
    return surface;
  }

  /** Releases `sessionId`'s display surface, if any. No-op otherwise. */
  public async close(sessionId: string): Promise<void> {
    const surface = this.surfaces.get(sessionId);
    if (!surface) return;
    this.surfaces.delete(sessionId);
    await surface.close();
  }
}
