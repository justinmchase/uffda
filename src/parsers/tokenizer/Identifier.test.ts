import { integration } from "../../integration.ts";

Deno.test(integration({
  moduleUrl: "./Identifier.uff",
  input: "Test",
  expected: "Test",
}));
Deno.test(integration({
  moduleUrl: "./Identifier.uff",
  input: "Test123",
  expected: "Test123",
}));
Deno.test(integration({
  moduleUrl: "./Identifier.uff",
  input: "123Test",
  matched: false,
  done: false,
}));
Deno.test(integration({
  moduleUrl: "./Identifier.uff",
  input: "a",
  expected: "a",
}));
Deno.test(integration({
  moduleUrl: "./Identifier.uff",
  input: "a1b2c3",
  expected: "a1b2c3",
}));
Deno.test(integration({
  moduleUrl: "./Identifier.uff",
  input: "a.b",
  expected: "a",
  done: false,
}));
