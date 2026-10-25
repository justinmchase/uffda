import { access, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deepStrictEqual, rejects } from "node:assert/strict";
import test from "node:test";
import { compileLanguages } from "./compile-lang.ts";

test("req:cli-bootstrap-007 - compile:lang clears bin before invoking the published CLI", async () => {
  const root = await mkdtemp(join(tmpdir(), "uffda-compile-lang-"));
  try {
    await mkdir(join(root, "bin"));
    const calls: Array<{ cwd: string; command: string; args: string[] }> = [];
    await compileLanguages(root, async (cwd, command, args) => {
      calls.push({ cwd, command, args });
    });
    deepStrictEqual(calls, [
      {
        cwd: root,
        command: "uffda",
        args: ["compile", "src/lang/**/*.uff"],
      },
    ]);
    await rejects(access(join(root, "bin")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("req:cli-bootstrap-007 - compile:lang surfaces published CLI failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "uffda-compile-lang-fail-"));
  try {
    await rejects(
      compileLanguages(root, async () => {
        throw new Error("compiler failed");
      }),
      /compiler failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
