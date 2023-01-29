import { integration } from "../../integration.ts";

Deno.test({
  name: "DIGIT00",
  ...integration({
    moduleUrl: "./Digit.uff",
    input: "1",
    expected: "1",
  })
});


Deno.test({
  name: "DIGIT01",
  ...integration({
    moduleUrl: "./Digit.uff",
    input: "*",
    matched: false,
    done: false,
  })
});


Deno.test({
  name: "DIGIT02",
  ...integration({
    moduleUrl: "./Digit.uff",
    input: "12",
    expected: "1",
    done: false,
  })
});


Deno.test({
  name: "DIGIT03",
  ...integration({
    moduleUrl: "./Digit.uff",
    input: "1m",
    expected: "1",
    done: false,
  })
});
