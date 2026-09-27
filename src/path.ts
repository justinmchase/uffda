type Segment = number | string;

export class Path {
  public static readonly Default = (): Path => new Path(0);
  public static readonly From = (...segments: Segment[]): Path =>
    new Path(...segments);
  public readonly segments: Segment[];
  #key: string | undefined = undefined;
  constructor(...segments: Segment[]) {
    this.segments = segments.map(Path.getValidSegment);
  }

  /** Wraps segments that are already valid, without copying them again. */
  private static of(segments: Segment[]): Path {
    const path = new Path();
    (path as { segments: Segment[] }).segments = segments;
    return path;
  }

  public set(segment: Segment): Path {
    const segments = this.segments.slice(0, -1);
    segments.push(Path.getValidSegment(segment));
    return Path.of(segments);
  }

  public push(segment: Segment): Path {
    const segments = this.segments.slice();
    segments.push(Path.getValidSegment(segment));
    return Path.of(segments);
  }

  public pop(): Path {
    return Path.of(this.segments.slice(0, -1));
  }

  private static getValidSegment(value: Segment): Segment {
    if (typeof value === "number" && Number.isInteger(value)) {
      return value;
    } else if (typeof value === "string") {
      return value;
    } else {
      return value.toString();
    }
  }

  public compareTo(path: Path): number {
    const l0 = this.segments.length;
    const l1 = path.segments.length;
    for (let i = 0; i < l0 && i < l1; i++) {
      const s0 = this.segments[i];
      const s1 = path.segments[i];
      if (typeof s0 === "number" && typeof s1 === "string") {
        return -1;
      }
      if (typeof s0 === "string" && typeof s1 === "number") {
        return 1;
      }

      if (s0 < s1) {
        return -1;
      }
      if (s0 > s1) {
        return 1;
      }

      // If one of the paths is deeper than the other, but equivalent
      // up to the end of the more shallow path then
      // the shallower path is considered to be less than the deeper one
      if (l0 - i === 1 && l1 - i > 1) {
        return -1;
      }
      if (l1 - i === 1 && l0 - i > 1) {
        return 1;
      }
    }

    // All segments are the same and the depth of both paths are the same
    return 0;
  }

  /** Also the memo-table key for this position, so it is computed once. */
  public toString(): string {
    return this.#key ??= this.segments
      .map((s) => typeof s === "string" ? `"${s}"` : `[${s}]`)
      .join(".");
  }
}
