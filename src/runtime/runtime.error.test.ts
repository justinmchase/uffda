import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  RuntimeError,
  RuntimeErrorCode,
  RuntimeErrorMessages,
} from "./runtime.error.ts";
import { MatchErrorCode } from "../match.ts";
import { Scope } from "./scope.ts";

Deno.test("runtime.error", async (t) => {
  await t.step("RUNTIME_ERROR00 every code has a message", () => {
    assertEquals(
      Object.keys(RuntimeErrorMessages).sort(),
      Object.values(RuntimeErrorCode).sort(),
    );
  });

  await t.step("RUNTIME_ERROR01 message is prefixed with its code", () => {
    const err = new RuntimeError(
      RuntimeErrorCode.PatternNotFound,
      Scope.Default(),
      {
        metadata: { name: "Main" },
      },
    );
    assertStringIncludes(err.message, "E_PATTERN_NOT_FOUND");
    assertStringIncludes(err.message, "(Main)");
  });

  await t.step("RUNTIME_ERROR02 left recursion has no error code", () => {
    const codes: string[] = [
      ...Object.values(RuntimeErrorCode),
      ...Object.values(MatchErrorCode),
    ];
    assertEquals(codes.includes("E_INDIRECT_LEFT_RECURSION"), false);
  });
});
