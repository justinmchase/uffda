import { integration } from "../../integration.ts";

Deno.test({
  name: "NEWLINE00",
  ...integration({
    moduleUrl: "./NewLine.uff",
    input: "\n",
    expected: "\n",
  }),
});
Deno.test({
  name: "NEWLINE01",
  ...integration({
    moduleUrl: "./NewLine.uff",
    input: "\r\n",
    expected: "\n",
  }),
});
Deno.test({
  name: "NEWLINE02",
  ...integration({
    moduleUrl: "./NewLine.uff",
    input: "\r",
    expected: "\n",
  }),
});
Deno.test({
  name: "NEWLINE03",
  ...integration({
    moduleUrl: "./NewLine.uff",
    input: "\n\r",
    done: false,
    expected: "\n",
  }),
});
