import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
  DisplaySurface,
  type DisplaySurfaceHandle,
  type DisplaySurfaceLauncher,
  DisplaySurfaceManager,
} from "./display.ts";
import type { DisplayNode } from "./display_transform.ts";

/**
 * Coverage for the session display surface's content server (see
 * `.agents/requirements/mcp-server/011-session-display-surface-tool.requirement.md`).
 * Uses a fake launcher instead of the real `defaultDisplaySurfaceLauncher`
 * (which compiles and spawns a real `deno desktop` window) so this suite
 * runs without a GUI/webview stack — see `highlight.ts`'s manual-validation
 * precedent for why the actual native window isn't exercised by automated
 * tests.
 */

function fakeLauncher(): {
  launcher: DisplaySurfaceLauncher;
  calls: { url: string; title: string }[];
  closeCalls: number;
} {
  const calls: { url: string; title: string }[] = [];
  let closeCalls = 0;
  const launcher: DisplaySurfaceLauncher = (url, title) => {
    calls.push({ url, title });
    const handle: DisplaySurfaceHandle = {
      close: () => {
        closeCalls++;
        return Promise.resolve();
      },
    };
    return Promise.resolve(handle);
  };
  return {
    launcher,
    calls,
    get closeCalls() {
      return closeCalls;
    },
  };
}

Deno.test("cli.display DisplaySurface serves loopback-only content and pushes updates", async (t) => {
  await t.step(
    "open() binds loopback and launches the window handle",
    async () => {
      const { launcher, calls } = fakeLauncher();
      const surface = new DisplaySurface("session-1", launcher);
      await surface.open();
      try {
        assertEquals(calls.length, 1);
        assert(surface.url.startsWith("http://127.0.0.1:"));
        assertEquals(calls[0].url, surface.url);
      } finally {
        await surface.close();
      }
    },
  );

  await t.step("GET / serves the current content as HTML", async () => {
    const { launcher } = fakeLauncher();
    const surface = new DisplaySurface("session-2", launcher);
    await surface.open();
    try {
      const nodes: DisplayNode[] = [{ label: "hello", cssClass: "hl-string" }];
      surface.render(nodes);
      const res = await fetch(surface.url);
      const html = await res.text();
      assertStringIncludes(html, '<span class="hl-string">hello</span>');
    } finally {
      await surface.close();
    }
  });

  await t.step(
    "a websocket client receives the current content on connect, and updates after render()",
    async () => {
      const { launcher } = fakeLauncher();
      const surface = new DisplaySurface("session-3", launcher);
      await surface.open();
      try {
        surface.render([{ label: "first", cssClass: "hl-string" }]);
        const wsUrl = surface.url.replace("http://", "ws://") + "ws";
        const socket = new WebSocket(wsUrl);
        const first = await new Promise<string>((resolve, reject) => {
          socket.onmessage = (e) => resolve(e.data as string);
          socket.onerror = (e) => reject(e);
        });
        assertStringIncludes(first, "first");

        const second = new Promise<string>((resolve) => {
          socket.onmessage = (e) => resolve(e.data as string);
        });
        surface.render([{ label: "second", cssClass: "hl-string" }]);
        assertStringIncludes(await second, "second");
        socket.close();
      } finally {
        await surface.close();
      }
    },
  );

  await t.step(
    "close() closes the window handle and stops serving",
    async () => {
      const state = fakeLauncher();
      const surface = new DisplaySurface("session-4", state.launcher);
      await surface.open();
      const url = surface.url;
      await surface.close();
      assertEquals(state.closeCalls, 1);
      await assertRejectsFetch(url);
    },
  );
});

async function assertRejectsFetch(url: string): Promise<void> {
  try {
    await fetch(url);
    throw new Error("expected fetch to fail after close()");
  } catch {
    // expected: connection refused once the server has shut down.
  }
}

Deno.test("cli.display DisplaySurfaceManager tracks at most one surface per session", async (t) => {
  await t.step("open() then has()/get() reflect the open surface", async () => {
    const { launcher } = fakeLauncher();
    const manager = new DisplaySurfaceManager(launcher);
    assertEquals(manager.has("s1"), false);
    const surface = await manager.open("s1");
    try {
      assertEquals(manager.has("s1"), true);
      assertEquals(manager.get("s1"), surface);
    } finally {
      await manager.close("s1");
    }
  });

  await t.step("opening twice for the same session throws", async () => {
    const { launcher } = fakeLauncher();
    const manager = new DisplaySurfaceManager(launcher);
    await manager.open("s2");
    try {
      let threw = false;
      try {
        await manager.open("s2");
      } catch {
        threw = true;
      }
      assert(threw);
    } finally {
      await manager.close("s2");
    }
  });

  await t.step("close() on an unopened session is a no-op", async () => {
    const { launcher } = fakeLauncher();
    const manager = new DisplaySurfaceManager(launcher);
    await manager.close("never-opened");
    assertEquals(manager.has("never-opened"), false);
  });
});
