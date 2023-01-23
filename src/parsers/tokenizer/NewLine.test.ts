import { integration } from "../../integration.ts";

Deno.test(integration({
  moduleUrl: "./NewLine.uff",
  input: "\n",
  expected: "\n",
}));
Deno.test(integration({
  moduleUrl: "./NewLine.uff",
  input: "\r\n",
  expected: "\n",
}));
Deno.test(integration({
  moduleUrl: "./NewLine.uff",
  input: "\r",
  expected: "\n",
}));
Deno.test(integration({
  moduleUrl: "./NewLine.uff",
  input: "\n\r",
  done: false,
  expected: "\n",
}));
