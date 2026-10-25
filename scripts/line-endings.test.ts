import { execFileSync } from "node:child_process";
import { deepStrictEqual } from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("req:cli-distribution-008 - tracked text files use LF in the index and working tree", () => {
  const entries = execFileSync("git", ["ls-files", "--eol", "-z"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    encoding: "utf8",
  }).split("\0");
  const invalid = entries.filter((entry) =>
    /\b[iw]\/(?:crlf|mixed)\b/.test(entry.split("\t", 1)[0]),
  );
  deepStrictEqual(
    invalid,
    [],
    "Tracked text files must use LF, not CRLF or mixed endings",
  );
});
