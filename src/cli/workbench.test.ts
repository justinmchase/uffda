import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  CliWorkbench,
  CliWorkbenchFailureCode,
  runWorkbenchProtocol,
  workbenchBanner,
} from "./workbench.ts";

Deno.test("cli.workbench renders an eleven-line ascii art banner", () => {
  const banner = workbenchBanner();
  const rows = banner.split("\n");

  assertEquals(rows.length, 11);
  assertEquals(new Set(rows.map((row) => row.length)).size, 1);
  assertStringIncludes(
    banner,
    "a parser generator for domain specific languages",
  );
});

Deno.test("cli.workbench manages deterministic in-memory sessions", async (t) => {
  const files = new Map<string, string>([
    ["/workspace/project/input.pattern", "any"],
  ]);
  const fileSystem = {
    readTextFile(path: string): Promise<string> {
      const value = files.get(path);
      if (value === undefined) throw new Error("not found");
      return Promise.resolve(value);
    },
    writeTextFile(path: string, content: string): Promise<void> {
      files.set(path, content);
      return Promise.resolve();
    },
  };

  await t.step("starts, edits, compiles, and ends a session", async () => {
    const workbench = new CliWorkbench("/workspace/project", fileSystem);
    const started = await workbench.execute({
      action: "start",
      language: "pattern",
      source: "any",
    });
    assertEquals(started.ok, true);
    if (!started.ok) return;
    assertEquals(started.event, "started");
    assertEquals(started.session.compilation?.ok, true);

    const updated = await workbench.execute({
      action: "set-source",
      source: "number",
    });
    assertEquals(updated.ok, true);
    if (!updated.ok) return;
    assertEquals(updated.session.source, "number");
    assertEquals(updated.session.compilation?.ok, true);

    const ended = await workbench.execute({ action: "end" });
    assertEquals(ended.ok, true);
    if (!ended.ok) return;
    assertEquals(ended.session.active, false);
  });

  await t.step("opens, saves, and exports ASTs", async () => {
    const workbench = new CliWorkbench("/workspace/project", fileSystem);
    await workbench.execute({ action: "start", language: "pattern" });

    const opened = await workbench.execute({
      action: "open",
      path: "input.pattern",
    });
    assertEquals(opened.ok, true);
    if (!opened.ok) return;
    assertEquals(opened.session.source, "any");

    const saved = await workbench.execute({
      action: "save",
      path: "saved.pattern",
    });
    assertEquals(saved.ok, true);
    assertEquals(files.get("/workspace/project/saved.pattern"), "any");

    const exported = await workbench.execute({
      action: "export-ast",
      path: "saved.json",
    });
    assertEquals(exported.ok, true);
    assertEquals(
      JSON.parse(files.get("/workspace/project/saved.json") ?? "{}").kind,
      "any",
    );
  });

  await t.step("preserves state when file operations fail", async () => {
    const workbench = new CliWorkbench("/workspace/project", fileSystem);
    await workbench.execute({
      action: "start",
      language: "pattern",
      source: "any",
    });

    const result = await workbench.execute({ action: "open", path: "none" });
    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.error.code, CliWorkbenchFailureCode.FileIo);
    assertEquals(result.session.source, "any");
  });

  await t.step("emits one response for each protocol command", async () => {
    const output = await runWorkbenchProtocol(
      '{"action":"start","language":"pattern","source":"any"}\n' +
        '{"action":"status"}\n' +
        '{"action":"end"}\n',
      "/workspace/project",
    );
    const responses = output.trim().split("\n").map((line) =>
      JSON.parse(line)
    ) as Array<{ event: string; session: { active: boolean; source: string } }>;
    assertEquals(responses.map((response) => response.event), [
      "started",
      "status",
      "ended",
    ]);
    assertEquals(responses[0].session.active, true);
    assertEquals(responses[0].session.source, "any");
    assertEquals(responses[2].session.active, false);
    assertEquals(responses[2].session.source, "any");
  });

  await t.step("visualizes successful and failed compilation", async () => {
    const workbench = new CliWorkbench("/workspace/project", fileSystem);
    await workbench.execute({
      action: "start",
      language: "pattern",
      source: "any",
    });

    const success = await workbench.execute({ action: "visualize" });
    assertEquals(success.ok, true);
    if (!success.ok) return;
    assertStringIncludes(
      success.session.visualization ?? "",
      "Status: succeeded",
    );
    assertStringIncludes(success.session.visualization ?? "", '"kind": "any"');

    await workbench.execute({ action: "set-source", source: "(" });
    const failure = await workbench.execute({ action: "visualize" });
    assertEquals(failure.ok, true);
    if (!failure.ok) return;
    assertStringIncludes(failure.session.visualization ?? "", "Status: failed");
    assertStringIncludes(failure.session.visualization ?? "", "Phase: parse");
  });

  await t.step("renders match failure visualization", async () => {
    const workbench = new CliWorkbench("/workspace/project", fileSystem);
    await workbench.execute({
      action: "start",
      language: "pattern",
      source: '"expected"',
    });

    const result = await workbench.execute({
      action: "match",
      input: "actual",
    });
    assertEquals(result.ok, true);
    if (!result.ok) return;
    assertStringIncludes(result.session.visualization ?? "", "Match failure");
    assertStringIncludes(
      result.session.visualization ?? "",
      'Expected: "expected"',
    );
  });
});
