import { assertEquals } from "@std/assert";
import { memberChain } from "./memberChain.ts";

Deno.test("std.memberChain left-folds reference segments into member AST", () => {
  assertEquals(
    memberChain({ kind: "reference", name: "user" }, [
      { name: "profile" },
      { name: "name" },
    ]),
    {
      kind: "member",
      expression: {
        kind: "member",
        expression: { kind: "reference", name: "user" },
        name: "profile",
      },
      name: "name",
    },
  );
});
