export function format(value: string, ...args: unknown[]) {
  return value.replace(/{(\d+)}/g, (substring: string, ...matches: string[]) => args[parseInt(matches[0])]?.toString() ?? substring)
};
