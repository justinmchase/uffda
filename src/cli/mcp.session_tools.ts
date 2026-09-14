import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SessionManager } from "./mcp.sessions.ts";

/**
 * Session lifecycle tools: `uffda_session_open`, `uffda_session_load`,
 * `uffda_session_close` (see
 * `.agents/requirements/mcp-server/002-session-lifecycle-and-isolation.requirement.md`
 * and `.agents/requirements/mcp-server/004-session-load-tool.requirement.md`).
 * A single `SessionManager` instance is shared by all three tools for a given
 * server so state genuinely persists across tool calls within one server
 * process (each session is still isolated from every other session).
 */

export const sessionOpenInputShape = {
  cwd: z.string().optional().describe(
    "Absolute working directory the session's imports/artifacts resolve " +
      "against. Defaults to the server process's cwd.",
  ),
  artifactRoot: z.string().optional().describe(
    "Root whose 'ast/' subtree mirrors compiled .uff artifacts, used to " +
      "resolve this session's .uff imports. Defaults to '.uffda', matching " +
      "uffda_compile's default output location.",
  ),
};
const sessionOpenInputSchema = z.object(sessionOpenInputShape);
export type SessionOpenInput = z.infer<typeof sessionOpenInputSchema>;

export const sessionLoadInputShape = {
  sessionId: z.string().describe("An id returned by uffda_session_open."),
  source: z.string().describe("Uffda module source text to load."),
  path: z.string().optional().describe(
    "Path (relative to the session's cwd) identifying this module, used " +
      "for relative imports and to re-address the same module on repeated " +
      "loads. Omit for ephemeral inline source with no meaningful path.",
  ),
};
const sessionLoadInputSchema = z.object(sessionLoadInputShape);
export type SessionLoadInput = z.infer<typeof sessionLoadInputSchema>;

export const sessionCloseInputShape = {
  sessionId: z.string().describe("An id returned by uffda_session_open."),
};
const sessionCloseInputSchema = z.object(sessionCloseInputShape);
export type SessionCloseInput = z.infer<typeof sessionCloseInputSchema>;

export const sessionEvalInputShape = {
  sessionId: z.string().describe("An id returned by uffda_session_open."),
  moduleUrl: z.string().optional().describe(
    "Which loaded module's scope to evaluate against (a path already " +
      "passed to uffda_session_load). Defaults to the most recently " +
      "loaded module.",
  ),
  expression: z.string().optional().describe(
    "An Uffda expression to evaluate (parsed with the expression " +
      "grammar), for example '(add 1 2)' to invoke an in-scope func, or a " +
      "member/object construction. Mutually exclusive with `rule`.",
  ),
  rule: z.string().optional().describe(
    "The name of an exported Rule to invoke against `input`. Mutually " +
      "exclusive with `expression`. Exactly one of `expression`/`rule` is " +
      "required.",
  ),
  input: z.string().describe(
    "Subject text to match `rule` against. Required when `rule` is set.",
  ).optional(),
  inputIsJson: z.boolean().optional().describe(
    "When true, `input` is parsed as JSON before matching. Defaults to " +
      "false (input is matched as raw text/iterable), matching " +
      "uffda_match's convention.",
  ),
};
const sessionEvalInputSchema = z.object(sessionEvalInputShape);
export type SessionEvalToolInput = z.infer<typeof sessionEvalInputSchema>;

function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

/**
 * Registers the session lifecycle tools against `server` using `sessions`
 * as their shared, per-server session store.
 */
export function registerSessionTools(
  server: McpServer,
  sessions: SessionManager,
): void {
  server.registerTool(
    "uffda_session_open",
    {
      title: "uffda session open",
      description:
        "Opens a new, empty live runtime session and returns its id. " +
        "State loaded into one session is never visible to another.",
      inputSchema: sessionOpenInputShape,
    },
    (input: SessionOpenInput) => {
      const session = sessions.open({
        cwd: input.cwd,
        artifactRoot: input.artifactRoot,
      });
      return jsonResult({ ok: true, sessionId: session.id });
    },
  );

  server.registerTool(
    "uffda_session_load",
    {
      title: "uffda session load",
      description:
        "Parses, compiles, and resolves source against a session's " +
        "accumulated module graph, adding it (and any modules it imports). " +
        "Reports the loaded module's exported rules/funcs/decorators on " +
        "success, or which stage failed plus previously loaded modules on " +
        "failure.",
      inputSchema: sessionLoadInputShape,
    },
    async (input: SessionLoadInput) => {
      const lookup = sessions.get(input.sessionId);
      if (!lookup.ok) return jsonResult({ ok: false, error: lookup.error });
      const result = await lookup.session.load(input.source, input.path);
      return jsonResult(result);
    },
  );

  server.registerTool(
    "uffda_session_eval",
    {
      title: "uffda session eval",
      description:
        "Evaluates an expression, or invokes a named exported Rule against " +
        "subject input, using a session's already-resolved live state " +
        "(no re-parsing or re-resolving any loaded module). Exactly one " +
        "of `expression`/`rule` is required.",
      inputSchema: sessionEvalInputShape,
    },
    async (input: SessionEvalToolInput) => {
      const lookup = sessions.get(input.sessionId);
      if (!lookup.ok) return jsonResult({ ok: false, error: lookup.error });
      const result = await lookup.session.eval({
        moduleUrl: input.moduleUrl,
        expression: input.expression,
        rule: input.rule,
        input: input.input,
        inputIsJson: input.inputIsJson,
      });
      return jsonResult(result);
    },
  );

  server.registerTool(
    "uffda_session_close",
    {
      title: "uffda session close",
      description:
        "Closes a session, releasing all of its in-memory state. Further " +
        "tool calls against this session id will fail deterministically.",
      inputSchema: sessionCloseInputShape,
    },
    (input: SessionCloseInput) => {
      const result = sessions.close(input.sessionId);
      return jsonResult(
        result.ok ? { ok: true, sessionId: input.sessionId } : {
          ok: false,
          error: result.error,
        },
      );
    },
  );
}
