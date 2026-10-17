import { assert, assertEquals, assertExists } from "@std/assert";
import { CliLanguage } from "./contract.ts";
import {
  AuthoringContextFailureCode,
  authoringContextToolHandler,
  scoreEvidence,
  taskTokens,
} from "./mcp.authoring_context.ts";
import { AUTHORING_EVIDENCE } from "./mcp.authoring_evidence.ts";

Deno.test(
  "req:mcp-server-013 - empty task fails with a validate-phase error",
  () => {
    const result = authoringContextToolHandler({ task: "   " });
    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.error.code, AuthoringContextFailureCode.InvalidTask);
    assertEquals(result.error.phase, "validate");
    assert(result.error.message.includes("task"));
  },
);

Deno.test(
  "req:mcp-server-013 - success shape includes syntax, semantics, expressibility, sources",
  () => {
    const result = authoringContextToolHandler({
      task: "write an expression that reduces a list of numbers",
      language: CliLanguage.Expression,
    });
    assertEquals(result.ok, true);
    if (!result.ok) return;

    assertEquals(
      result.task,
      "write an expression that reduces a list of numbers",
    );
    assertEquals(result.language, CliLanguage.Expression);
    assert(Array.isArray(result.syntax));
    assert(Array.isArray(result.semantics));
    assert(Array.isArray(result.restrictions));
    assertExists(result.expressibility);
    assert(
      ["supported", "partially_supported", "unsupported", "uncertain"].includes(
        result.expressibility.status,
      ),
    );
    assert(result.sources.length > 0, "expected cited sources");
    for (const source of result.sources) {
      assert(source.path.length > 0);
      assert(source.excerpt.length > 0);
    }
    // Live globals should include reduce when the task names it.
    assert(
      result.relevantGlobals.some((g) => g.name === "reduce"),
      `expected reduce among globals: ${
        result.relevantGlobals.map((g) => g.name).join(",")
      }`,
    );
  },
);

Deno.test(
  "req:mcp-server-013 - retrieval is task-relevant, not a fixed dump",
  () => {
    const reduce = authoringContextToolHandler({
      task: "fold a collection with reduce and a lambda",
    });
    const recurse = authoringContextToolHandler({
      task: "write a left-recursive rule for nested expressions",
    });
    assert(reduce.ok && recurse.ok);
    if (!reduce.ok || !recurse.ok) return;

    const reduceIds = new Set([
      ...reduce.syntax.map((s) => s.id),
      ...reduce.semantics.map((s) => s.id),
    ]);
    const recurseIds = new Set([
      ...recurse.syntax.map((s) => s.id),
      ...recurse.semantics.map((s) => s.id),
      ...recurse.restrictions.map((s) => s.id),
    ]);

    assert(
      reduceIds.has("global-reduce-map") || reduceIds.has("expr-lambda-syntax"),
      `reduce task should surface reduce/lambda evidence, got ${
        [...reduceIds].join(",")
      }`,
    );
    assert(
      recurseIds.has("left-recursion"),
      `recursion task should surface left-recursion evidence, got ${
        [...recurseIds].join(",")
      }`,
    );
    assert(
      !recurseIds.has("no-sort-global"),
      "recursion task must not pull in sort-specific unsupported claims",
    );
  },
);

Deno.test(
  "req:mcp-server-013 - sorting an array of numbers reports only evidenced capabilities",
  () => {
    const result = authoringContextToolHandler({
      task: "sort an array of numbers (bubble sort with element swaps)",
      language: CliLanguage.Expression,
    });
    assertEquals(result.ok, true);
    if (!result.ok) return;

    const { expressibility } = result;
    assertEquals(expressibility.status, "partially_supported");

    const supportedCaps = expressibility.supported.map((c) => c.capability);
    const unsupportedCaps = expressibility.unsupported.map((c) => c.capability);
    const uncertainCaps = expressibility.uncertain.map((c) => c.capability);

    assert(
      supportedCaps.some((c) => c.includes("compare")),
      `expected compare among supported: ${supportedCaps.join(" | ")}`,
    );
    assert(
      supportedCaps.some((c) =>
        c.includes("reduce") || c.includes("at") || c.includes("slice")
      ),
      `expected collection primitives among supported: ${
        supportedCaps.join(" | ")
      }`,
    );
    assert(
      unsupportedCaps.some((c) => c.includes("`sort`")),
      `expected missing sort global: ${unsupportedCaps.join(" | ")}`,
    );
    assert(
      unsupportedCaps.some((c) =>
        c.toLowerCase().includes("mutation") || c.toLowerCase().includes("swap")
      ),
      `expected missing in-place swap/mutation: ${unsupportedCaps.join(" | ")}`,
    );
    assert(
      uncertainCaps.some((c) => c.toLowerCase().includes("sort")),
      `expected uncertain full sort algorithm: ${uncertainCaps.join(" | ")}`,
    );

    // No invented sort global in the live inventory slice.
    assertEquals(
      result.relevantGlobals.some((g) => g.name === "sort"),
      false,
    );
    assert(result.relevantGlobals.some((g) => g.name === "compare"));

    // Every claim cites a source with a path (and preferably resolved lines).
    for (
      const claim of [
        ...expressibility.supported,
        ...expressibility.unsupported,
        ...expressibility.uncertain,
      ]
    ) {
      assert(claim.sources.length > 0, claim.capability);
      assert(
        claim.sources.some((s) => s.startLine !== undefined),
        `expected resolvable line numbers for ${claim.capability}`,
      );
    }
  },
);

Deno.test(
  "req:mcp-server-013 - task token expansion and evidence scoring stay local",
  () => {
    const tokens = taskTokens("bubble sort numbers");
    assert(tokens.includes("sort"));
    assert(tokens.includes("compare"));
    assert(tokens.includes("swap"));

    const sortEntry = AUTHORING_EVIDENCE.find((e) => e.id === "no-sort-global");
    assertExists(sortEntry);
    assert(scoreEvidence(sortEntry, tokens) > 0);

    const recurseEntry = AUTHORING_EVIDENCE.find((e) =>
      e.id === "left-recursion"
    );
    assertExists(recurseEntry);
    assertEquals(scoreEvidence(recurseEntry, tokens), 0);
  },
);
