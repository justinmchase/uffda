import { tests } from "../../test.ts";
import { NewLine } from "./NewLine.ts";

tests(() => [
  {
    id: "NEWLINE00",
    description: "can match slash n",
    module: () => NewLine,
    input: "\n",
    value: "\n",
  },
  {
    id: "NEWLINE01",
    description: "can match slash r",
    module: () => NewLine,
    input: "\r",
    value: "\n",
  },
  {
    id: "NEWLINE02",
    description: "can match slash r slash n",
    module: () => NewLine,
    input: "\r\n",
    value: "\n",
  },
  {
    id: "NEWLINE03",
    description: "slash r slash n is two different new lines",
    module: () => NewLine,
    input: "\n\r",
    value: "\n",
    done: false,
  },
]);
