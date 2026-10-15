import { relative, resolve } from "@std/path";
import { assertString } from "@justinmchase/type";
import { walk } from "@std/fs";
import { resolveCliProcessContract } from "../../src/cli/contract.ts";
import { runCli } from "../../src/cli/main.ts";

export const commands = ["compile", "exec", "fmt", "match", "parse", "run"];

export function argumentCases(): { name: string; args: string[] }[] {
  const cases: { name: string; args: string[] }[] = [];
  const add = (args: string[]) =>
    cases.push({ name: JSON.stringify(args), args });
  const profiles = [
    [],
    ["--ast"],
    ["--json"],
    ["--check"],
    ["-e", "42"],
    ["--eval", ""],
    ["a.uff"],
    ["a.uff", "b.uff"],
    ["-"],
    ["-", "a.uff"],
    ["--lang", "expression"],
    ["--input", "x"],
    ["--input-json", "42"],
    ["--input-file", "subject.txt"],
    ["--entry", "Main"],
    ["--entry", ""],
    ["--config", "project.jsonc"],
  ];
  for (const command of commands) {
    for (const first of profiles) {
      for (const second of profiles) add([command, ...first, ...second]);
    }
    for (
      const flag of [
        "--mode",
        "--lang",
        "--config",
        "-e",
        "--eval",
        "--input",
        "--input-json",
        "--input-file",
        "--entry",
      ]
    ) {
      add([command, flag]);
      add([command, flag, ""]);
      add([command, "--check", flag]);
      add([command, flag, "run", "--unknown"]);
    }
    for (const flag of ["--mode", "--lang", "--config"]) {
      add([command, `${flag}=`]);
      add([command, `${flag}=missing`]);
    }
    for (const selected of commands) {
      add([command, "--mode", selected]);
      add([command, `--mode=${selected}`]);
      add([command, "--match", "--mode", selected, "--parse"]);
      add([command, "--mode", "parse", "--mode", selected]);
    }
    for (const flag of ["--compile", "--parse", "--match", "--run"]) {
      add([command, flag]);
    }
    for (
      const args of [
        ["--eval", "1", "-e", "42"],
        ["--input", "first", "--input", "last"],
        ["--input-json", "1", "--input-json", "42"],
        ["--input-file", "first.txt", "--input-file", "last.txt"],
        ["--entry", "First", "--entry", "Last"],
        ["--config", "first.jsonc", "--config", "last.jsonc"],
        ["--lang", "pattern", "--lang", "expression"],
        ["--ast", "--ast", "--json", "--json"],
        ["--unknown"],
        ["--ast=true"],
        ["--json=true"],
        ["--check=true"],
        ["--check", "--unknown"],
        ["--check", "--input-file", "/missing", "--unknown"],
      ]
    ) add([command, ...args]);
  }
  for (const command of commands) {
    add(["--mode", command]);
    add([`--mode=${command}`]);
  }
  add(["a.uff"]);
  add(["-"]);
  add(["--parse", "--run"]);
  add(["--run", "--parse"]);
  add(["--mode", "exec", "--parse"]);
  add(["--parse", "--mode", "exec"]);
  return [...new Map(cases.map((entry) => [entry.name, entry])).values()];
}

export function argumentOutcome(args: string[]) {
  const cwd = resolve("/uffda-cli-matrix");
  const result = resolveCliProcessContract({ argv: args, processCwd: cwd });
  if (!result.ok) return { exitCode: result.exitCode, error: result.error };
  const c = result.contract;
  return {
    exitCode: 0,
    options: {
      command: c.command,
      paths: c.inputPaths,
      ast: c.astInput,
      json: c.jsonOutput,
      check: c.check,
      source: c.inlineSource ?? null,
      text: c.matchInput ?? null,
      inputJson: c.matchInputJson ?? null,
      inputFile: c.matchInputPath ?? null,
      language: c.language,
      entry: c.entryRuleName ?? null,
      config: c.configPath === undefined ? null : relative(cwd, c.configPath),
    },
  };
}

export type ExecutionCase = {
  name: string;
  args: string[];
  stdin: string;
  files: Record<string, string>;
  output: "json" | "text" | "help" | "version";
  codecString?: boolean;
  nativeDiagnostics?: boolean;
};

export function executionCases(): ExecutionCase[] {
  const cases: ExecutionCase[] = [];
  const module = "export Main; rule Main = any;";
  const programs = [
    { command: "parse", source: module, flags: [], ast: "" },
    { command: "parse", source: "any", flags: ["--lang", "pattern"], ast: "" },
    {
      command: "parse",
      source: "42",
      flags: ["--lang", "expression"],
      ast: "",
    },
    {
      command: "exec",
      source: "(add 40 2)",
      flags: [],
      ast: '{"kind":"number","value":42}',
    },
    { command: "match", source: "any", flags: [], ast: '{"kind":"any"}' },
    { command: "run", source: module, flags: [], ast: "" },
  ];
  for (const program of programs) {
    for (
      const transport of [
        "stdin",
        "dash",
        "file",
        "-e",
        "--eval",
        "ast-stdin",
        "ast-file",
      ]
    ) {
      if (transport.startsWith("ast-") && program.command === "parse") continue;
      for (const json of [false, true]) {
        const subjects = ["match", "run"].includes(program.command)
          ? [["--input", "x"], ["--input-json", "42"], [
            "--input-file",
            "subject.txt",
          ]]
          : [[]];
        for (const subject of subjects) {
          const args = [
            program.command,
            ...program.flags,
            ...subject,
            ...(json ? ["--json"] : []),
          ];
          const files: Record<string, string> = { "subject.txt": "x" };
          let source = program.source;
          if (transport.startsWith("ast-")) {
            args.push("--ast");
            source = program.ast || "";
          }
          if (transport === "file" || transport === "ast-file") {
            files["source.txt"] = source;
            args.push("source.txt");
          } else if (transport === "dash") args.push("-");
          else if (transport === "-e" || transport === "--eval") {
            args.push(transport, source);
          }
          cases.push({
            name: `${program.command}/${program.flags.join("/")}/${transport}/${
              subject[0] ?? "none"
            }/${json}`,
            args,
            stdin: source,
            files,
            output: !json && ["match", "run"].includes(program.command) &&
                subject[0] !== "--input-json"
              ? "text"
              : "json",
            ...(!json && ["match", "run"].includes(program.command) &&
                subject[0] !== "--input-json"
              ? { codecString: true }
              : {}),
          });
        }
      }
    }
  }
  // Generate module syntax AST through the reference parser, not a hand-lowered artifact.
  for (
    const entry of cases.filter((entry) =>
      entry.args[0] === "run" && entry.args.includes("--ast")
    )
  ) {
    entry.files["module.uff"] = module;
  }
  for (const command of ["exec", "run"]) {
    for (const config of ["implicit", "explicit", "repeated"]) {
      const args = [
        command,
        "-e",
        command === "exec" ? "42" : module,
        "--json",
      ];
      if (command === "run") {
        args.push(
          "--entry",
          "Missing",
          "--entry",
          "Main",
          "--input-json",
          "42",
        );
      }
      if (config === "explicit") args.push("--config", "uffda.jsonc");
      if (config === "repeated") {
        args.push("--config", "missing.jsonc", "--config", "uffda.jsonc");
      }
      cases.push({
        name: `${command}/config/${config}`,
        args,
        stdin: "",
        files: { "uffda.jsonc": '{"imports":{}}' },
        output: "json",
      });
    }
  }
  for (
    const args of [
      ["compile"],
      ["match", "-e", "any"],
      [
        "parse",
        "--lang",
        "expression",
        "-e",
        "42",
        "--lang",
        "pattern",
        "--lang",
        "expression",
      ],
      ["exec", "-e", "1", "--eval", "42", "--json"],
      [
        "match",
        "-e",
        "any",
        "--input-json",
        "1",
        "--input-json",
        "42",
        "--json",
      ],
      ["run", "-e", "export Main; rule Main = 42;", "--json"],
    ]
  ) {
    cases.push({
      name: `special/${JSON.stringify(args)}`,
      args,
      stdin: "",
      files: {},
      output: "json",
    });
  }
  for (
    const args of [["parse", "--lang", "expression", "-e", "42"], [
      "match",
      "-e",
      "any",
      "--input-json",
      "42",
      "--json",
    ]]
  ) {
    cases.push({
      name: `ignore-project/${args[0]}`,
      args,
      stdin: "",
      files: { "uffda.jsonc": "{" },
      output: "json",
    });
  }
  for (
    const args of [
      ["exec", "-e", "(", "--json"],
      ["parse", "--lang", "expression", "-e", "(", "--json"],
      ["parse", "-e", "rule Main =", "--json"],
      ["match", "-e", "(", "--input-file", "missing.txt", "--json"],
      [
        "run",
        "-e",
        "rule Main =",
        "--config",
        "missing.jsonc",
        "--input-file",
        "missing.txt",
        "--json",
      ],
      ["exec", "--ast", "--json"],
      ["match", "--ast", "--input", "x", "--json"],
      ["run", "--ast", "--json"],
      ["exec", "-e", "missingName", "--json"],
      [
        "run",
        "-e",
        module,
        "--entry",
        "Missing",
        "--input-json",
        "42",
        "--json",
      ],
      ["match", "-e", '"a"', "--input", "b", "--json"],
      ["match", "-e", "[42]", "--input-json", "[7]", "--json"],
      ["match", "-e", "{ a: 42 }", "--input-json", '{"a":7}', "--json"],
      ["match", "-e", "any", "--input-json", "{", "--json"],
      ["exec", "missing.expr", "--json"],
      ["match", "-e", "any", "--input-file", "missing.txt", "--json"],
      ["exec", "-e", "42", "--config", "missing.jsonc", "--json"],
      ["compile", "missing.uff"],
      ["compile", "missing*.uff"],
      ["fmt", "missing.uff", "--json"],
      ["fmt", "unsupported.txt", "--json"],
      ["fmt", "broken.uff", "--json"],
      ["compile", "broken.uff"],
    ]
  ) {
    cases.push({
      name: `failure/${JSON.stringify(args)}`,
      args,
      stdin: "{",
      files: { "unsupported.txt": "x", "broken.uff": "rule Main =" },
      output: "json",
      nativeDiagnostics: true,
    });
  }
  for (const check of [false, true]) {
    cases.push({
      name: `fmt/stdin/${check}`,
      args: ["fmt", "-", ...(check ? ["--check"] : [])],
      stdin: "rule Main=any;",
      files: {},
      output: "text",
    });
    for (const transport of ["file.uff", "*.uff", "none"]) {
      cases.push({
        name: `fmt/${transport}/${check}`,
        args: [
          "fmt",
          ...(transport === "none" ? [] : [transport]),
          "--json",
          ...(check ? ["--check"] : []),
        ],
        stdin: "",
        files: { "file.uff": "rule Main=any;" },
        output: "json",
      });
    }
  }
  for (const config of ["implicit", "explicit"]) {
    cases.push({
      name: `compile/${config}`,
      args: [
        "compile",
        "*.uff",
        ...(config === "explicit" ? ["--config", "uffda.jsonc"] : []),
      ],
      stdin: "",
      files: { "file.uff": module, "uffda.jsonc": '{"outDir":"./build"}' },
      output: "json",
    });
  }
  for (const command of commands) {
    for (
      const suffix of [["--help"], ["--version", "--help"], [
        "--eval",
        "--help",
      ], ["--unknown", "-h"]]
    ) {
      cases.push({
        name: `help/${command}/${suffix.join("/")}`,
        args: [command, ...suffix],
        stdin: "",
        files: {},
        output: "help",
      });
    }
    cases.push({
      name: `version/${command}`,
      args: [command, "--input", "--version"],
      stdin: "",
      files: {},
      output: "version",
    });
  }
  for (
    const args of [[], ["--help"], ["--help", "exec", "--mode=run"], [
      "--help",
      "--parse",
      "--mode",
      "exec",
    ], ["--help", "--eval", "run"]]
  ) {
    cases.push({
      name: `help/${JSON.stringify(args)}`,
      args,
      stdin: "",
      files: {},
      output: "help",
    });
  }
  return cases;
}

export function portableOutcome(
  entry: ExecutionCase,
  outcome: unknown,
): unknown {
  if (!entry.nativeDiagnostics) return outcome;
  return JSON.parse(JSON.stringify(outcome, (key, value: unknown) => {
    if (key !== "message") return value;
    assertString(value);
    if (!value.trim()) throw new Error("Diagnostic message must be nonempty");
    return "<native diagnostic text>";
  }));
}

export async function executionOutcome(entry: ExecutionCase, cwd: string) {
  for (const [path, content] of Object.entries(entry.files)) {
    await Deno.writeTextFile(resolve(cwd, path), content);
  }
  let stdin = entry.stdin;
  if (
    entry.args[0] === "run" && entry.args.includes("--ast") &&
    entry.files["module.uff"] !== undefined
  ) {
    const parsed = await runCli(
      ["parse", "-e", entry.files["module.uff"]],
      cwd,
    );
    if (parsed.exitCode !== 0) throw new Error(parsed.stderr);
    if (entry.args.includes("source.txt")) {
      await Deno.writeTextFile(resolve(cwd, "source.txt"), parsed.stdout!);
    } else stdin = parsed.stdout!;
  }
  const result = await runCli(entry.args, cwd, true, stdin);
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const normalize = (source: string) => source.replaceAll(cwd, "<cwd>");
  const files: Record<string, unknown> = {};
  const paths: string[] = [];
  for await (const file of walk(cwd, { includeDirs: false })) {
    paths.push(file.path);
  }
  for (const path of paths.sort()) {
    const content = normalize(await Deno.readTextFile(path));
    files[relative(cwd, path).replaceAll("\\", "/")] = path.endsWith(".json")
      ? JSON.parse(content)
      : content;
  }
  return {
    exitCode: result.exitCode,
    stdout: entry.output === "help"
      ? stdout.split("\n")[0]
      : entry.output === "version"
      ? "<version>"
      : entry.output === "json" && stdout.trim()
      ? JSON.parse(normalize(stdout))
      : normalize(stdout),
    stderr: stderr.trim() ? JSON.parse(normalize(stderr)) : null,
    files,
  };
}

if (import.meta.main) {
  const args = argumentCases().map((entry) => ({
    ...entry,
    expected: argumentOutcome(entry.args),
  }));
  const executions = [];
  for (const entry of executionCases()) {
    const cwd = await Deno.makeTempDir({ prefix: "uffda-cli-matrix-" });
    try {
      const expected = await executionOutcome(entry, cwd);
      const astSource =
        entry.args[0] === "run" && entry.args.includes("--ast") &&
          entry.files["module.uff"] !== undefined
          ? (await runCli(["parse", "-e", entry.files["module.uff"]], cwd))
            .stdout!
          : undefined;
      const rustExpected = entry.codecString && expected.exitCode === 0
        ? {
          ...expected,
          stdout: JSON.stringify(String(expected.stdout).replace(/\n$/, "")) +
            "\n",
        }
        : expected;
      executions.push({
        ...entry,
        ...(astSource === undefined ? {} : { astSource }),
        expected: portableOutcome(entry, expected),
        rustExpected: portableOutcome(entry, rustExpected),
      });
    } finally {
      await Deno.remove(cwd, { recursive: true });
    }
  }
  await Deno.writeTextFile(
    new URL("./cli-compatibility-matrix.json", import.meta.url),
    JSON.stringify({ arguments: args, executions }, null, 2) + "\n",
  );
}
