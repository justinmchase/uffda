import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SessionManager } from "./mcp.sessions.ts";

/**
 * Session lifecycle, evaluation, and introspection tools:
 * `uffda_session_open`, `uffda_session_load`, `uffda_session_eval`,
 * `uffda_session_list_modules`, `uffda_session_describe`,
 * `uffda_session_query`, `uffda_session_walk`, `uffda_session_close` (see
 * `.agents/requirements/mcp-server/002-session-lifecycle-and-isolation.requirement.md`,
 * `.agents/requirements/mcp-server/004-session-load-tool.requirement.md`,
 * `.agents/requirements/mcp-server/006-evaluation-tool.requirement.md`,
 * `.agents/requirements/mcp-server/007-introspection-and-query-tools.requirement.md`,
 * and
 * `.agents/requirements/mcp-server/008-match-tree-walking-tool.requirement.md`).
 * A single `SessionManager` instance is shared by every tool for a given
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

export const sessionListModulesInputShape = {
  sessionId: z.string().describe("An id returned by uffda_session_open."),
};
const sessionListModulesInputSchema = z.object(sessionListModulesInputShape);
export type SessionListModulesToolInput = z.infer<
  typeof sessionListModulesInputSchema
>;

export const sessionDescribeInputShape = {
  sessionId: z.string().describe("An id returned by uffda_session_open."),
  name: z.string().describe(
    "The rule/func/decorator name to describe, resolved against the " +
      "target module's own declarations or its imports/decoratorImports.",
  ),
  moduleUrl: z.string().optional().describe(
    "Which loaded module to describe `name` in (a path already passed to " +
      "uffda_session_load, or an href already returned by it). Defaults " +
      "to the most recently loaded module.",
  ),
};
const sessionDescribeInputSchema = z.object(sessionDescribeInputShape);
export type SessionDescribeToolInput = z.infer<
  typeof sessionDescribeInputSchema
>;

export const sessionQueryInputShape = {
  sessionId: z.string().describe("An id returned by uffda_session_open."),
  decorator: z.string().describe(
    "Decorator name to search for. Returns every rule/func across this " +
      "session's loaded modules whose metadata has an own-key entry for this " +
      "decorator (not inherited Object.prototype names).",
  ),
  predicate: z.string().optional().describe(
    "An Uffda pattern (parsed with the pattern grammar) matched against " +
      "each candidate's metadata value; only matching entries are " +
      "returned. Omit to return every entry for `decorator` unfiltered.",
  ),
};
const sessionQueryInputSchema = z.object(sessionQueryInputShape);
export type SessionQueryToolInput = z.infer<typeof sessionQueryInputSchema>;

export const sessionWalkInputShape = {
  sessionId: z.string().describe("An id returned by uffda_session_open."),
  matchResultId: z.string().describe(
    "A matchResultId returned by a prior uffda_session_eval rule " +
      "invocation (present on both successful and failed match outcomes).",
  ),
  path: z.array(z.number().int().nonnegative()).optional().describe(
    "Child indices from the retained match tree's root to the node to " +
      "start walking from. Defaults to [] (the tree's root).",
  ),
  maxNodes: z.number().int().positive().optional().describe(
    "Maximum number of nodes to return in this window (pre-order " +
      "depth-first from the start node, inclusive). Defaults to 50.",
  ),
  maxDepth: z.number().int().nonnegative().optional().describe(
    "Maximum depth (relative to the start node; 0 = only the start node " +
      "itself) to descend into. Omit for no depth limit (bounded only by " +
      "maxNodes).",
  ),
};
const sessionWalkInputSchema = z.object(sessionWalkInputShape);
export type SessionWalkToolInput = z.infer<typeof sessionWalkInputSchema>;

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
    "uffda_session_list_modules",
    {
      title: "uffda session list modules",
      description:
        "Lists every module currently loaded in a session and each " +
        "module's declarations (rules/funcs/decorators, and whether each " +
        "is exported). Read-only: never mutates session state.",
      inputSchema: sessionListModulesInputShape,
    },
    (input: SessionListModulesToolInput) => {
      const lookup = sessions.get(input.sessionId);
      if (!lookup.ok) return jsonResult({ ok: false, error: lookup.error });
      return jsonResult({
        ok: true,
        modules: lookup.session.listLoadedModules(),
      });
    },
  );

  server.registerTool(
    "uffda_session_describe",
    {
      title: "uffda session describe",
      description:
        "Describes a rule/func/decorator declaration using a session's " +
        "already-resolved state: its pattern/expression structure, " +
        "parameters (rules only), and — for rules/funcs — applied " +
        "attributes and keyed metadata. Read-only: never mutates session " +
        "state.",
      inputSchema: sessionDescribeInputShape,
    },
    (input: SessionDescribeToolInput) => {
      const lookup = sessions.get(input.sessionId);
      if (!lookup.ok) return jsonResult({ ok: false, error: lookup.error });
      const result = lookup.session.describe(input.name, input.moduleUrl);
      return jsonResult(result);
    },
  );

  server.registerTool(
    "uffda_session_query",
    {
      title: "uffda session query",
      description:
        "Finds every rule/func across a session's loaded modules whose " +
        "metadata contains an entry for a given decorator, optionally " +
        "filtered by a pattern matched against that entry's value. " +
        "Read-only: never mutates session state.",
      inputSchema: sessionQueryInputShape,
    },
    async (input: SessionQueryToolInput) => {
      const lookup = sessions.get(input.sessionId);
      if (!lookup.ok) return jsonResult({ ok: false, error: lookup.error });
      const result = await lookup.session.queryByMetadata(
        input.decorator,
        input.predicate,
      );
      return jsonResult(result);
    },
  );

  server.registerTool(
    "uffda_session_walk",
    {
      title: "uffda session walk",
      description: "Traverses a retained match result tree from a prior " +
        "uffda_session_eval rule invocation in a deterministic, bounded " +
        "window (never the full tree at once). Each returned node reports " +
        "its own decorator metadata plus the metadata resolved from every " +
        "ancestor on the path from the tree's root, as an ordered list of " +
        "per-rule contributions. Read-only: never mutates the retained " +
        "tree.",
      inputSchema: sessionWalkInputShape,
    },
    (input: SessionWalkToolInput) => {
      const lookup = sessions.get(input.sessionId);
      if (!lookup.ok) return jsonResult({ ok: false, error: lookup.error });
      const result = lookup.session.walk({
        matchResultId: input.matchResultId,
        path: input.path,
        maxNodes: input.maxNodes,
        maxDepth: input.maxDepth,
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
    async (input: SessionCloseInput) => {
      const result = await sessions.close(input.sessionId);
      return jsonResult(
        result.ok ? { ok: true, sessionId: input.sessionId } : {
          ok: false,
          error: result.error,
        },
      );
    },
  );
}
