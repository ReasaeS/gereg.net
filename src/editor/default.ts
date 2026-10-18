import { setPixel, type Pixels } from "./pixels";

const gameRows: Array<string> = [
  "...............OO...............",
  "..............OYYO..............",
  ".............OYYYYO.............",
  "............OYYYYYYO............",
  "............OYYYYYYO............",
  "...........OYYYYYYYYO...........",
  "...........OYYYYYYYYO...........",
  "..........OYYYYYYYYYYO..........",
  "..........OYYYYYYYYYYO..........",
  ".........OYYYYYYYYYYYYO.........",
  ".......OOYYYYYYYYYYYYYYOO.......",
  ".....OOYYYYYYYYYYYYYYYYYYOO.....",
  "...OOYYYYYYYYYYYYYYYYYYYYYYOO...",
  "..OYYYYYYYYYYYYYYYYYYYYYYYYYYO..",
  ".OYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.",
  "OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO",
  "OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO",
  ".OYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.",
  "..OOYYYYYYYYYYYYYYYYYYYYYYYYOO..",
  "....OYYYYYYYYYYYYYYYYYYYYYYO....",
  ".....OYYYYYYYYYYYYYYYYYYYYO.....",
  ".....OYYYYYYYYYYYYYYYYYYYYO.....",
  "......OYYYYYYYYYYYYYYYYYYO......",
  "......OYYYYYYYYYYYYYYYYYYO......",
  ".......OYYYYYYYOOYYYYYYYO.......",
  ".......OYYYYYYO..OYYYYYYO.......",
  "........OYYYYYO..OYYYYYO........",
  "........OYYYYYO..OYYYYYO........",
  ".........OYYYO....OYYYO.........",
  ".........OYYYO....OYYYO.........",
  "..........OYYO....OYYO..........",
  "...........OO......OO...........",
];

const gameColors: Map<string, string | null> = new Map([
  [".", null],
  ["O", "#e6c229"],
  ["Y", "#fff27a"],
]);

const menuRows: Array<string> = [
  "......KKK..............KKK......",
  ".....KRRRKK..........KKRRRK.....",
  "....KRRRRRRKK.KKKK.KKRRRRRRK....",
  "....KRRrrRRRRKRRRRKRRRRrrRRK....",
  "....KRRRrrRRRKRrrRKRRRrrRRRK....",
  ".....KRRRRRRKKRRRRKKRRRRRRK.....",
  "......KKKKKKhKKKKKKhKKKKKK......",
  "........KhhhhhKRRKhhhhhK........",
  ".......KhhhhhKRrrRKhhhhhK.......",
  "......KhhhhLhKRrRKhhLhhhhK......",
  "......KhhhLLhhKRKhhhLLhhhK......",
  "......KhhhhhhhhhhhhhhhhhhK......",
  "......KhhhhhhhhhhhhhhhhhhK......",
  "......KhhhhhhhhhhhhhhhhhhK......",
  "...KKKKKhhhhhhhhhhhhhhhhKKKKK...",
  "..KWWWWKKhhhhhhhhhhhhhhKKWWWWK..",
  ".KWWWWWWKRhhhhhhhhhhhhRKWWWWWWK.",
  ".KWwWWWWKRRhhhhhhhhhhRRKWWWWwWK.",
  ".KWwwWWWKRRhhhhLhhhhhRRKWWWwwWK.",
  ".KWWwWWKSKRhhhhLhhhhhRKSKWWwWWK.",
  "..KWWWKSSKRRhhhhhhhhRRKSSKWWWK..",
  "...KKKKKKKRRRhhhhhhRRRKKKKKKK...",
  ".........KRRRhhhhhhRRRK.........",
  "........KRRRRRhhhhRRRRRK........",
  ".......KRRrRRRRhhRRRRrRRK..KKK..",
  "......KRRRrRRRRRRRRRRrRRRKKYYOK.",
  "KK....KWWWWWWWWWWWWWWWWKKYYOYYYK",
  "KbK....KKKKKKKKKKKKKKKKYOYYOYYOK",
  "KbKKKKKKKKKKKKKKKKKKKKrKYOYYOYYK",
  "KbbbbbbbbbbbbbbbbbbbbbrrYYOYYOYK",
  "KBBBBBBBBBBBBBBBBBBBBBrrYyYYyYYK",
  "KKKKKKKKKKSSKKKKKSSKKKKKyYKyYKK.",
];

const menuColors: Map<string, string | null> = new Map([
  [".", null],
  ["K", "#1d1d2b"],
  ["R", "#ff3b3b"],
  ["r", "#a32a2a"],
  ["h", "#3b3b52"],
  ["L", "#6b6b85"],
  ["S", "#ffe0a3"],
  ["W", "#ffffff"],
  ["w", "#d9d9e6"],
  ["B", "#7a3a12"],
  ["b", "#d96a1e"],
  ["Y", "#e6c229"],
  ["y", "#7a6a12"],
  ["O", "#ffb347"],
]);

const droneRadius: number = 13; // px
const droneLight: string = "#ffffff";
const droneDark: string = "#ff3b3b";
const droneOutline: string = "#1d1d2b";
const shotWidth: number = 6; // px
const shotLength: number = 28; // px
const droneShotLength: number = 20; // px
const shotColor: string = "#ffffff";

function toColor(hex: string): number {
  return ((parseInt(hex.slice(1), 16) << 8) | 0xff) >>> 0;
}

function drawArt(
  pixels: Pixels,
  rows: Array<string>,
  colors: Map<string, string | null>,
): void {
  pixels.data.fill(0);

  for (let y = 0; y < rows.length; y++) {
    const row: string = rows[y]!;

    for (let x = 0; x < row.length; x++) {
      const color: string | null = colors.get(row[x]!) ?? null;

      if (color !== null) {
        setPixel(pixels, x, y, toColor(color));
      }
    }
  }
}

function drawGameDefault(pixels: Pixels): void {
  drawArt(pixels, gameRows, gameColors);
}

function drawMenuDefault(pixels: Pixels): void {
  drawArt(pixels, menuRows, menuColors);
}

function drawDroneDefault(pixels: Pixels): void {
  const center: number = (pixels.size - 1) / 2;
  const radius: number = droneRadius;
  const half: number = radius / 2;

  pixels.data.fill(0);

  for (let y = 0; y < pixels.size; y++) {
    for (let x = 0; x < pixels.size; x++) {
      const distance: number = Math.hypot(x - center, y - center);
      const top: number = Math.hypot(x - center, y - (center - half));
      const bottom: number = Math.hypot(x - center, y - (center + half));
      let color: string = x < center ? droneLight : droneDark;

      if (distance > radius + 0.5) {
        continue;
      }

      if (top < half) {
        color = top < half / 3 ? droneLight : droneDark;
      } else if (bottom < half) {
        color = bottom < half / 3 ? droneDark : droneLight;
      }

      if (distance > radius - 1) {
        color = droneOutline;
      }

      setPixel(pixels, x, y, toColor(color));
    }
  }
}

function drawBar(pixels: Pixels, width: number, length: number): void {
  const left: number = (pixels.size - width) / 2;
  const top: number = (pixels.size - length) / 2;

  pixels.data.fill(0);

  for (let y = top; y < top + length; y++) {
    for (let x = left; x < left + width; x++) {
      setPixel(pixels, x, y, toColor(shotColor));
    }
  }
}

function drawShotDefault(pixels: Pixels): void {
  drawBar(pixels, shotWidth, shotLength);
}

function drawDroneShotDefault(pixels: Pixels): void {
  drawBar(pixels, shotWidth, droneShotLength);
}

export {
  drawGameDefault,
  drawMenuDefault,
  drawDroneDefault,
  drawShotDefault,
  drawDroneShotDefault,
};
