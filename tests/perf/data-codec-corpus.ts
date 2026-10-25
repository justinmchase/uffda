export type CodecRecord = { codec: string; json: unknown };
export type CodecWorkload = { name: string; records: CodecRecord[] };

function tagged(type: string, value?: unknown): unknown {
  return value === undefined ? { $type: type } : { $type: type, value };
}

export function codecCorpus(count = 32): CodecWorkload[] {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error("Record count must be a positive safe integer");
  }
  const ordinary: CodecRecord[] = [];
  const text: CodecRecord[] = [];
  const nested: CodecRecord[] = [];
  const native: CodecRecord[] = [];
  for (let i = 0; i < count; i++) {
    const value = {
      id: i,
      sensor: `sensor-${i % 7}`,
      ok: i % 3 !== 0,
      readings: [i, i + 0.25, -i - 1],
      note: null,
    };
    ordinary.push({
      codec: `{id:${i} sensor:"sensor-${i % 7}" ok:${
        i % 3 !== 0
      } readings:[${i} ${i + 0.25} ${-i - 1}] note:null}`,
      json: value,
    });
    const message = `record ${i}: café 日本語 😀 "quoted" \\ slash\nline\t${"#".repeat(
      12,
    )}`;
    text.push({ codec: JSON.stringify(message), json: message });
    const tree = {
      id: i,
      items: [
        { name: "first", values: [1, 2, 3] },
        {
          name: "second",
          values: [4, 5, 6],
        },
      ],
      meta: { region: "west", tags: ["a", "b"], optional: null },
    };
    nested.push({
      codec: `{id:${i} items:[{name:"first" values:[1 2 3]} {name:"second" values:[4 5 6]}] meta:{region:"west" tags:["a" "b"] optional:null}}`,
      json: tree,
    });
    const bigint = `12345678901234567890${i}`;
    native.push({
      codec: `{id:${i} missing:undefined big:${bigint}n date:@date"2026-10-12T00:00:00Z" bytes:@bytes"AAECA_8" symbol:@symbol"sample" set:@set[1 "x"] map:@map[["key" 42]] error:@error{name:"TypeError" message:"sample" cause:${i}} special:[NaN Infinity -Infinity -0]}`,
      json: {
        id: i,
        missing: tagged("undefined"),
        big: tagged("bigint", bigint),
        date: tagged("date", "2026-10-12T00:00:00Z"),
        bytes: tagged("bytes", "AAECA_8"),
        symbol: tagged("symbol", "sample"),
        set: tagged("set", [1, "x"]),
        map: tagged("map", [["key", 42]]),
        error: tagged("error", {
          name: "TypeError",
          message: "sample",
          cause: i,
        }),
        special: [
          tagged("number", "NaN"),
          tagged("number", "Infinity"),
          tagged("number", "-Infinity"),
          tagged("number", "-0"),
        ],
      },
    });
  }
  return [
    { name: "ordinary", records: ordinary },
    { name: "unicode-text", records: text },
    { name: "nested", records: nested },
    { name: "native-tagged", records: native },
  ];
}

export function transport(workload: CodecWorkload, format: string): string {
  switch (format) {
    case "codec":
      return workload.records.map((record) => record.codec + "\n").join("");
    case "jsonl":
      return workload.records
        .map((record) => JSON.stringify(record.json) + "\n")
        .join("");
    case "json":
      return JSON.stringify(workload.records.map((record) => record.json));
    default:
      throw new Error(`Unknown transport: ${format}`);
  }
}
