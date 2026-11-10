import { setPixel, type Pixels } from "../editor/pixels";

type Point = [number, number];

type Canvas = {
  size: number; // px
  cells: Uint8Array;
};

type Test = (u: number, v: number) => boolean;

const lightAmount: number = 0.24;
const shadowAmount: number = 0.3;

function createCanvas(size: number): Canvas {
  return { size: size, cells: new Uint8Array(size * size) };
}

function paint(
  canvas: Canvas,
  region: number,
  test: Test,
  mirror: boolean = true,
  only: number = -1,
): void {
  const size: number = canvas.size;

  for (let y = 0; y < size; y++) {
    const v: number = (y + 0.5) / size;

    for (let x = 0; x < size; x++) {
      const index: number = y * size + x;
      const u: number = ((x + 0.5) / size) * 2 - 1;

      if (only >= 0 && canvas.cells[index] !== only) {
        continue;
      }

      if (test(mirror ? Math.abs(u) : u, v)) {
        canvas.cells[index] = region;
      }
    }
  }
}

function inPolygon(points: Array<Point>, u: number, v: number): boolean {
  let inside: boolean = false;

  for (let index = 0, last = points.length - 1; index < points.length;) {
    const [fromU, fromV] = points[index]!;
    const [toU, toV] = points[last]!;

    if (
      fromV > v !== toV > v &&
      u < ((toU - fromU) * (v - fromV)) / (toV - fromV) + fromU
    ) {
      inside = !inside;
    }

    last = index++;
  }

  return inside;
}

function inEllipse(
  centerU: number,
  centerV: number,
  radiusU: number,
  radiusV: number,
  u: number,
  v: number,
): boolean {
  return ((u - centerU) / radiusU) ** 2 + ((v - centerV) / radiusV) ** 2 <= 1;
}

function inRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
  u: number,
  v: number,
): boolean {
  return u >= left && u <= right && v >= top && v <= bottom;
}

function channels(hex: string): Array<number> {
  const value: number = parseInt(hex.slice(1, 7), 16);

  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function tone(hex: string, amount: number): number {
  const target: number = amount > 0 ? 255 : 0;
  const [red, green, blue] = channels(hex).map((value: number) =>
    Math.round(value + (target - value) * Math.abs(amount)),
  );

  return ((red! << 24) | (green! << 16) | (blue! << 8) | 0xff) >>> 0;
}

function render(
  canvas: Canvas,
  colors: Array<string | null>,
  flat: Array<boolean>,
  outline: number | null,
  pixels: Pixels,
): void {
  const size: number = canvas.size;
  const cells: Uint8Array = canvas.cells;
  const filled: (x: number, y: number) => boolean = (
    x: number,
    y: number,
  ): boolean =>
    x >= 0 && y >= 0 && x < size && y < size && cells[y * size + x] !== 0;

  pixels.data.fill(0);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const region: number = cells[y * size + x]!;
      const color: string | null = colors[region] ?? null;

      if (region === 0 || color === null) {
        if (outline !== null && region === 0) {
          if (
            filled(x - 1, y) ||
            filled(x + 1, y) ||
            filled(x, y - 1) ||
            filled(x, y + 1)
          ) {
            setPixel(pixels, x, y, outline);
          }
        }

        continue;
      }

      const edge: (otherX: number, otherY: number) => boolean = (
        otherX: number,
        otherY: number,
      ): boolean =>
        !filled(otherX, otherY) || cells[otherY * size + otherX] !== region;
      const amount: number = flat[region]
        ? 0
        : edge(x, y - 1) || edge(x - 1, y)
          ? lightAmount
          : edge(x, y + 1) || edge(x + 1, y)
            ? -shadowAmount
            : 0;

      setPixel(pixels, x, y, tone(color, amount));
    }
  }
}

export { createCanvas, paint, inPolygon, inEllipse, inRect, tone, render };
export type { Canvas, Point, Test };
