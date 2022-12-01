import { integration } from "../../integration.ts";

Deno.test(integration({
  moduleUrl: "./Digit.uff",
  input: "1",
  expected: "1",
}));

Deno.test(integration({
  moduleUrl: "./Digit.uff",
  input: "*",
  matched: false,
  done: false,
}));

Deno.test(integration({
  moduleUrl: "./Digit.uff",
  input: "12",
  expected: "1",
  done: false,
}));
Deno.test(integration({
  moduleUrl: "./Digit.uff",
  input: "1m",
  expected: "1",
  done: false,
}));
