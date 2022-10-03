export interface ISnippet {
  index: number
  column: number
  line: number
  lines: string[]
  snippetLines: string[]
  snippetText: string
}

export function snippet(index: number, items: Iterable<string>): ISnippet {
  const lines = [];
  let i = 0;
  let current = "";
  let column = -1;
  let line = -1;
  for (const next of items) {
    if (i === index) {
      line = lines.length
      column = current.length
    }
    i++;
    
    if (next === "\n") {
      lines.push(current);
      current = "";
    } else {
      current += next;
    }
  }

  if (column === -1) {
    line = lines.length
    column = current.length
  }
  lines.push(current);

  const snippetLines = lines.slice(
    Math.max(0, line - 2),
    Math.min(lines.length, line + 1)
  );
  const snippetText = `${snippetLines
    .map((line) => `  ${line}`)
    .join("\n")
  }\n--${new Array(column + 1).join("-")}^`

  return {
    index,
    column,
    line,
    lines,
    snippetLines,
    snippetText
  }
}