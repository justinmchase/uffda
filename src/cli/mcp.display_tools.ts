import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SessionManager } from "./mcp.sessions.ts";
import { DisplaySurfaceManager } from "./display.ts";
import {
  highlightResultToDisplayNodes,
  matchResultToDisplayNodes,
} from "./display_transform.ts";
import { CliLanguage } from "./contract.ts";
import { highlightSource } from "./highlight.ts";

/**
 * Session display surface tools: `uffda_session_display_open` and
 * `uffda_session_display_render` (see
 * `.agents/requirements/mcp-server/011-session-display-surface-tool.requirement.md`
 * and `mcp-server.spec.md#session-display-surface-tool`). A single
 * `DisplaySurfaceManager` instance is shared by both tools for a given
 * server, and is released per-session via `SessionManager.onClose` so
 * closing a session always releases its display surface too.
 */

export enum DisplayToolFailureCode {
  UnknownSession = "MCP_DISPLAY_UNKNOWN_SESSION",
  NoOpenSurface = "MCP_DISPLAY_NO_OPEN_SURFACE",
  AlreadyOpen = "MCP_DISPLAY_ALREADY_OPEN",
  UnknownMatchResult = "MCP_DISPLAY_UNKNOWN_MATCH_RESULT",
  InvalidInput = "MCP_DISPLAY_INVALID_INPUT",
}

export type DisplayToolFailure = {
  code: DisplayToolFailureCode;
  phase: "input";
  message: string;
};

const languageSchema = z.nativeEnum(CliLanguage).describe(
  "Which grammar to parse the source with: 'uffda' (full module), " +
    "'pattern', or 'expression'.",
);

export const sessionDisplayOpenInputShape = {
  sessionId: z.string().describe("An id returned by uffda_session_open."),
};
const sessionDisplayOpenInputSchema = z.object(sessionDisplayOpenInputShape);
export type SessionDisplayOpenInput = z.infer<
  typeof sessionDisplayOpenInputSchema
>;

export const sessionDisplayRenderInputShape = {
  sessionId: z.string().describe("An id returned by uffda_session_open."),
  matchResultId: z.string().optional().describe(
    "A retained match result id (from uffda_session_eval), rendered as a " +
      "tree. Mutually exclusive with 'source'.",
  ),
  source: z.string().optional().describe(
    "Source text to render via source highlighting. Mutually exclusive " +
      "with 'matchResultId'.",
  ),
  language: languageSchema.optional().describe(
    "Language 'source' is highlighted as. Defaults to 'uffda'. Ignored " +
      "when 'matchResultId' is set.",
  ),
};
const sessionDisplayRenderInputSchema = z.object(
  sessionDisplayRenderInputShape,
);
export type SessionDisplayRenderInput = z.infer<
  typeof sessionDisplayRenderInputSchema
>;

function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

/**
 * Registers the session display surface tools against `server`, sharing
 * `sessions` (for session lookup) and a dedicated `DisplaySurfaceManager`
 * this function creates and wires into `sessions.onClose`.
 */
export function registerDisplayTools(
  server: McpServer,
  sessions: SessionManager,
  displays: DisplaySurfaceManager = new DisplaySurfaceManager(),
): void {
  server.registerTool(
    "uffda_session_display_open",
    {
      title: "uffda session display open",
      description:
        "Opens a human-observable display surface (a native window backed " +
        "by a loopback-only local endpoint) for a session. Never created " +
        "implicitly by uffda_session_open. Idempotent: if a display " +
        "surface is already open for this session, returns successfully " +
        "without opening a second window.",
      inputSchema: sessionDisplayOpenInputShape,
    },
    async (input: SessionDisplayOpenInput) => {
      const lookup = sessions.get(input.sessionId);
      if (!lookup.ok) {
        return jsonResult({
          ok: false,
          error: {
            code: DisplayToolFailureCode.UnknownSession,
            phase: "input",
            message: lookup.error.message,
          } satisfies DisplayToolFailure,
        });
      }
      if (displays.has(input.sessionId)) {
        return jsonResult({ ok: true, sessionId: input.sessionId });
      }
      await displays.open(input.sessionId);
      sessions.onClose(input.sessionId, () => displays.close(input.sessionId));
      return jsonResult({ ok: true, sessionId: input.sessionId });
    },
  );

  server.registerTool(
    "uffda_session_display_render",
    {
      title: "uffda session display render",
      description: "Renders either a retained match result tree or a source " +
        "highlighting result into a session's already-open display " +
        "surface, updating its window in place (never opening a new " +
        "window). Requires uffda_session_display_open to have been called " +
        "first for this session.",
      inputSchema: sessionDisplayRenderInputShape,
    },
    async (input: SessionDisplayRenderInput) => {
      const lookup = sessions.get(input.sessionId);
      if (!lookup.ok) {
        return jsonResult({
          ok: false,
          error: {
            code: DisplayToolFailureCode.UnknownSession,
            phase: "input",
            message: lookup.error.message,
          } satisfies DisplayToolFailure,
        });
      }
      const surface = displays.get(input.sessionId);
      if (!surface) {
        return jsonResult({
          ok: false,
          error: {
            code: DisplayToolFailureCode.NoOpenSurface,
            phase: "input",
            message:
              `No open display surface for session '${input.sessionId}'; ` +
              "call uffda_session_display_open first",
          } satisfies DisplayToolFailure,
        });
      }

      if (input.matchResultId !== undefined && input.source !== undefined) {
        return jsonResult({
          ok: false,
          error: {
            code: DisplayToolFailureCode.InvalidInput,
            phase: "input",
            message: "'matchResultId' and 'source' are mutually exclusive",
          } satisfies DisplayToolFailure,
        });
      }

      if (input.matchResultId !== undefined) {
        const match = lookup.session.getMatchResult(input.matchResultId);
        if (!match) {
          return jsonResult({
            ok: false,
            error: {
              code: DisplayToolFailureCode.UnknownMatchResult,
              phase: "input",
              message:
                `No retained match result with id '${input.matchResultId}'`,
            } satisfies DisplayToolFailure,
          });
        }
        surface.render(matchResultToDisplayNodes(match));
        return jsonResult({ ok: true, sessionId: input.sessionId });
      }

      if (input.source !== undefined) {
        const highlighted = await highlightSource(
          input.source,
          input.language ?? CliLanguage.FullUffda,
        );
        surface.render(highlightResultToDisplayNodes(highlighted));
        return jsonResult({ ok: true, sessionId: input.sessionId });
      }

      return jsonResult({
        ok: false,
        error: {
          code: DisplayToolFailureCode.InvalidInput,
          phase: "input",
          message: "One of 'matchResultId' or 'source' is required",
        } satisfies DisplayToolFailure,
      });
    },
  );
}
