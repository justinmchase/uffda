import { integration } from "../../integration.ts";

Deno.test({
  name: 'IDENTIFIER00',
  ...integration({
    moduleUrl: "./Identifier.uff",
    input: "Test",
    expected: "Test",
  })
});
Deno.test({
  name: 'IDENTIFIER01',
  ...integration({
    moduleUrl: "./Identifier.uff",
    input: "Test123",
    expected: "Test123",
  })
});
Deno.test({
  name: 'IDENTIFIER02',
  ...integration({
    moduleUrl: "./Identifier.uff",
    input: "123Test",
    matched: false,
    done: false,
  })
});
Deno.test({
  name: 'IDENTIFIER03',
  ...integration({
    moduleUrl: "./Identifier.uff",
    input: "a",
    expected: "a",
  })
});
Deno.test({
  name: 'IDENTIFIER04',
  ...integration({
    moduleUrl: "./Identifier.uff",
    input: "a1b2c3",
    expected: "a1b2c3",
  })
});
Deno.test({
  name: 'IDENTIFIER05',
  ...integration({
    moduleUrl: "./Identifier.uff",
    input: "a.b",
    expected: "a",
    done: false,
  })
});
