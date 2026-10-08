import { assert, assertEquals } from "@std/assert";
import { isClean, valueOf } from "../match.ts";
import { InputNormalizationMode, match, PatternKind, Scope } from "./public.ts";
import type { Pattern } from "./public.ts";

Deno.test(
  "req:cli-distribution-007 - public runtime executes typed patterns",
  async () => {
    const pattern: Pattern = { kind: PatternKind.Any };
    const result = await match(
      pattern,
      Scope.From(["token"], { kind: InputNormalizationMode.Iterable }),
    );
    assert(isClean(result));
    assertEquals(valueOf(result), "token");
  },
);
