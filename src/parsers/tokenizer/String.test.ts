import { integration } from "../../integration.ts";

Deno.test({
  name: "STRING00",
  ...integration({
    moduleUrl: "./String.uff",
    input: "''",
    expected: "",
  }),
});
Deno.test({
  name: "STRING01",
  ...integration({
    moduleUrl: "./String.uff",
    input: "'a'",
    expected: "a",
  }),
});
Deno.test({
  name: "STRING02",
  ...integration({
    moduleUrl: "./String.uff",
    input: "'abc'",
    expected: "abc",
  }),
});
Deno.test({
  name: "STRING03",
  ...integration({
    moduleUrl: "./String.uff",
    input: "'abc\\'xyz'",
    expected: "abc'xyz",
  }),
});
Deno.test({
  name: "STRING04",
  ...integration({
    moduleUrl: "./String.uff",
    input: "'\\''",
    expected: "'",
  }),
});
Deno.test({
  name: "STRING05",
  ...integration({
    moduleUrl: "./String.uff",
    input: "'\"'",
    expected: '"',
  }),
});
Deno.test({
  name: "STRING05",
  ...integration({
    moduleUrl: "./String.uff",
    input: "'\n'",
    expected: "\n",
  }),
});
Deno.test({
  name: "STRING05",
  ...integration({
    moduleUrl: "./String.uff",
    input: "'\t'",
    expected: "\t",
  }),
});
Deno.test({
  name: "STRING06",
  ...integration({
    moduleUrl: "./String.uff",
    input: "'\\n'",
    expected: "\\n",
  }),
});
