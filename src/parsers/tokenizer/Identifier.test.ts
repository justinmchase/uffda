import { integration } from "../../integration.ts";

const identifier = {
  importMetaUrl: import.meta.url,
  area: "tokenizer",
  name: "identifier",
  moduleUrl: "./Identifier.uff",
};

Deno.test(integration({
  ...identifier,
  index: 0,
  input: "Test",
  expected: "Test",
}));
Deno.test(integration({
  ...identifier,
  index: 1,
  input: "Test123",
  expected: "Test123",
}));
Deno.test(integration({
  ...identifier,
  index: 2,
  input: "123Test",
  matched: false,
  done: false,
}));
Deno.test(integration({
  ...identifier,
  index: 3,
  input: "a",
  expected: "a",
}));
Deno.test(integration({
  ...identifier,
  index: 4,
  input: "a1b2c3",
  expected: "a1b2c3",
}));
Deno.test(integration({
  ...identifier,
  index: 5,
  input: "a.b",
  expected: "a",
  done: false,
}));
