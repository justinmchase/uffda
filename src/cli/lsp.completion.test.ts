import { assertEquals } from "@std/assert";
import { CompletionItemKind } from "vscode-languageserver-types";
import {
  completionItemsForModule,
  completionItemsForSession,
} from "./lsp.completion.ts";
import { RuntimeSession } from "./mcp.session.ts";

Deno.test("cli.lsp.completion completionItemsForModule", async (t) => {
  await t.step("maps each declaration kind and export flag", () => {
    const items = completionItemsForModule({
      moduleUrl: "file:///x.uff",
      declarations: [
        { name: "Main", kind: "rule", exported: true },
        { name: "Greet", kind: "func", exported: false },
        { name: "Loud", kind: "decorator", exported: true },
      ],
    });
    assertEquals(items, [
      {
        label: "Main",
        kind: CompletionItemKind.Function,
        detail: "exported rule",
      },
      { label: "Greet", kind: CompletionItemKind.Method, detail: "func" },
      {
        label: "Loud",
        kind: CompletionItemKind.Property,
        detail: "exported decorator",
      },
    ]);
  });

  await t.step("drops duplicate name/kind pairs", () => {
    const items = completionItemsForModule({
      moduleUrl: "file:///x.uff",
      declarations: [
        { name: "Foo", kind: "rule", exported: false },
        { name: "Foo", kind: "rule", exported: false },
      ],
    });
    assertEquals(items.length, 1);
  });
});

Deno.test("cli.lsp.completion completionItemsForSession", async (t) => {
  await t.step("offers every in-scope declaration name", async () => {
    const session = new RuntimeSession("completion-1");
    const load = await session.load(
      `export Main Loud Greet;
decorator Loud = { shout: true };
[Loud]
rule Main = any;
func Greet = "hi";`,
    );
    assertEquals(load.ok, true);
    const labels = completionItemsForSession(session)
      .map((item) => item.label)
      .sort();
    assertEquals(labels, ["Greet", "Loud", "Main"]);
  });

  await t.step("returns no items before anything has resolved", async () => {
    const session = new RuntimeSession("completion-2");
    await session.load("rule Main = ");
    assertEquals(completionItemsForSession(session), []);
  });
});
