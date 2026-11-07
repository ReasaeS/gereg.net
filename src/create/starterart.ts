import type { Bullet, Shape, Vessel } from "./types";
import {
  createPixels,
  encodePixels,
  setPixel,
  type Pixels,
} from "../editor/pixels";
import { spriteSize } from "../editor/drawings";

type Colors = Record<string, string>;

const bulletSide: number = 16; // px
const raindropRows: Array<string> = [
  ".......WW.......",
  ".......WW.......",
  "......WLLW......",
  "......WLLW......",
  ".....WLLLLW.....",
  ".....WLLLLW.....",
  "....WLLLLLLW....",
  "...WLLWLLLLLW...",
  "...WLWWLLLLLW...",
  "..WLLWLLLLLLLW..",
  "..WLLLLLLLLLLW..",
  "..WBLLLLLLLLBW..",
  "...WBLLLLLLBW...",
  "....WBBBBBBW....",
  ".....WWWWWW.....",
  "................",
];
const flameRows: Array<string> = [
  "................",
  ".......RR.......",
  "......RRR.......",
  "......RORR......",
  ".....RROORR.....",
  ".....ROOOORR....",
  "....RROYYOORR...",
  "....ROOYYYOOR...",
  "...RROYYWYYORR..",
  "...ROOYWWWYOOR..",
  "...ROOYWWWYOOR..",
  "...RROYWWWYORR..",
  "....ROOYYYOOR...",
  ".....RROOORR....",
  ".......RRR......",
  "................",
];
const gullRows: Array<string> = [
  "KK",
  "KWW",
  "KWWW",
  "KKWWW",
  "KWKWWW",
  "KWWKWWW",
  "KWWWKWWWW",
  "KWWWWKWWWWW",
  "KGWWWWKWWWWWWWW",
  "KGGWWWWWWWWWWWWW",
  "KGGGWWWWWWWWWWWW",
  ".KKGGWWWWWWWWWWW",
  "...KKGGWWWWWWWWW",
  "......KKKGWWWWWW",
  ".........KWWWWWW",
  "..........KWWWWW",
  "...........KWWYY",
  "............KYYY",
  ".............KYY",
  "..............KY",
];
const buoyRows: Array<string> = [
  "KK",
  "KLK",
  "KLLK",
  "KLLK",
  "KKKK",
  "KRRRRK",
  "KRRRRRRK",
  "KRRRRRRRRK",
  "KRWWWWWWWWK",
  "KRRWWWWWWWWK",
  "KRRRRRRRRRRRK",
  "KRRRRRRRRRRRRK",
  "KRRWWWWWWWWWWWK",
  "KRRWWWWWWWWWWWWK",
  "KRRRRRRRRRRRRRRR",
  "KRRRRRRRRRRRRRRR",
  ".KDDRRRRRRRRRRRR",
  "..KDDDDRRRRRRRRR",
  "....KKDDDDDDDDDD",
  "......KKKKKKKKKK",
];
const skiffRows: Array<string> = [
  "KKKKK",
  "KBBBBBK",
  "KBBBBBBBK",
  "KBBBBBBBBK",
  "KBDBBBBBBBK",
  "KBDDBBBBBBBK",
  "KBDBBBBBBBBK",
  "KBBBBBBBBBBBK",
  "KBBBKKKKKBBBK",
  "KBBKSSSSSKBBK",
  ".KBKSSSSSSKBK",
  ".KBKSSLLSSKBBK",
  ".KBKSSLLLSKBBB",
  ".KBKSSLLLSKBBB",
  "..KBKSSSSSKBBB",
  "..KBBKKKKKBBBB",
  "..KBBBBBBBBBBB",
  "...KBBBDBBBBBB",
  "...KBBBDDBBBBB",
  "....KBBBDDBBBB",
  "....KBBBBDDBBB",
  ".....KBBBBDDBB",
  "......KBBBBDBB",
  ".......KBBBBBB",
  "........KKBBBB",
  "..........KKBB",
  "............KK",
];
const lanternRows: Array<string> = [
  "KKKK",
  "KGGK",
  "KKKKKK",
  "KGGGGGGK",
  "KGDDDDDDGK",
  "KGDDDDDDDDGK",
  "KKKKKKKKKKKKKK",
  "KGGGGGGGGGGGGGKK",
  "KKKKKKKKKKKKKKKK",
  "..KDKAAAAKDKAAAA",
  "..KDKAAAYKDKAYYY",
  "..KDKAAYYKDKYYYY",
  "..KDKAYYWKDKYWWW",
  "..KDKAYYWKDKYWWW",
  "..KDKAYWWKDKWWWW",
  "..KDKAYWWKDKWWWW",
  "..KDKAYYWKDKYWWW",
  "..KDKAAYYKDKYYYY",
  "..KDKAAAYKDKAYYY",
  "..KDKAAAAKDKAAAA",
  "KKKKKKKKKKKKKKKK",
  "KGGGGGGGGGGGGGKK",
  "KKKKKKKKKKKKKKKK",
  "...KGDDDDDDDDDDD",
  "...KGDDDDDDDDDDD",
  "....KGDDDDDDDDDD",
  ".....KKGDDDDDDDD",
  ".......KKGGGDDDD",
  ".........KKKGGGG",
  "............KKKK",
];
const vesselColors: Colors = {
  K: "#101828",
  W: "#e6eef2",
  G: "#8a9aa8",
  Y: "#ffc857",
  L: "#ffe9a8",
  R: "#d6453d",
  D: "#5a2430",
  B: "#6b4a34",
  S: "#2d4a57",
  A: "#ff9e4f",
};
const dropColors: Colors = {
  W: "#ffffff",
  L: "#7ad8ff",
  B: "#2a86e0",
};
const flameColors: Colors = {
  W: "#ffffff",
  Y: "#ffe27a",
  O: "#ff9e4f",
  R: "#e0402f",
};

function toColor(hex: string): number {
  return ((parseInt(hex.slice(1), 16) << 8) | 0xff) >>> 0;
}

function paint(side: number, rows: Array<string>, colors: Colors): string {
  const pixels: Pixels = createPixels(side);

  rows.forEach((row: string, y: number) => {
    [...row].forEach((mark: string, x: number) => {
      const color: string | undefined = colors[mark];

      if (color !== undefined) {
        setPixel(pixels, x, y, toColor(color));
      }
    });
  });

  return encodePixels(pixels);
}

function mirrored(half: Array<string>, scale: number): Array<string> {
  const top: number = Math.floor((spriteSize - half.length) / 2);
  const rows: Array<string> = new Array(top).fill("");

  for (const row of half) {
    const left: string = row.padStart(spriteSize / 2, ".");

    rows.push(left + [...left].reverse().join(""));
  }

  return rows.flatMap((row: string) =>
    new Array<string>(scale).fill(
      [...row].map((mark: string) => mark.repeat(scale)).join(""),
    ),
  );
}

function vessel(
  id: string,
  name: string,
  half: Array<string>,
  scale: number,
): Vessel {
  return {
    id: id,
    name: name,
    scale: scale,
    pixels: paint(spriteSize * scale, mirrored(half, scale), vesselColors),
  };
}

function energy(
  id: string,
  name: string,
  shape: Shape,
  glow: string,
  length: number,
): Bullet {
  return {
    id: id,
    name: name,
    look: "energy",
    pixels: paint(bulletSide, raindropRows, dropColors),
    shape: shape,
    glow: glow,
    core: "#ffffff",
    coreSize: 0.5,
    glowSize: 0.4,
    length: length,
  };
}

function sprite(
  id: string,
  name: string,
  rows: Array<string>,
  colors: Colors,
): Bullet {
  return {
    ...energy(id, name, "orb", "#ffffff", 1),
    look: "sprite",
    pixels: paint(bulletSide, rows, colors),
  };
}

function starterVessels(): Array<Vessel> {
  return [
    vessel("lamp-vessel-gull", "Storm Gull", gullRows, 1),
    vessel("lamp-vessel-buoy", "Bell Buoy", buoyRows, 1),
    vessel("lamp-vessel-skiff", "Wreck Skiff", skiffRows, 2),
    vessel("lamp-vessel-lantern", "Drowned Lantern", lanternRows, 4),
  ];
}

function starterBullets(): Array<Bullet> {
  return [
    energy("lamp-bullet-orb", "Sea Spark", "orb", "#3bb8ff", 1),
    energy("lamp-bullet-rice", "Sleet", "rice", "#7ad8ff", 2),
    energy("lamp-bullet-star", "Night Star", "star", "#ffd166", 1),
    energy("lamp-bullet-kunai", "Gull Beak", "kunai", "#ff6b5b", 2.2),
    energy("lamp-bullet-ring", "Bell Ring", "ring", "#54e0c0", 1),
    energy("lamp-bullet-heart", "Siren Heart", "heart", "#ff6fd8", 1),
    energy("lamp-bullet-diamond", "Salt Crystal", "diamond", "#b79cff", 1.4),
    sprite("lamp-bullet-drop", "Raindrop", raindropRows, dropColors),
    sprite("lamp-bullet-flame", "Lamp Flame", flameRows, flameColors),
  ];
}

export { starterBullets, starterVessels };
