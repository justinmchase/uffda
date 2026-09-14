/**
 * Generic, session-agnostic `deno desktop` shell for the session display
 * surface tool (see
 * `.agents/requirements/mcp-server/011-session-display-surface-tool.requirement.md`).
 *
 * This file is compiled exactly once (see `getDisplayShellBinary` in
 * `display.ts`) and the resulting binary is reused by every display
 * surface for the lifetime of the machine's cache — it never contains any
 * session-specific logic itself. All it does is open a native window and
 * point it at whatever local URL the spawning process passes in via
 * environment variables; the actual content (highlight/match-tree HTML,
 * live updates over a WebSocket) is served entirely by that URL, which is
 * hosted by the ordinary `deno run` MCP server process, not by this binary.
 */

const url = Deno.env.get("UFFDA_DISPLAY_URL");
if (!url) {
  console.error("UFFDA_DISPLAY_URL environment variable is required");
  Deno.exit(1);
}
const title = Deno.env.get("UFFDA_DISPLAY_TITLE") ?? "uffda display";

// deno-lint-ignore no-explicit-any
const win = new (Deno as any).BrowserWindow({ title });
win.navigate(url);
win.addEventListener("close", () => Deno.exit(0));
