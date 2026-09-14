import { RuntimeSession, type RuntimeSessionOptions } from "./mcp.session.ts";

/**
 * Manages the MCP server's set of concurrently open `RuntimeSession`s (see
 * `.agents/specifications/languages/cli/mcp-server.spec.md#session-model`).
 * Session ids are process-local and never reused, so a stale id can never be
 * confused with a live session even after the original session is closed.
 */

export enum SessionManagerErrorCode {
  UnknownSession = "MCP_SESSION_UNKNOWN",
}

export type SessionManagerError = {
  code: SessionManagerErrorCode;
  phase: "session-lookup";
  message: string;
};

export type SessionLookupResult =
  | { ok: true; session: RuntimeSession }
  | { ok: false; error: SessionManagerError };

/** A cleanup callback registered against a session id, invoked once when
 * that session closes (see `onClose`). May be async (e.g. releasing a
 * display surface's window/server). */
export type SessionDisposeHook = (id: string) => void | Promise<void>;

export class SessionManager {
  private readonly sessions = new Map<string, RuntimeSession>();
  private readonly disposeHooks = new Map<string, SessionDisposeHook[]>();
  private nextId = 0;

  /** Opens a new, empty session and returns its stable id. */
  public open(options?: RuntimeSessionOptions): RuntimeSession {
    const id = `session-${++this.nextId}`;
    const session = new RuntimeSession(id, options);
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Resolves `id` to a live session. Fails deterministically — rather than
   * creating or reusing state — for an id that was never opened, or that
   * belongs to a session that has since been closed (see
   * `.agents/requirements/mcp-server/002-session-lifecycle-and-isolation.requirement.md`).
   */
  public get(id: string): SessionLookupResult {
    const session = this.sessions.get(id);
    if (!session || session.isClosed) {
      return {
        ok: false,
        error: {
          code: SessionManagerErrorCode.UnknownSession,
          phase: "session-lookup",
          message: `No open session with id '${id}'`,
        },
      };
    }
    return { ok: true, session };
  }

  /**
   * Registers `hook` to run when `id`'s session closes (e.g. releasing a
   * display surface opened against that session). Hooks for a session that
   * never closes are simply never invoked; hooks are discarded once run.
   */
  public onClose(id: string, hook: SessionDisposeHook): void {
    const hooks = this.disposeHooks.get(id);
    if (hooks) {
      hooks.push(hook);
    } else {
      this.disposeHooks.set(id, [hook]);
    }
  }

  /** Closes and releases `id`'s session, if it is currently open, running
   * any hooks registered via `onClose` first. */
  public async close(id: string): Promise<SessionLookupResult> {
    const lookup = this.get(id);
    if (!lookup.ok) return lookup;
    const hooks = this.disposeHooks.get(id);
    this.disposeHooks.delete(id);
    if (hooks) {
      for (const hook of hooks) {
        await hook(id);
      }
    }
    lookup.session.close();
    this.sessions.delete(id);
    return lookup;
  }
}
