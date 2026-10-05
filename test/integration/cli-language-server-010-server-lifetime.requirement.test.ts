// Traces to
// `.agents/requirements/cli-language-server/010-server-lifetime.requirement.md`.
// An integration test because it runs `uffda lsp` as its own process with the
// release binary's permissions.

import { assertEquals } from "@std/assert";
import { fromFileUrl, toFileUrl } from "@std/path";
import { CLI_COMPILE_PERMISSION_FLAGS } from "../../src/cli/distribution.ts";

const main = fromFileUrl(new URL("../../src/cli/main.ts", import.meta.url));

/** Frames and parses the LSP messages of one server process. */
class LspProcess {
  readonly #child: Deno.ChildProcess;
  readonly #writer: WritableStreamDefaultWriter<Uint8Array>;
  readonly #reader: ReadableStreamDefaultReader<Uint8Array>;
  #buffer = new Uint8Array();

  constructor(cwd: string) {
    this.#child = new Deno.Command("deno", {
      args: ["run", ...CLI_COMPILE_PERMISSION_FLAGS, main, "lsp"],
      cwd,
      stdin: "piped",
      stdout: "piped",
      stderr: "null",
    }).spawn();
    this.#writer = this.#child.stdin.getWriter();
    this.#reader = this.#child.stdout.getReader();
  }

  async send(message: Record<string, unknown>): Promise<void> {
    const body = new TextEncoder().encode(
      JSON.stringify({ jsonrpc: "2.0", ...message }),
    );
    await this.#writer.write(
      new TextEncoder().encode(`Content-Length: ${body.length}\r\n\r\n`),
    );
    await this.#writer.write(body);
  }

  /** The next message with `id`, skipping notifications. */
  async response(id: number): Promise<Record<string, unknown>> {
    while (true) {
      const message = await this.#next();
      if (message.id === id) return message;
    }
  }

  async #next(): Promise<Record<string, unknown>> {
    while (true) {
      const text = new TextDecoder().decode(this.#buffer);
      const headerEnd = text.indexOf("\r\n\r\n");
      if (headerEnd !== -1) {
        const length = Number(/Content-Length: (\d+)/.exec(text)![1]);
        const start = new TextEncoder().encode(text.slice(0, headerEnd + 4))
          .length;
        if (this.#buffer.length >= start + length) {
          const body = this.#buffer.slice(start, start + length);
          this.#buffer = this.#buffer.slice(start + length);
          return JSON.parse(new TextDecoder().decode(body));
        }
      }
      const { value, done } = await this.#reader.read();
      if (done) throw new Error("the server closed standard output");
      const joined = new Uint8Array(this.#buffer.length + value.length);
      joined.set(this.#buffer);
      joined.set(value, this.#buffer.length);
      this.#buffer = joined;
    }
  }

  /** Closes standard input and returns the exit code. */
  async close(): Promise<number> {
    await this.#writer.close();
    this.#reader.releaseLock();
    await this.#child.stdout.cancel();
    return (await this.#child.status).code;
  }
}

Deno.test(
  "req:cli-language-server-010 - the server outlives a parent-process check and exits when standard input closes",
  async () => {
    const cwd = await Deno.makeTempDir();
    try {
      const server = new LspProcess(cwd);
      await server.send({
        id: 1,
        method: "initialize",
        params: {
          processId: Deno.pid,
          rootUri: toFileUrl(cwd).href,
          capabilities: {},
        },
      });
      await server.response(1);
      await server.send({ method: "initialized", params: {} });

      await new Promise((resolve) => setTimeout(resolve, 4000));

      await server.send({ id: 2, method: "shutdown" });
      assertEquals((await server.response(2)).result, null);
      assertEquals(await server.close(), 0);
    } finally {
      await Deno.remove(cwd, { recursive: true });
    }
  },
);

Deno.test(
  "req:cli-language-server-010 - closing standard input without shutdown exits with code 1",
  async () => {
    const cwd = await Deno.makeTempDir();
    try {
      const server = new LspProcess(cwd);
      await server.send({
        id: 1,
        method: "initialize",
        params: { processId: Deno.pid, rootUri: null, capabilities: {} },
      });
      await server.response(1);
      assertEquals(await server.close(), 1);
    } finally {
      await Deno.remove(cwd, { recursive: true });
    }
  },
);
