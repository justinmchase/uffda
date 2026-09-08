import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-026 - member .uff uses DLR with nested Projection",
  async () => {
    const member = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "expression", "member.uff"),
    );
    assertEquals(member.includes("export Member"), true);
    assertEquals(member.includes("e:Member"), true);
    assertEquals(member.includes("n:Token<Reference>"), true);
    assertEquals(
      member.includes('{ kind: "member", expression: e, name: n.name }'),
      true,
    );
    assertEquals(member.includes("| Token<MemberTarget>"), false);
    assertEquals(
      member.includes(
        'b:Token<MemberTarget> "." n:Token<Reference> -> { kind: "member", expression: b, name: n.name }',
      ),
      true,
    );
    assertEquals(member.includes(".reduce"), false);
    assertEquals(member.includes("for ("), false);

    const primary = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "expression", "primary.uff"),
    );
    assertEquals(primary.includes('import "./member.uff" Member'), true);
  },
);
