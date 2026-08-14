import { dirname, resolve } from "@std/path";
import { Style } from "@tui/nice";
import { signal } from "@tui/signals";
import type { KeyPress } from "@tui/inputs";
import type { CliLanguage, CliProcessContract } from "./contract.ts";
import { CliWorkbench, workbenchBanner } from "./workbench.ts";

export type WorkbenchEditorState = {
  source: string;
  cursor: number;
};

type CursorPosition = { line: number; column: number };

function linesOf(source: string): string[] {
  return source.split("\n");
}

function cursorPosition(state: WorkbenchEditorState): CursorPosition {
  const beforeLines = state.source.slice(0, state.cursor).split("\n");
  return {
    line: beforeLines.length - 1,
    column: beforeLines.at(-1)?.length ?? 0,
  };
}

function offsetFor(source: string, line: number, column: number): number {
  const sourceLines = linesOf(source);
  const safeLine = Math.max(0, Math.min(line, sourceLines.length - 1));
  let offset = 0;
  for (let index = 0; index < safeLine; index++) {
    offset += sourceLines[index].length + 1;
  }
  return offset + Math.max(0, Math.min(column, sourceLines[safeLine].length));
}

function insertText(
  state: WorkbenchEditorState,
  text: string,
): WorkbenchEditorState {
  return {
    source: state.source.slice(0, state.cursor) + text +
      state.source.slice(state.cursor),
    cursor: state.cursor + text.length,
  };
}

export function applyEditorKey(
  state: WorkbenchEditorState,
  keyPress: Pick<KeyPress, "key" | "ctrl" | "meta">,
): WorkbenchEditorState {
  if (keyPress.ctrl || keyPress.meta) return state;

  const position = cursorPosition(state);
  switch (keyPress.key) {
    case "left":
      return { ...state, cursor: Math.max(0, state.cursor - 1) };
    case "right":
      return {
        ...state,
        cursor: Math.min(state.source.length, state.cursor + 1),
      };
    case "up":
      return {
        ...state,
        cursor: offsetFor(state.source, position.line - 1, position.column),
      };
    case "down":
      return {
        ...state,
        cursor: offsetFor(state.source, position.line + 1, position.column),
      };
    case "home":
      return { ...state, cursor: offsetFor(state.source, position.line, 0) };
    case "end":
      return {
        ...state,
        cursor: offsetFor(
          state.source,
          position.line,
          linesOf(state.source)[position.line].length,
        ),
      };
    case "backspace":
      if (state.cursor === 0) return state;
      return {
        source: state.source.slice(0, state.cursor - 1) +
          state.source.slice(state.cursor),
        cursor: state.cursor - 1,
      };
    case "delete":
      if (state.cursor === state.source.length) return state;
      return {
        source: state.source.slice(0, state.cursor) +
          state.source.slice(state.cursor + 1),
        cursor: state.cursor,
      };
    case "return":
      return insertText(state, "\n");
    case "tab":
      return insertText(state, "  ");
    case "space":
      return insertText(state, " ");
    default:
      return keyPress.key.length === 1
        ? insertText(state, keyPress.key)
        : state;
  }
}

export type FileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  expanded: boolean;
  children?: FileEntry[];
};

export type VisibleEntry = { entry: FileEntry; depth: number };

export function flattenEntries(
  entries: FileEntry[],
  depth = 0,
): VisibleEntry[] {
  const result: VisibleEntry[] = [];
  for (const entry of entries) {
    result.push({ entry, depth });
    if (entry.isDirectory && entry.expanded && entry.children) {
      result.push(...flattenEntries(entry.children, depth + 1));
    }
  }
  return result;
}

export type WorkbenchScreenKind = "landing" | "workspace";
export type WorkbenchMode = "files" | "editor" | "preview";

export type WorkbenchRenderState = {
  screen: WorkbenchScreenKind;
  mode: WorkbenchMode;
  pathInput: WorkbenchEditorState;
  landingError?: string;
  workspaceRoot?: string;
  visibleEntries: VisibleEntry[];
  cursorIndex: number;
  openFilePath?: string;
  editor: WorkbenchEditorState;
  language: CliLanguage;
  visualization?: string;
  previewScroll?: number;
  status: string;
};

/** Keep `focusLine` visible inside a body of `bodyHeight` rows. */
export function scrollStartForFocus(
  focusLine: number,
  bodyHeight: number,
  totalLines: number,
): number {
  if (totalLines <= bodyHeight) return 0;
  const maxStart = Math.max(0, totalLines - bodyHeight);
  const ideal = focusLine - Math.floor(bodyHeight / 2);
  return Math.max(0, Math.min(ideal, maxStart));
}

// deno-lint-ignore no-control-regex -- matches ANSI escape sequences
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
const ANSI_RESET = "\x1b[0m";
const ANSI_WHITE = "\x1b[97m";
const ANSI_SELECTED = "\x1b[1;97;44m";
// Explicit colors (not reverse-video) so the cursor is unmistakable
// regardless of the terminal's default foreground/background theme.
const ANSI_CURSOR = "\x1b[30;103m";

function visibleLength(text: string): number {
  return text.replace(ANSI_PATTERN, "").length;
}

function fit(text: string, width: number): string {
  const visible = visibleLength(text);
  if (visible > width) {
    const plain = text.replace(ANSI_PATTERN, "");
    return plain.length > width
      ? `${plain.slice(0, Math.max(0, width - 1))}…`
      : plain;
  }
  return text + " ".repeat(width - visible);
}

function white(text: string): string {
  return `${ANSI_WHITE}${text}${ANSI_RESET}`;
}

function finalize(lines: string[], width: number, height: number): string {
  const framed = lines.map((line) => fit(line, width));
  while (framed.length < height) framed.push(fit("", width));
  return framed.slice(0, height).join("\n");
}

// Overlays a visible cursor block onto an already-fitted line.
function withCursorOverlay(paddedLine: string, column: number): string {
  const before = paddedLine.slice(0, column);
  const at = paddedLine[column] ?? " ";
  const after = paddedLine.slice(column + 1);
  return `${ANSI_WHITE}${before}${ANSI_RESET}${ANSI_CURSOR}${at}${ANSI_RESET}${ANSI_WHITE}${after}${ANSI_RESET}`;
}

function renderLanding(
  state: WorkbenchRenderState,
  width: number,
  height: number,
): string {
  const promptWidth = Math.max(1, width - 2);
  const promptLine = withCursorOverlay(
    fit(state.pathInput.source, promptWidth),
    state.pathInput.cursor,
  );
  const lines = [
    ...workbenchBanner().split("\n"),
    "",
    white("Select a workspace folder:"),
    `> ${promptLine}`,
    state.landingError ? white(`Error: ${state.landingError}`) : "",
    "",
    white("Enter open workspace   Ctrl+C quit"),
  ];
  return finalize(lines, width, height);
}

function renderFiles(
  state: WorkbenchRenderState,
  width: number,
  height: number,
): string {
  const header = white(`Workspace: ${state.workspaceRoot ?? ""}`);
  const bodyHeight = Math.max(1, height - 2);
  const total = state.visibleEntries.length;
  const start = Math.max(
    0,
    Math.min(
      state.cursorIndex - Math.floor(bodyHeight / 2),
      Math.max(0, total - bodyHeight),
    ),
  );
  const rows: string[] = [];
  for (let i = 0; i < bodyHeight; i++) {
    const index = start + i;
    const visible = state.visibleEntries[index];
    if (!visible) {
      rows.push(fit("", width));
      continue;
    }
    const selected = index === state.cursorIndex;
    const marker = selected ? ">" : " ";
    const icon = visible.entry.isDirectory
      ? (visible.entry.expanded ? "▾" : "▸")
      : " ";
    const plain = fit(
      `${marker} ${"  ".repeat(visible.depth)}${icon} ${visible.entry.name}`,
      width,
    );
    rows.push(
      selected
        ? `${ANSI_SELECTED}${plain}${ANSI_RESET}`
        : `${ANSI_WHITE}${plain}${ANSI_RESET}`,
    );
  }
  const footer = white(
    "↑↓ select   ←→ collapse/expand   Enter open/expand   Esc workspace   Ctrl+C quit",
  );
  return finalize([header, ...rows, footer], width, height);
}

const EDITOR_GUTTER_WIDTH = 6; // marker(1) + line number padStart(4) + space(1)

function renderEditor(
  state: WorkbenchRenderState,
  width: number,
  height: number,
): string {
  const header = white(
    `Editor: ${state.openFilePath ?? "<no file>"} — ${state.status}`,
  );
  const bodyHeight = Math.max(1, height - 2);
  const lines = linesOf(state.editor.source);
  const position = cursorPosition(state.editor);
  const start = scrollStartForFocus(position.line, bodyHeight, lines.length);
  const rows: string[] = [];
  for (let row = 0; row < bodyHeight; row++) {
    const lineIndex = start + row;
    const marker = lineIndex === position.line ? ">" : " ";
    const plain = fit(
      `${marker}${String(lineIndex + 1).padStart(4)} ${lines[lineIndex] ?? ""}`,
      width,
    );
    if (lineIndex === position.line) {
      const column = Math.min(
        EDITOR_GUTTER_WIDTH + position.column,
        width - 1,
      );
      rows.push(withCursorOverlay(plain, column));
    } else {
      rows.push(white(plain));
    }
  }
  const footer = white(
    "type to edit   Ctrl+S save   Shift+Tab preview   Esc files   Ctrl+C quit",
  );
  return finalize([header, ...rows, footer], width, height);
}

function renderPreview(
  state: WorkbenchRenderState,
  width: number,
  height: number,
): string {
  const header = white(
    `Preview: ${state.openFilePath ?? "<no file>"} — ${state.language}`,
  );
  const bodyHeight = Math.max(1, height - 2);
  const lines = (state.visualization ?? "Compilation pending").split("\n");
  const maxStart = Math.max(0, lines.length - bodyHeight);
  const start = Math.max(0, Math.min(state.previewScroll ?? 0, maxStart));
  const rows: string[] = [];
  for (let row = 0; row < bodyHeight; row++) {
    rows.push(white(fit(lines[start + row] ?? "", width)));
  }
  const footer = white(
    "↑↓ scroll   Shift+Tab editor   Esc files   Ctrl+C quit",
  );
  return finalize([header, ...rows, footer], width, height);
}

export function renderWorkbenchScreen(
  state: WorkbenchRenderState,
  columns: number,
  rows: number,
): string {
  const width = Math.max(columns, 20);
  // Reserve the bottom row: filling every terminal row causes the final
  // line to scroll out of view on some terminals.
  const height = Math.max(rows - 1, 6);

  if (state.screen === "landing") return renderLanding(state, width, height);
  if (state.mode === "files") return renderFiles(state, width, height);
  if (state.mode === "editor") return renderEditor(state, width, height);
  return renderPreview(state, width, height);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function loadEntries(dirPath: string): FileEntry[] {
  const entries: FileEntry[] = [];
  for (const dirEntry of Deno.readDirSync(dirPath)) {
    if (dirEntry.name.startsWith(".")) continue;
    entries.push({
      name: dirEntry.name,
      path: resolve(dirPath, dirEntry.name),
      isDirectory: dirEntry.isDirectory,
      expanded: false,
    });
  }
  entries.sort((a, b) =>
    a.isDirectory === b.isDirectory
      ? a.name.localeCompare(b.name)
      : a.isDirectory
      ? -1
      : 1
  );
  return entries;
}

function toggleExpand(entry: FileEntry): void {
  entry.expanded = !entry.expanded;
  if (entry.expanded && !entry.children) {
    entry.children = loadEntries(entry.path);
  }
}

type AppState = {
  screen: WorkbenchScreenKind;
  mode: WorkbenchMode;
  pathInput: WorkbenchEditorState;
  landingError?: string;
  workspaceRoot?: string;
  tree: FileEntry[];
  cursorIndex: number;
  openFilePath?: string;
  editor: WorkbenchEditorState;
  previewScroll: number;
  status: string;
};

export async function launchWorkbenchTui(
  contract: CliProcessContract,
): Promise<void> {
  // Lazy-load so unit tests can import render helpers without a TTY-backed
  // @tui/tui singleton (its constructor calls Deno.consoleSize()).
  const { tui } = await import("@tui/tui");
  const workbench = new CliWorkbench(contract.cwd);
  await workbench.execute({ action: "start", language: contract.language });

  const state: AppState = {
    screen: "landing",
    mode: "files",
    pathInput: { source: contract.cwd, cursor: contract.cwd.length },
    tree: [],
    cursorIndex: 0,
    editor: { source: "", cursor: 0 },
    previewScroll: 0,
    status: "ready",
  };

  const toRenderState = (): WorkbenchRenderState => ({
    screen: state.screen,
    mode: state.mode,
    pathInput: state.pathInput,
    landingError: state.landingError,
    workspaceRoot: state.workspaceRoot,
    visibleEntries: flattenEntries(state.tree),
    cursorIndex: state.cursorIndex,
    openFilePath: state.openFilePath,
    editor: state.editor,
    language: workbench.session.language,
    visualization: workbench.session.visualization,
    previewScroll: state.previewScroll,
    status: state.status,
  });
  const currentScreen = () => {
    const { columns, rows } = Deno.consoleSize();
    return renderWorkbenchScreen(toRenderState(), columns, rows);
  };

  const screen = signal(currentScreen());
  // "wrap" (the Style default) blanks any line starting with a space
  // (upstream @tui/nice bug); our lines are already fixed-width, so disable it.
  const root = new Style({ string: (text) => text, text: { wrap: "nowrap" } })
    .create(screen);
  const redraw = () => {
    screen.set(currentScreen());
    // StyleBlock only auto-sizes once; without resetting these, later
    // content is force-fit (and silently clipped) to the first frame's size.
    root.contentWidth = undefined;
    root.contentHeight = undefined;
  };
  let editGeneration = 0;
  let compiling = false;
  let recompileTimer: ReturnType<typeof setTimeout> | undefined;
  const RECOMPILE_DEBOUNCE_MS = 300;

  const refreshVisualization = async (): Promise<void> => {
    await workbench.execute({ action: "visualize" });
    state.previewScroll = 0;
    state.status = workbench.session.compilation?.ok
      ? "compiled"
      : "parse error";
  };

  const openWorkspace = (workspaceRoot: string) => {
    state.workspaceRoot = workspaceRoot;
    state.tree = loadEntries(workspaceRoot);
    state.cursorIndex = 0;
    state.screen = "workspace";
    state.mode = "files";
    state.landingError = undefined;
    state.status = "ready";
  };

  const openFile = async (path: string): Promise<void> => {
    if (recompileTimer !== undefined) {
      clearTimeout(recompileTimer);
      recompileTimer = undefined;
    }
    const result = await workbench.execute({ action: "open", path });
    if (result.ok) {
      state.openFilePath = path;
      state.editor = {
        source: workbench.session.source,
        cursor: workbench.session.source.length,
      };
      state.mode = "editor";
      await refreshVisualization();
    } else {
      state.status = result.error.message;
    }
  };

  const recompile = async (): Promise<void> => {
    editGeneration++;
    if (compiling) return;
    compiling = true;
    try {
      // Coalesce overlapping edits: always compile the latest editor buffer.
      while (true) {
        const seen = editGeneration;
        const source = state.editor.source;
        await workbench.execute({ action: "set-source", source });
        await workbench.execute({ action: "visualize" });
        if (seen !== editGeneration) continue;
        state.previewScroll = 0;
        state.status = workbench.session.compilation?.ok
          ? "compiled"
          : "parse error";
        redraw();
        return;
      }
    } finally {
      compiling = false;
    }
  };

  const scheduleRecompile = (): void => {
    state.status = "pending";
    if (recompileTimer !== undefined) clearTimeout(recompileTimer);
    recompileTimer = setTimeout(() => {
      recompileTimer = undefined;
      void recompile();
    }, RECOMPILE_DEBOUNCE_MS);
  };

  const flushRecompile = async (): Promise<void> => {
    if (recompileTimer !== undefined) {
      clearTimeout(recompileTimer);
      recompileTimer = undefined;
    }
    await recompile();
  };

  const saveFile = async (): Promise<void> => {
    // Ensure the on-disk write matches the editor buffer even if a prior
    // recompile was superseded by a newer edit generation.
    if (recompileTimer !== undefined) {
      clearTimeout(recompileTimer);
      recompileTimer = undefined;
    }
    await workbench.execute({
      action: "set-source",
      source: state.editor.source,
    });
    const result = await workbench.execute({ action: "save" });
    state.status = result.ok ? "saved" : result.error.message;
  };

  if (contract.inputPaths[0] !== undefined) {
    const filePath = resolve(contract.cwd, contract.inputPaths[0]);
    openWorkspace(dirname(filePath));
    await openFile(filePath);
    redraw();
  }

  tui.addEventListener("key", (keyPress) => {
    void (async () => {
      if (state.screen === "landing") {
        if (keyPress.key === "return") {
          const candidate = resolve(
            contract.cwd,
            state.pathInput.source || ".",
          );
          try {
            if (!Deno.statSync(candidate).isDirectory) {
              throw new Error("not a directory");
            }
            openWorkspace(candidate);
          } catch (error) {
            state.landingError = `Unable to open folder: ${
              errorMessage(error)
            }`;
          }
          redraw();
          return;
        }
        const next = applyEditorKey(state.pathInput, keyPress);
        if (next === state.pathInput) return;
        state.pathInput = next;
        redraw();
        return;
      }

      if (keyPress.key === "escape") {
        if (state.mode !== "files") {
          state.mode = "files";
        } else {
          state.screen = "landing";
        }
        redraw();
        return;
      }

      if (keyPress.key === "tab" && keyPress.shift) {
        if (state.mode === "editor") {
          await flushRecompile();
          state.mode = "preview";
        } else if (state.mode === "preview") {
          state.mode = "editor";
        } else if (state.mode === "files" && state.openFilePath !== undefined) {
          state.mode = "editor";
        }
        redraw();
        return;
      }

      if (state.mode === "files") {
        const visible = flattenEntries(state.tree);
        if (keyPress.key === "up") {
          state.cursorIndex = Math.max(0, state.cursorIndex - 1);
          redraw();
          return;
        }
        if (keyPress.key === "down") {
          state.cursorIndex = Math.min(
            Math.max(0, visible.length - 1),
            state.cursorIndex + 1,
          );
          redraw();
          return;
        }
        if (keyPress.key === "right") {
          const selected = visible[state.cursorIndex];
          if (selected?.entry.isDirectory && !selected.entry.expanded) {
            toggleExpand(selected.entry);
            redraw();
          }
          return;
        }
        if (keyPress.key === "left") {
          const selected = visible[state.cursorIndex];
          if (selected?.entry.isDirectory && selected.entry.expanded) {
            toggleExpand(selected.entry);
            redraw();
          }
          return;
        }
        if (keyPress.key === "return") {
          const selected = visible[state.cursorIndex];
          if (!selected) return;
          if (selected.entry.isDirectory) {
            toggleExpand(selected.entry);
          } else {
            await openFile(selected.entry.path);
          }
          redraw();
        }
        return;
      }

      if (state.mode === "preview") {
        const lines = (workbench.session.visualization ?? "").split("\n");
        if (keyPress.key === "up") {
          state.previewScroll = Math.max(0, state.previewScroll - 1);
          redraw();
          return;
        }
        if (keyPress.key === "down") {
          state.previewScroll = Math.min(
            Math.max(0, lines.length - 1),
            state.previewScroll + 1,
          );
          redraw();
          return;
        }
        return;
      }

      if (state.mode === "editor") {
        if (keyPress.ctrl && keyPress.key === "s") {
          await saveFile();
          redraw();
          return;
        }
        const next = applyEditorKey(state.editor, keyPress);
        if (next === state.editor) return;
        const sourceChanged = next.source !== state.editor.source;
        state.editor = next;
        // Paint the keystroke immediately; compile after a short idle pause.
        if (sourceChanged) scheduleRecompile();
        redraw();
      }
    })();
  });

  // @tui/tui handles Ctrl+C by exiting raw mode and restoring the primary
  // buffer via its sanitizers before render() resolves.
  await tui.render(() => root);
  await workbench.execute({ action: "end" });
}
