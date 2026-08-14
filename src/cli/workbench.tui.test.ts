import { assertEquals, assertStringIncludes } from "@std/assert";
import { CliLanguage } from "./contract.ts";
import {
  applyEditorKey,
  type FileEntry,
  flattenEntries,
  renderWorkbenchScreen,
  scrollStartForFocus,
  type WorkbenchRenderState,
} from "./workbench.tui.ts";

// deno-lint-ignore no-control-regex -- matches ANSI escape sequences
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

function visibleRows(screen: string): string[] {
  return screen.split("\n").map(stripAnsi);
}

function key(
  value: string,
  overrides: Partial<{ ctrl: boolean; meta: boolean }> = {},
) {
  return { key: value, ctrl: false, meta: false, ...overrides };
}

function baseState(
  overrides: Partial<WorkbenchRenderState> = {},
): WorkbenchRenderState {
  return {
    screen: "workspace",
    mode: "files",
    pathInput: { source: "/workspace", cursor: 10 },
    workspaceRoot: "/workspace",
    visibleEntries: [],
    cursorIndex: 0,
    editor: { source: "", cursor: 0 },
    language: CliLanguage.FullUffda,
    status: "ready",
    ...overrides,
  };
}

Deno.test("cli.workbench.tui applyEditorKey edits and navigates a buffer", async (t) => {
  await t.step("inserts characters at the cursor", () => {
    const next = applyEditorKey({ source: "ac", cursor: 1 }, key("b"));
    assertEquals(next, { source: "abc", cursor: 2 });
  });

  await t.step("handles return, tab, and space as text", () => {
    assertEquals(
      applyEditorKey({ source: "ab", cursor: 1 }, key("return")),
      { source: "a\nb", cursor: 2 },
    );
    assertEquals(
      applyEditorKey({ source: "", cursor: 0 }, key("tab")),
      { source: "  ", cursor: 2 },
    );
    assertEquals(
      applyEditorKey({ source: "ab", cursor: 1 }, key("space")),
      { source: "a b", cursor: 2 },
    );
  });

  await t.step("backspace and delete remove adjacent characters", () => {
    assertEquals(
      applyEditorKey({ source: "abc", cursor: 2 }, key("backspace")),
      { source: "ac", cursor: 1 },
    );
    assertEquals(
      applyEditorKey({ source: "abc", cursor: 0 }, key("backspace")),
      { source: "abc", cursor: 0 },
    );
    assertEquals(
      applyEditorKey({ source: "abc", cursor: 1 }, key("delete")),
      { source: "ac", cursor: 1 },
    );
  });

  await t.step("arrow keys move across lines", () => {
    const state = { source: "ab\ncd", cursor: 1 };
    assertEquals(applyEditorKey(state, key("down")), {
      source: "ab\ncd",
      cursor: 4,
    });
    assertEquals(applyEditorKey(state, key("right")), {
      source: "ab\ncd",
      cursor: 2,
    });
    assertEquals(
      applyEditorKey({ source: "ab\ncd", cursor: 4 }, key("up")),
      { source: "ab\ncd", cursor: 1 },
    );
  });

  await t.step("home and end move within the current line", () => {
    const state = { source: "abc\ndef", cursor: 5 };
    assertEquals(applyEditorKey(state, key("home")), {
      source: "abc\ndef",
      cursor: 4,
    });
    assertEquals(applyEditorKey(state, key("end")), {
      source: "abc\ndef",
      cursor: 7,
    });
  });

  await t.step("ignores ctrl and meta combinations", () => {
    const state = { source: "abc", cursor: 1 };
    assertEquals(applyEditorKey(state, key("s", { ctrl: true })), state);
    assertEquals(applyEditorKey(state, key("s", { meta: true })), state);
  });
});

Deno.test("cli.workbench.tui flattenEntries lists expanded directories inline", () => {
  const tree: FileEntry[] = [
    {
      name: "src",
      path: "/workspace/src",
      isDirectory: true,
      expanded: true,
      children: [
        {
          name: "mod.ts",
          path: "/workspace/src/mod.ts",
          isDirectory: false,
          expanded: false,
        },
      ],
    },
    {
      name: "README.md",
      path: "/workspace/README.md",
      isDirectory: false,
      expanded: false,
    },
  ];

  const visible = flattenEntries(tree);
  assertEquals(visible.map((v) => [v.entry.name, v.depth]), [
    ["src", 0],
    ["mod.ts", 1],
    ["README.md", 0],
  ]);

  tree[0].expanded = false;
  assertEquals(flattenEntries(tree).map((v) => v.entry.name), [
    "src",
    "README.md",
  ]);
});

Deno.test("cli.workbench.tui scrollStartForFocus keeps the focus line visible", () => {
  assertEquals(scrollStartForFocus(0, 5, 3), 0);
  assertEquals(scrollStartForFocus(8, 5, 20), 6);
  assertEquals(scrollStartForFocus(19, 5, 20), 15);
});

Deno.test("cli.workbench.tui renderWorkbenchScreen renders a fixed-size frame per screen", async (t) => {
  await t.step("renders the landing screen with the banner and prompt", () => {
    const state = baseState({ screen: "landing" });
    const screen = renderWorkbenchScreen(state, 60, 20);
    const rows = visibleRows(screen);

    assertEquals(rows.length, 19);
    assertEquals(new Set(rows.map((row) => row.length)).size, 1);
    assertStringIncludes(screen, "█████████");
    assertStringIncludes(screen, "Select a workspace folder");
    assertStringIncludes(screen, "/workspace");
    assertStringIncludes(screen, "\x1b[30;103m");
  });

  await t.step("renders the file tree with the selection marker", () => {
    const state = baseState({
      visibleEntries: [
        {
          entry: {
            name: "src",
            path: "/workspace/src",
            isDirectory: true,
            expanded: false,
          },
          depth: 0,
        },
        {
          entry: {
            name: "README.md",
            path: "/workspace/README.md",
            isDirectory: false,
            expanded: false,
          },
          depth: 0,
        },
      ],
      cursorIndex: 1,
    });

    const screen = renderWorkbenchScreen(state, 90, 12);
    const rows = visibleRows(screen);

    assertEquals(rows.length, 11);
    assertEquals(new Set(rows.map((row) => row.length)).size, 1);
    assertStringIncludes(screen, "> ");
    assertStringIncludes(screen, "README.md");
    assertStringIncludes(screen, "▸ src");
    assertStringIncludes(screen, "←→ collapse/expand");
    assertStringIncludes(screen, "Esc workspace");
    assertStringIncludes(screen, "\x1b[1;97;44m");
    assertStringIncludes(screen, "\x1b[97m");
  });

  await t.step("renders the editor with a numbered current line", () => {
    const state = baseState({
      mode: "editor",
      openFilePath: "/workspace/main.uff",
      editor: { source: "any", cursor: 3 },
      status: "compiled",
    });

    const screen = renderWorkbenchScreen(state, 60, 12);
    assertStringIncludes(screen, "any");
    assertStringIncludes(screen, "Shift+Tab preview");
    assertStringIncludes(screen, "compiled");
    assertStringIncludes(screen, "\x1b[30;103m");
    assertEquals(
      new Set(visibleRows(screen).map((row) => row.length)).size,
      1,
    );
  });

  await t.step("scrolls the editor so the cursor line stays visible", () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line-${i}`);
    const source = lines.join("\n");
    const cursorLine = 30;
    const cursor = lines.slice(0, cursorLine).join("\n").length + 1;
    const state = baseState({
      mode: "editor",
      openFilePath: "/workspace/long.uff",
      editor: { source, cursor },
      status: "compiled",
    });

    const screen = renderWorkbenchScreen(state, 40, 10);
    const rows = visibleRows(screen);
    assertStringIncludes(rows.join("\n"), "line-30");
    assertEquals(rows.some((row) => row.includes("line-0")), false);
  });

  await t.step("renders read-only preview output with scroll offset", () => {
    const visualization = Array.from({ length: 20 }, (_, i) => `viz-${i}`)
      .join("\n");
    const state = baseState({
      mode: "preview",
      openFilePath: "/workspace/main.uff",
      visualization,
      previewScroll: 5,
    });

    const screen = renderWorkbenchScreen(state, 60, 10);
    const rows = visibleRows(screen);
    assertStringIncludes(rows.join("\n"), "viz-5");
    assertEquals(rows.some((row) => row.includes("viz-0")), false);
    assertStringIncludes(screen, "↑↓ scroll");
    assertStringIncludes(screen, "Shift+Tab editor");
  });

  await t.step(
    "path-bypass style state opens directly in editor mode",
    () => {
      const state = baseState({
        mode: "editor",
        workspaceRoot: "/workspace",
        openFilePath: "/workspace/main.uff",
        editor: { source: "export Main; rule Main = ok;", cursor: 0 },
        status: "compiled",
      });
      const screen = renderWorkbenchScreen(state, 80, 12);
      const plain = stripAnsi(screen);
      assertStringIncludes(plain, "Editor: /workspace/main.uff");
      assertStringIncludes(plain, "export Main");
      assertEquals(state.mode, "editor");
      assertEquals(state.screen, "workspace");
    },
  );
});
