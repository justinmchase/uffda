import { assertEquals } from "@std/assert";
import {
  artifactFileName,
  DENO_COMPILE_TARGETS,
  targetFromRunner,
} from "../../cli/distribution.ts";

Deno.test(
  "req:cli-distribution-001 - deno compile target matrix and artifact names",
  () => {
    assertEquals(DENO_COMPILE_TARGETS.length, 6);
    for (const target of DENO_COMPILE_TARGETS) {
      const name = artifactFileName("0.1.2", target);
      assertEquals(name.startsWith("uffda-0.1.2-"), true);
      assertEquals(name.includes(target), true);
      assertEquals(name.endsWith(".exe"), target.includes("windows"));
    }

    assertEquals(
      targetFromRunner("Linux", "X64"),
      "x86_64-unknown-linux-gnu",
    );
  },
);
