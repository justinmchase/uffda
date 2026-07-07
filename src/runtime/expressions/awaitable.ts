export type Awaitable<T> = T | Promise<T>;

export function isThenable<T = unknown>(
  value: unknown,
): value is PromiseLike<T> {
  if (value == null) return false;
  const t = typeof value;
  if (t !== "object" && t !== "function") return false;
  return typeof (value as PromiseLike<T>).then === "function";
}

export function allOrSync<T>(values: Awaitable<T>[]): Awaitable<T[]> {
  return values.some((value) => isThenable(value))
    ? Promise.all(values)
    : values as T[];
}
