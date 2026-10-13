import type { Wall, Pattern } from "./types";

function solidSpans(
  pattern: Pattern,
  time: number = 0,
): Array<[number, number]> {
  if (pattern.gapFrequency <= 0 || pattern.gapWidth <= 0) {
    return [[0, 1]];
  }

  const period: number = 1 / pattern.gapFrequency;
  const width: number = Math.min(pattern.gapWidth, period);
  const offset: number = pattern.gapShift + pattern.gapPhaseShift * time;
  const shift: number = offset - Math.floor(offset / period) * period;
  const spans: Array<[number, number]> = new Array();
  let cursor: number = 0;

  for (
    let index = Math.floor(-pattern.gapFrequency) - 1;
    index <= Math.ceil(pattern.gapFrequency * 2) + 1;
    index++
  ) {
    const center: number = (index + 0.5) * period + shift;
    const start: number = Math.min(Math.max(center - width / 2, 0), 1);
    const end: number = Math.min(Math.max(center + width / 2, 0), 1);

    if (start > cursor) {
      spans.push([cursor, start]);
    }

    cursor = Math.max(cursor, end);
  }

  if (cursor < 1) {
    spans.push([cursor, 1]);
  }

  return spans;
}

function placeAlong(
  spans: Array<[number, number]>,
  fraction: number,
): number | null {
  const total: number = spans.reduce(
    (sum: number, span: [number, number]) => sum + span[1] - span[0],
    0,
  );
  let remaining: number = fraction * total;

  if (total <= 0) {
    return null;
  }

  for (const [start, end] of spans) {
    if (remaining <= end - start) {
      return start + remaining;
    }

    remaining -= end - start;
  }

  return spans[spans.length - 1]![1];
}

function wallAngle(wall: Wall): number {
  return wall === "top"
    ? Math.PI / 2
    : wall === "bottom"
      ? -Math.PI / 2
      : wall === "left"
        ? 0
        : Math.PI;
}

export { solidSpans, placeAlong, wallAngle };
