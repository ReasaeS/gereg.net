import {
  Container,
  Graphics,
  Point,
  Rectangle,
  Sprite,
  Text,
  type Application,
  type FederatedPointerEvent,
  type Ticker,
} from "pixi.js";
import {
  inside,
  getPixel,
  setPixel,
  drawLine,
  drawRect,
  drawOval,
  flipPixels,
  shiftPixels,
  floodFill,
  exportPixels,
  importPixels,
} from "./pixels";
import {
  drawings,
  droneTexture,
  playerTexture,
  saveDrawing,
  spriteSize,
  type Drawing,
} from "./drawings";
import { createPower, type Power } from "./power";
import { createText } from "../ui/text";
import { createDrop, type Drop } from "../create/maker/drop";
import { createGlide, mix, type Glide } from "../ui/motion";
import { getTheme } from "../theme/theme";
import type { Topic } from "../menu/help";

type Tool = "pencil" | "eraser" | "fill" | "picker" | "line" | "rect" | "oval";

type Plate = {
  view: Container;
  size: number; // px
  active: () => boolean;
  lit: Glide;
};

type Action = {
  name: string;
  key: string;
  icon: Array<string>;
  active: () => boolean;
  run: () => void;
};

type Editor = {
  view: Container;
  setActive: (active: boolean) => void;
  enter?: () => void;
  fullscreen?: () => boolean;
  topic?: () => Topic;
};

const maxUndo: number = 100;
const boardHeight: number = 0.56; // of screen height
const boardWidth: number = 0.4; // of screen width
const boardCenterY: number = 0.6; // of screen height
const panelGap: number = 28; // px
const benchPadding: number = 22; // px
const benchNotch: number = 8; // px
const benchColor: string = "#090c1a";
const benchAlpha: number = 0.94;
const benchEdge: string = "#2c3560";
const dotGap: number = 16; // px
const dotAlpha: number = 0.12;
const rivetSize: number = 4; // px
const rivetInset: number = 9; // px
const plateColor: string = "#141a33";
const plateEdge: string = "#3b4570";
const plateNotch: number = 3; // px
const plateLine: number = 2; // px
const iconColor: string = "#cfd8ff";
const iconRows: number = 9;
const tileSize: number = 44; // px
const tileGap: number = 6; // px
const tileColumns: number = 2;
const tileRise: number = 2; // px
const keySize: number = 10; // px
const captionSize: number = 14; // px
const captionGap: number = 14; // px
const slotSize: number = 64; // px
const slotGap: number = 10; // px
const slotRise: number = 8; // px
const slotSprite: number = 1.5;
const slotNotch: number = 4; // px
const slotLine: number = 3; // px
const slotBottom: number = 14; // px
const titleSize: number = 30; // px
const titleGap: number = 22; // px
const hintSize: number = 11; // px
const hintColor: string = "#8f9bd0";
const rulerSize: number = 16; // px
const rulerMinor: number = 3; // px
const rulerMajor: number = 8; // px
const rulerText: number = 9; // px
const rulerMinCell: number = 6; // px
const readoutSize: number = 13; // px
const readoutGap: number = 10; // px
const statusGap: number = 14; // px
const checkerLight: string = "#2a2f45";
const checkerDark: string = "#1f2335";
const gridColor: string = "#ffffff";
const gridAlpha: number = 0.1;
const gridMajorAlpha: number = 0.25;
const gridMajor: number = 8; // px
const frameWidth: number = 2; // px
const hoverColor: string = "#ffffff";
const paletteColumns: number = 4;
const swatchMaxSize: number = 36; // px
const swatchGap: number = 3; // px
const bracketLength: number = 8; // px
const bracketWidth: number = 3; // px
const inkHeight: number = 26; // px
const inkGap: number = 12; // px
const previewScale: number = 3;
const previewTop: number = 20; // px
const transparent: number = 0;
const statusSize: number = 20; // px
const alphaCutoff: number = 128;
const statusColor: string = "#cfeeff";
const statusDuration: number = 2.5; // s
const statusFade: number = 0.5; // s

const nudges: Map<string, [number, number]> = new Map([
  ["ArrowLeft", [-1, 0]],
  ["ArrowRight", [1, 0]],
  ["ArrowUp", [0, -1]],
  ["ArrowDown", [0, 1]],
]);

const palette: Array<string> = [
  "#000000",
  "#1d1d2b",
  "#3b3b52",
  "#6b6b85",
  "#a3a3b8",
  "#d9d9e6",
  "#ffffff",
  "#5c1a1a",
  "#a32a2a",
  "#ff3b3b",
  "#ff8a80",
  "#7a3a12",
  "#d96a1e",
  "#ffb347",
  "#ffe0a3",
  "#7a6a12",
  "#e6c229",
  "#fff27a",
  "#1e5c2a",
  "#2fa84f",
  "#7ae38f",
  "#124a5c",
  "#1e9ad9",
  "#7ad9ff",
  "#1a2a7a",
  "#3b5bff",
  "#9fb4ff",
  "#4a1a7a",
  "#9b3bff",
  "#d9a3ff",
  "#7a1a5c",
  "#ff4fbf",
];

const pencilIcon: Array<string> = [
  ".......#.",
  "......###",
  ".....###.",
  "....###..",
  "...###...",
  "..###....",
  ".#.#.....",
  "##.......",
  "#........",
];
const eraserIcon: Array<string> = [
  ".........",
  "....####.",
  "...#####.",
  "..######.",
  ".####..#.",
  ".#..#.#..",
  ".#..##...",
  ".####....",
  ".........",
];
const fillIcon: Array<string> = [
  "..#......",
  ".#.#.....",
  "#...#....",
  "#####.#..",
  ".###..#..",
  "..#...##.",
  "......##.",
  ".........",
  ".........",
];
const lineIcon: Array<string> = [
  "........#",
  ".......#.",
  "......#..",
  ".....#...",
  "....#....",
  "...#.....",
  "..#......",
  ".#.......",
  "#........",
];
const rectIcon: Array<string> = [
  ".........",
  "#########",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#########",
  ".........",
];
const ovalIcon: Array<string> = [
  "...###...",
  ".##...##.",
  ".#.....#.",
  "#.......#",
  "#.......#",
  "#.......#",
  ".#.....#.",
  ".##...##.",
  "...###...",
];
const flipIcon: Array<string> = [
  "....#....",
  "..#.#.#..",
  ".##.#.##.",
  "###.#.###",
  ".##.#.##.",
  "..#.#.#..",
  "....#....",
  "....#....",
  "....#....",
];
const pickIcon: Array<string> = [
  "......##.",
  ".....####",
  "......##.",
  ".....#.#.",
  "....#....",
  "...#.....",
  "..#......",
  ".#.......",
  "#........",
];
const mirrorIcon: Array<string> = [
  "....#....",
  "#.......#",
  "##..#..##",
  "###...###",
  "####.####",
  "###...###",
  "##..#..##",
  "#.......#",
  "....#....",
];
const gridIcon: Array<string> = [
  "#########",
  "#...#...#",
  "#...#...#",
  "#...#...#",
  "#########",
  "#...#...#",
  "#...#...#",
  "#...#...#",
  "#########",
];
const undoIcon: Array<string> = [
  "..#......",
  ".##......",
  "#######..",
  ".##....#.",
  "..#.....#",
  "........#",
  ".......#.",
  "....###..",
  ".........",
];
const clearIcon: Array<string> = [
  "#.......#",
  ".#.....#.",
  "..#...#..",
  "...#.#...",
  "....#....",
  "...#.#...",
  "..#...#..",
  ".#.....#.",
  "#.......#",
];
const resetIcon: Array<string> = [
  "..###.#..",
  ".#...##..",
  "#...###..",
  "#........",
  "#.......#",
  "#.......#",
  ".#.....#.",
  "..#####..",
  ".........",
];
const exportIcon: Array<string> = [
  "....#....",
  "...###...",
  "..#.#.#..",
  "....#....",
  "....#....",
  "#...#...#",
  "#.......#",
  "#########",
  ".........",
];
const importIcon: Array<string> = [
  "....#....",
  "....#....",
  "....#....",
  "..#.#.#..",
  "...###...",
  "#...#...#",
  "#.......#",
  "#########",
  ".........",
];
const powerIcon: Array<string> = [
  ".....##..",
  "....##...",
  "...##....",
  "..######.",
  "....##...",
  "...##....",
  "..##.....",
  ".##......",
  ".........",
];

function toColor(hex: string): number {
  return ((parseInt(hex.slice(1), 16) << 8) | 0xff) >>> 0;
}

function flipped(rows: Array<string>): Array<string> {
  return rows.map((row: string) => row.split("").reverse().join(""));
}

function notched(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  notch: number,
): Graphics {
  const right: number = x + width;
  const bottom: number = y + height;

  return graphics.poly([
    x + notch * 2,
    y,
    right - notch * 2,
    y,
    right - notch * 2,
    y + notch,
    right - notch,
    y + notch,
    right - notch,
    y + notch * 2,
    right,
    y + notch * 2,
    right,
    bottom - notch * 2,
    right - notch,
    bottom - notch * 2,
    right - notch,
    bottom - notch,
    right - notch * 2,
    bottom - notch,
    right - notch * 2,
    bottom,
    x + notch * 2,
    bottom,
    x + notch * 2,
    bottom - notch,
    x + notch,
    bottom - notch,
    x + notch,
    bottom - notch * 2,
    x,
    bottom - notch * 2,
    x,
    y + notch * 2,
    x + notch,
    y + notch * 2,
    x + notch,
    y + notch,
    x + notch * 2,
    y + notch,
  ]);
}

function createIcon(rows: Array<string>, size: number): Graphics {
  const icon: Graphics = new Graphics();
  const pixel: number = Math.floor(size / iconRows);

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y]!.length; x++) {
      if (rows[y]![x] === "#") {
        icon.rect(x * pixel, y * pixel, pixel, pixel);
      }
    }
  }

  icon.fill(0xffffff);
  icon.pivot.set((iconRows * pixel) / 2, (iconRows * pixel) / 2);

  return icon;
}

function createPlate(
  size: number,
  content: Container,
  tinted: boolean,
  rise: number,
  active: () => boolean,
  action: () => void,
  hovered: (on: boolean) => void,
): Plate {
  const view: Container = new Container();
  const body: Container = new Container();
  const back: Graphics = new Graphics();
  const notch: number = tinted ? plateNotch : slotNotch;
  const line: number = tinted ? plateLine : slotLine;
  const hover: Glide = createGlide(0, draw);
  const lit: Glide = createGlide(0, draw);

  function draw(): void {
    const amount: number = lit.value();
    const edge: number = Math.max(amount, hover.value());

    notched(back.clear(), 0, 0, size, size, notch)
      .fill(tinted ? mix(plateColor, getTheme().accent, amount) : plateColor)
      .stroke({
        color: mix(
          plateEdge,
          tinted ? getTheme().highlight : getTheme().accent,
          edge,
        ),
        width: line,
        alignment: 1,
      });
    body.y = -rise * amount - tileRise * hover.value();

    if (tinted) {
      content.tint = mix(iconColor, plateColor, amount);
    }
  }

  content.position.set(size / 2, size / 2);
  body.addChild(back, content);
  view.addChild(body);
  view.eventMode = "static";
  view.cursor = "pointer";
  view.hitArea = new Rectangle(0, -rise, size, size + rise);
  view.on("pointertap", () => {
    action();

    if (!active()) {
      lit.snap(1);
      lit.set(0);
    }
  });
  view.on("pointerover", () => {
    hover.set(1);
    hovered(true);
  });
  view.on("pointerout", () => {
    hover.set(0);
    hovered(false);
  });
  lit.snap(active() ? 1 : 0);

  return { view: view, size: size, active: active, lit: lit };
}

function createEditor(app: Application): Editor {
  let drawing: Drawing = drawings[0]!;
  const view: Container = new Container();
  const board: Container = new Container();
  const checker: Graphics = new Graphics();
  const canvas: Sprite = new Sprite(drawing.texture);
  const grid: Graphics = new Graphics();
  const hover: Graphics = new Graphics();
  const frame: Graphics = new Graphics();
  const bench: Graphics = new Graphics();
  const rulers: Container = new Container();
  const ticks: Graphics = new Graphics();
  const marks: Graphics = new Graphics();
  const numbers: Array<Text> = new Array();
  const readout: Text = createText(readoutSize, hintColor);
  const size: Text = createText(readoutSize, hintColor);
  const tools: Container = new Container();
  const caption: Text = createText(captionSize, iconColor);
  const slots: Container = new Container();
  const title: Text = createText(titleSize, "#ffffff");
  const hint: Text = createText(hintSize, hintColor);
  const swatches: Container = new Container();
  const selection: Graphics = new Graphics();
  const ink: Container = new Container();
  const inkChip: Graphics = new Graphics();
  const inkLabel: Text = createText(readoutSize, hintColor);
  const preview: Container = new Container();
  const previewLabel: Text = createText(hintSize, hintColor);
  const small: Sprite = new Sprite(drawing.texture);
  const large: Sprite = new Sprite(drawing.texture);
  const local: Point = new Point();
  const status: Text = createText(statusSize, statusColor);
  let statusTime: number = 0;
  const drop: Drop = createDrop(
    app,
    () => (active && !powering ? "DROP TO IMPORT" : null),
    (file: File | undefined) => void importImage(file),
  );
  const tiles: Array<Plate> = new Array();
  const cartridges: Array<Plate> = new Array();
  let tool: Tool = "pencil";
  let color: number = toColor(palette[0]!);
  let mirror: boolean = false;
  let showGrid: boolean = true;
  let active: boolean = false;
  let stroking: boolean = false;
  let erasing: boolean = false;
  let lastX: number = 0;
  let lastY: number = 0;
  let shapeBase: Uint8Array | null = null;
  let cell: number = 1;
  let swatchSize: number = swatchMaxSize;
  let powering: boolean = false;
  let hoveredAction: Action | null = null;
  const power: Power = createPower(app, playerTexture(), droneTexture());
  const drawingParts: Array<Container> = [
    board,
    rulers,
    tools,
    swatches,
    ink,
    preview,
  ];
  const mode: Glide = createGlide(0, (amount: number) => {
    for (const part of drawingParts) {
      part.alpha = 1 - amount;
      part.visible = amount < 1;
    }

    power.view.alpha = amount;
    power.view.visible = amount > 0;
  });
  const gridFade: Glide = createGlide(1, (alpha: number) => {
    grid.alpha = alpha;
  });
  const canvasFade: Glide = createGlide(1, (alpha: number) => {
    canvas.alpha = alpha;
    small.alpha = alpha;
    large.alpha = alpha;
  });
  const titleFade: Glide = createGlide(1, (alpha: number) => {
    title.alpha = alpha;
    title.x = slots.x + slotsWidth() + titleGap - (1 - alpha) * titleGap;
  });
  const chosenX: Glide = createGlide(0, drawSelection);
  const chosenY: Glide = createGlide(0, drawSelection);
  const hoverFade: Glide = createGlide(0, drawSelection);
  let hoverSwatch: number = -1;
  let chosenPlaced: boolean = false;

  function slotsWidth(): number {
    return cartridges.length * (slotSize + slotGap) - slotGap;
  }

  function tabName(): string {
    return powering ? "power" : drawing.name;
  }

  function refresh(): void {
    drawing.source.update();

    for (const plate of [...tiles, ...cartridges]) {
      plate.lit.set(plate.active() ? 1 : 0);
    }

    if (title.text !== tabName().toUpperCase()) {
      title.text = tabName().toUpperCase();
      titleFade.snap(0);
      titleFade.set(1);
    }

    caption.text = (hoveredAction ?? currentAction()).name.toUpperCase();
    placeSelection();
    gridFade.set(showGrid ? 1 : 0);
  }

  function save(): void {
    saveDrawing(drawing);
  }

  function remember(): void {
    drawing.undo.push(drawing.pixels.data.slice());
    drawing.redo.length = 0;

    if (drawing.undo.length > maxUndo) {
      drawing.undo.shift();
    }
  }

  function undo(): void {
    const previous: Uint8Array | undefined = drawing.undo.pop();

    if (previous !== undefined) {
      drawing.redo.push(drawing.pixels.data.slice());
      drawing.pixels.data.set(previous);
      refresh();
      save();
    }
  }

  function redo(): void {
    const next: Uint8Array | undefined = drawing.redo.pop();

    if (next !== undefined) {
      drawing.undo.push(drawing.pixels.data.slice());
      drawing.pixels.data.set(next);
      refresh();
      save();
    }
  }

  function clear(): void {
    remember();
    drawing.pixels.data.fill(0);
    refresh();
    save();
  }

  function tell(message: string): void {
    status.text = message.toUpperCase();
    statusTime = statusDuration;
  }

  function exportSprite(): void {
    exportPixels(drawing.pixels)
      .then((text: string) => navigator.clipboard.writeText(text))
      .then(
        () => tell("Sprite copied to clipboard"),
        () => tell("Could not copy the sprite"),
      );
  }

  function importText(text: string): void {
    importPixels(drawing.pixels, text).then((data: Uint8Array | null) => {
      if (data === null) {
        tell("That is not a sprite");
        return;
      }

      remember();
      drawing.pixels.data.set(data);
      refresh();
      save();
      tell("Sprite imported");
    });
  }

  function importSprite(): void {
    navigator.clipboard
      .readText()
      .then(importText, () => tell("Press Ctrl+V to paste a sprite"));
  }

  async function importImage(file: File | undefined): Promise<void> {
    if (!active || powering || file === undefined) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      tell("That is not an image");
      return;
    }

    try {
      const image: ImageBitmap = await createImageBitmap(file);
      const scratch: HTMLCanvasElement = document.createElement("canvas");
      const context: CanvasRenderingContext2D = scratch.getContext("2d")!;
      const scale: number = Math.min(
        spriteSize / image.width,
        spriteSize / image.height,
      );
      const width: number = Math.max(Math.round(image.width * scale), 1);
      const height: number = Math.max(Math.round(image.height * scale), 1);

      scratch.width = spriteSize;
      scratch.height = spriteSize;
      context.imageSmoothingEnabled = false;
      context.drawImage(
        image,
        Math.floor((spriteSize - width) / 2),
        Math.floor((spriteSize - height) / 2),
        width,
        height,
      );
      image.close();

      const pixels: Uint8ClampedArray = context.getImageData(
        0,
        0,
        spriteSize,
        spriteSize,
      ).data;

      remember();

      for (let offset = 0; offset < pixels.length; offset += 4) {
        const solid: boolean = pixels[offset + 3]! >= alphaCutoff;

        drawing.pixels.data[offset] = solid ? pixels[offset]! : 0;
        drawing.pixels.data[offset + 1] = solid ? pixels[offset + 1]! : 0;
        drawing.pixels.data[offset + 2] = solid ? pixels[offset + 2]! : 0;
        drawing.pixels.data[offset + 3] = solid ? 255 : 0;
      }

      refresh();
      save();
      tell("Image imported");
    } catch {
      tell("Could not read that image");
    }
  }

  function reset(): void {
    remember();
    drawing.drawDefault(drawing.pixels);
    refresh();
    save();
  }

  function plot(x: number, y: number): void {
    const value: number = erasing ? transparent : color;
    setPixel(drawing.pixels, x, y, value);

    if (mirror) {
      setPixel(drawing.pixels, spriteSize - 1 - x, y, value);
    }
  }

  function cellAt(event: FederatedPointerEvent): Array<number> {
    canvas.toLocal(event.global, undefined, local);

    return [Math.floor(local.x), Math.floor(local.y)];
  }

  function begin(event: FederatedPointerEvent): void {
    if (!active) {
      return;
    }

    const [x, y] = cellAt(event) as [number, number];

    if (!inside(drawing.pixels, x, y)) {
      return;
    }

    if (tool === "picker") {
      const picked: number = getPixel(drawing.pixels, x, y);

      if (picked !== transparent) {
        color = picked;
        tool = "pencil";
        refresh();
      }

      return;
    }

    remember();
    erasing = event.button === 2 || tool === "eraser";

    if (tool === "fill") {
      const value: number = event.button === 2 ? transparent : color;
      floodFill(drawing.pixels, x, y, value);

      if (mirror) {
        floodFill(drawing.pixels, spriteSize - 1 - x, y, value);
      }

      refresh();
      save();
      return;
    }

    stroking = true;
    lastX = x;
    lastY = y;

    if (shaping()) {
      shapeBase = drawing.pixels.data.slice();
    }

    plot(x, y);
    refresh();
  }

  function shaping(): boolean {
    return tool === "line" || tool === "rect" || tool === "oval";
  }

  function drawShape(x: number, y: number): void {
    const toX: number = Math.min(Math.max(x, 0), spriteSize - 1);
    const toY: number = Math.min(Math.max(y, 0), spriteSize - 1);

    if (shapeBase === null) {
      return;
    }

    drawing.pixels.data.set(shapeBase);

    if (tool === "line") {
      drawLine(drawing.pixels, lastX, lastY, toX, toY, plot);
    } else if (tool === "rect") {
      drawRect(lastX, lastY, toX, toY, plot);
    } else {
      drawOval(lastX, lastY, toX, toY, plot);
    }
  }

  function flip(): void {
    remember();
    flipPixels(drawing.pixels);
    refresh();
    save();
  }

  function nudge(shiftX: number, shiftY: number): void {
    remember();
    shiftPixels(drawing.pixels, shiftX, shiftY);
    refresh();
    save();
  }

  function move(event: FederatedPointerEvent): void {
    const [x, y] = cellAt(event) as [number, number];

    drawHover(x, y);

    if (!stroking) {
      return;
    }

    if (shaping()) {
      drawShape(x, y);
      refresh();
      return;
    }

    drawLine(drawing.pixels, lastX, lastY, x, y, plot);
    lastX = x;
    lastY = y;
    refresh();
  }

  function end(): void {
    if (!stroking) {
      return;
    }

    stroking = false;
    shapeBase = null;
    save();
  }

  function clearHover(): void {
    hover.clear();
    marks.clear();
    readout.text = "X --  Y --";
  }

  function drawHover(x: number, y: number): void {
    clearHover();

    if (!active || !inside(drawing.pixels, x, y)) {
      return;
    }

    const columns: Array<number> = mirror ? [x, spriteSize - 1 - x] : [x];

    for (const column of columns) {
      hover.rect(column * cell, y * cell, cell, cell);
      marks.rect(board.x + column * cell, board.y - rulerSize, cell, rulerSize);
    }

    hover.stroke({ color: hoverColor, width: 2, alpha: 0.8 });
    marks
      .rect(board.x - rulerSize, board.y + y * cell, rulerSize, cell)
      .fill({ color: getTheme().accent, alpha: 0.7 });
    readout.text =
      "X " + String(x).padStart(2, "0") + "  Y " + String(y).padStart(2, "0");
  }

  function placeSelection(): void {
    const hex: string =
      "#" + (color >>> 8).toString(16).padStart(6, "0").toUpperCase();
    const index: number = palette.findIndex(
      (value: string) => toColor(value) === color,
    );

    inkChip
      .clear()
      .rect(0, 0, inkHeight, inkHeight)
      .fill(hex)
      .rect(0, 0, inkHeight, inkHeight)
      .stroke({ color: plateEdge, width: plateLine, alignment: 1 });
    inkLabel.text = "INK  " + hex;

    if (index < 0) {
      return;
    }

    const column: number = index % paletteColumns;
    const row: number = Math.floor(index / paletteColumns);

    if (chosenPlaced) {
      chosenX.set(column);
      chosenY.set(row);
    } else {
      chosenPlaced = true;
      chosenX.snap(column);
      chosenY.snap(row);
    }

    drawSelection();
  }

  function drawBrackets(
    x: number,
    y: number,
    side: number,
    tint: string,
    alpha: number,
  ): void {
    const reach: number = Math.min(bracketLength, side / 2);
    const corners: Array<[number, number, number, number]> = [
      [x, y, 1, 1],
      [x + side, y, -1, 1],
      [x, y + side, 1, -1],
      [x + side, y + side, -1, -1],
    ];

    for (const [cornerX, cornerY, toX, toY] of corners) {
      selection
        .moveTo(cornerX + toX * reach, cornerY)
        .lineTo(cornerX, cornerY)
        .lineTo(cornerX, cornerY + toY * reach);
    }

    selection.stroke({
      color: tint,
      width: bracketWidth,
      alpha: alpha,
      cap: "square",
      join: "miter",
    });
  }

  function drawSelection(): void {
    const step: number = swatchSize + swatchGap;
    const outset: number = bracketWidth;

    selection.clear();

    if (hoverSwatch >= 0 && hoverFade.value() > 0) {
      drawBrackets(
        (hoverSwatch % paletteColumns) * step - outset,
        Math.floor(hoverSwatch / paletteColumns) * step - outset,
        swatchSize + outset * 2,
        hoverColor,
        hoverFade.value() * 0.6,
      );
    }

    drawBrackets(
      chosenX.value() * step - outset,
      chosenY.value() * step - outset,
      swatchSize + outset * 2,
      getTheme().accent,
      1,
    );
  }

  function selectDrawing(index: number): void {
    const next: Drawing | undefined = drawings[index];

    if (next === undefined || (next === drawing && !powering)) {
      return;
    }

    stroking = false;
    drawing = next;
    showPower(false);
    canvasFade.snap(0);
    canvasFade.set(1);
    canvas.texture = drawing.texture;
    small.texture = drawing.texture;
    large.texture = drawing.texture;
    clearHover();
    refresh();
  }

  function showPower(value: boolean): void {
    powering = value;
    stroking = false;
    clearHover();
    board.eventMode = value ? "none" : "passive";
    tools.eventMode = value ? "none" : "passive";
    swatches.eventMode = value ? "none" : "passive";
    mode.set(value ? 1 : 0);
    power.setActive(active && value);
    refresh();
  }

  function selectTool(value: Tool): void {
    tool = value;
    refresh();
  }

  function layoutRulers(boardSize: number): void {
    ticks.clear();

    for (let line = 0; line <= spriteSize; line++) {
      const major: boolean = line % gridMajor === 0;
      const length: number = major ? rulerMajor : rulerMinor;
      const at: number = line * cell;

      if (!major && cell < rulerMinCell) {
        continue;
      }

      ticks
        .rect(board.x + at - 0.5, board.y - length, 1, length)
        .rect(board.x - length, board.y + at - 0.5, length, 1);
    }

    ticks
      .rect(board.x, board.y - rulerSize, boardSize, 1)
      .rect(board.x - rulerSize, board.y, 1, boardSize)
      .fill({ color: iconColor, alpha: 0.5 });

    for (let index = 0; index < numbers.length; index++) {
      const value: number = (index % (numbers.length / 2)) * gridMajor;
      const number: Text = numbers[index]!;

      if (index < numbers.length / 2) {
        number.anchor.set(0, 0);
        number.position.set(
          board.x + value * cell + 3,
          board.y - rulerSize + 1,
        );
      } else {
        number.anchor.set(0, 0);
        number.position.set(
          board.x - rulerSize + 1,
          board.y + value * cell + 2,
        );
      }

      number.visible = value < spriteSize;
    }
  }

  function layoutTools(boardSize: number): number {
    const rows: number = Math.ceil(tiles.length / tileColumns);
    const height: number =
      rows * (tileSize + tileGap) - tileGap + captionGap + captionSize;
    const scale: number = Math.min(boardSize / height, 1);

    for (let index = 0; index < tiles.length; index++) {
      tiles[index]!.view.position.set(
        (index % tileColumns) * (tileSize + tileGap),
        Math.floor(index / tileColumns) * (tileSize + tileGap),
      );
    }

    caption.position.set(
      (tileColumns * (tileSize + tileGap) - tileGap) / 2,
      rows * (tileSize + tileGap) - tileGap + captionGap,
    );
    tools.scale.set(scale);

    return (tileColumns * (tileSize + tileGap) - tileGap) * scale;
  }

  function layout(): void {
    const width: number = app.screen.width;
    const height: number = app.screen.height;
    const boardSize: number =
      Math.max(
        Math.floor(
          Math.min(height * boardHeight, width * boardWidth) / spriteSize,
        ),
        1,
      ) * spriteSize;

    cell = boardSize / spriteSize;
    board.position.set(
      Math.round(width / 2 - boardSize / 2),
      Math.round(height * boardCenterY - boardSize / 2),
    );
    canvas.scale.set(cell);
    checker.clear();

    for (let y = 0; y < spriteSize; y++) {
      for (let x = 0; x < spriteSize; x++) {
        checker
          .rect(x * cell, y * cell, cell, cell)
          .fill((x + y) % 2 === 0 ? checkerLight : checkerDark);
      }
    }

    grid.clear();

    for (let line = 1; line < spriteSize; line++) {
      const alpha: number = line % gridMajor === 0 ? gridMajorAlpha : gridAlpha;

      grid
        .moveTo(line * cell, 0)
        .lineTo(line * cell, boardSize)
        .moveTo(0, line * cell)
        .lineTo(boardSize, line * cell)
        .stroke({ color: gridColor, alpha: alpha, width: 1 });
    }

    frame
      .clear()
      .rect(0, 0, boardSize, boardSize)
      .stroke({ color: iconColor, width: frameWidth, alignment: 0 });
    layoutRulers(boardSize);

    const toolsWidth: number = layoutTools(boardSize);

    tools.position.set(
      Math.round(board.x - rulerSize - panelGap - toolsWidth),
      board.y,
    );
    readout.position.set(board.x, board.y + boardSize + readoutGap);
    size.text = spriteSize + " × " + spriteSize + " PX";
    size.anchor.set(1, 0);
    size.position.set(board.x + boardSize, board.y + boardSize + readoutGap);

    swatchSize = Math.min(
      swatchMaxSize,
      (boardSize - inkHeight - inkGap) / (palette.length / paletteColumns) -
        swatchGap,
    );
    ink.position.set(board.x + boardSize + panelGap, board.y);
    swatches.position.set(ink.x, board.y + inkHeight + inkGap);
    const old: Array<Container> = swatches.removeChildren();

    for (let index = 0; index < old.length; index++) {
      if (old[index] !== selection) {
        old[index]!.destroy();
      }
    }

    for (let index = 0; index < palette.length; index++) {
      const swatch: Graphics = new Graphics()
        .rect(0, 0, swatchSize, swatchSize)
        .fill(palette[index]!);
      const value: number = toColor(palette[index]!);

      swatch.position.set(
        (index % paletteColumns) * (swatchSize + swatchGap),
        Math.floor(index / paletteColumns) * (swatchSize + swatchGap),
      );
      swatch.eventMode = "static";
      swatch.cursor = "pointer";
      swatch.on("pointerover", () => {
        hoverSwatch = index;
        hoverFade.set(1);
        drawSelection();
      });
      swatch.on("pointerout", () => hoverFade.set(0));
      swatch.on("pointertap", () => {
        color = value;

        if (tool === "eraser" || tool === "picker") {
          tool = "pencil";
        }

        refresh();
      });
      swatches.addChild(swatch);
    }

    swatches.addChild(selection);
    preview.position.set(
      swatches.x,
      swatches.y +
        (palette.length / paletteColumns) * (swatchSize + swatchGap) +
        panelGap,
    );
    small.position.set(0, previewTop);
    large.position.set(spriteSize + panelGap / 2, previewTop);

    const left: number = tools.x - benchPadding;
    const top: number = board.y - rulerSize - benchPadding;
    const right: number =
      swatches.x +
      paletteColumns * (swatchSize + swatchGap) -
      swatchGap +
      benchPadding;
    const bottom: number =
      Math.max(
        board.y + boardSize + readoutGap + readoutSize * 1.4,
        preview.y + previewTop + spriteSize * previewScale,
      ) + benchPadding;

    drawBench(left, top, right - left, bottom - top);
    slots.position.set(left, top - slotBottom - slotSize);
    title.y = slots.y + slotSize / 2;
    titleFade.snap(titleFade.value());
    hint.position.set(right, slots.y + slotSize / 2);
    status.position.set(board.x + boardSize / 2, bottom + statusGap);
    drop.layout();
    power.layout(tools.x, board.y, right - benchPadding - tools.x, boardSize);
    refresh();
  }

  function drawBench(
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    notched(bench.clear(), x, y, width, height, benchNotch)
      .fill({ color: benchColor, alpha: benchAlpha })
      .stroke({ color: benchEdge, width: plateLine, alignment: 1 });

    for (
      let dotY = y + dotGap;
      dotY < y + height - dotGap / 2;
      dotY += dotGap
    ) {
      for (
        let dotX = x + dotGap;
        dotX < x + width - dotGap / 2;
        dotX += dotGap
      ) {
        bench.rect(dotX, dotY, 1, 1);
      }
    }

    bench.fill({ color: iconColor, alpha: dotAlpha });

    for (const [rivetX, rivetY] of [
      [x + rivetInset, y + rivetInset],
      [x + width - rivetInset - rivetSize, y + rivetInset],
      [x + rivetInset, y + height - rivetInset - rivetSize],
      [x + width - rivetInset - rivetSize, y + height - rivetInset - rivetSize],
    ] as Array<[number, number]>) {
      bench.rect(rivetX, rivetY, rivetSize, rivetSize);
    }

    bench.fill(plateEdge);
  }

  function currentAction(): Action {
    return (
      actions.find(
        (value: Action) =>
          value.icon !== mirrorIcon &&
          value.icon !== flipIcon &&
          value.icon !== gridIcon &&
          value.active(),
      ) ?? actions[0]!
    );
  }

  const actions: Array<Action> = [
    {
      name: "pencil",
      key: "B",
      icon: pencilIcon,
      active: () => tool === "pencil",
      run: () => selectTool("pencil"),
    },
    {
      name: "eraser",
      key: "E",
      icon: eraserIcon,
      active: () => tool === "eraser",
      run: () => selectTool("eraser"),
    },
    {
      name: "fill",
      key: "F",
      icon: fillIcon,
      active: () => tool === "fill",
      run: () => selectTool("fill"),
    },
    {
      name: "pick",
      key: "I",
      icon: pickIcon,
      active: () => tool === "picker",
      run: () => selectTool("picker"),
    },
    {
      name: "line",
      key: "L",
      icon: lineIcon,
      active: () => tool === "line",
      run: () => selectTool("line"),
    },
    {
      name: "rectangle",
      key: "R",
      icon: rectIcon,
      active: () => tool === "rect",
      run: () => selectTool("rect"),
    },
    {
      name: "oval",
      key: "O",
      icon: ovalIcon,
      active: () => tool === "oval",
      run: () => selectTool("oval"),
    },
    {
      name: "flip",
      key: "H",
      icon: flipIcon,
      active: () => false,
      run: flip,
    },
    {
      name: "mirror",
      key: "M",
      icon: mirrorIcon,
      active: () => mirror,
      run: () => {
        mirror = !mirror;
        refresh();
      },
    },
    {
      name: "grid",
      key: "G",
      icon: gridIcon,
      active: () => showGrid,
      run: () => {
        showGrid = !showGrid;
        refresh();
      },
    },
    {
      name: "undo",
      key: "",
      icon: undoIcon,
      active: () => false,
      run: undo,
    },
    {
      name: "redo",
      key: "",
      icon: flipped(undoIcon),
      active: () => false,
      run: redo,
    },
    {
      name: "clear",
      key: "",
      icon: clearIcon,
      active: () => false,
      run: clear,
    },
    {
      name: "reset",
      key: "",
      icon: resetIcon,
      active: () => false,
      run: reset,
    },
    {
      name: "export",
      key: "",
      icon: exportIcon,
      active: () => false,
      run: exportSprite,
    },
    {
      name: "import",
      key: "",
      icon: importIcon,
      active: () => false,
      run: importSprite,
    },
  ];

  for (const action of actions) {
    const icon: Container = new Container();
    const plate: Plate = createPlate(
      tileSize,
      icon,
      true,
      0,
      action.active,
      action.run,
      (on: boolean) => {
        hoveredAction = on ? action : null;
        refresh();
      },
    );

    icon.addChild(createIcon(action.icon, tileSize * 0.62));

    if (action.key !== "") {
      const key: Text = createText(keySize, "#ffffff");

      key.text = action.key;
      key.anchor.set(1, 1);
      key.position.set(tileSize / 2 - 4, tileSize / 2 - 2);
      icon.addChild(key);
    }

    tiles.push(plate);
    tools.addChild(plate.view);
  }

  for (let index = 0; index <= drawings.length; index++) {
    const content: Container = new Container();
    const number: Text = createText(keySize, hintColor);
    const target: Drawing | undefined = drawings[index];
    const plate: Plate = createPlate(
      slotSize,
      content,
      false,
      slotRise,
      () => (target === undefined ? powering : !powering && drawing === target),
      () => {
        if (target === undefined) {
          showPower(true);
        } else {
          selectDrawing(index);
        }
      },
      () => {},
    );

    if (target === undefined) {
      const icon: Graphics = createIcon(powerIcon, slotSize * 0.6);

      icon.tint = getTheme().accent;
      content.addChild(icon);
    } else {
      const sprite: Sprite = new Sprite(target.texture);

      sprite.anchor.set(0.5);
      sprite.scale.set(slotSprite);
      content.addChild(sprite);
    }

    number.text = String(index + 1);
    number.position.set(-slotSize / 2 + 6, -slotSize / 2 + 4);
    content.addChild(number);
    plate.view.x = index * (slotSize + slotGap);
    cartridges.push(plate);
    slots.addChild(plate.view);
  }

  for (let index = 0; index < 2 * (spriteSize / gridMajor + 1); index++) {
    const number: Text = createText(rulerText, hintColor);

    number.text = String((index % (spriteSize / gridMajor + 1)) * gridMajor);
    numbers.push(number);
  }

  caption.anchor.set(0.5, 0);
  tools.addChild(caption);
  title.anchor.set(0, 0.5);
  hint.text = "1 – " + (drawings.length + 1) + "  TO SWITCH";
  hint.anchor.set(1, 0.5);
  rulers.addChild(ticks, marks, ...numbers, readout, size);
  inkChip.position.set(0, 0);
  inkLabel.anchor.set(0, 0.5);
  inkLabel.position.set(inkHeight + inkGap, inkHeight / 2);
  ink.addChild(inkChip, inkLabel);
  large.scale.set(previewScale);
  previewLabel.text = "1X  ·  3X";
  preview.addChild(previewLabel, small, large);
  board.addChild(checker, canvas, grid, hover, frame);
  status.anchor.set(0.5, 0);
  status.alpha = 0;
  mode.snap(0);
  clearHover();
  view.addChild(
    bench,
    slots,
    title,
    hint,
    board,
    rulers,
    tools,
    swatches,
    ink,
    preview,
    status,
    power.view,
    drop.view,
  );

  window.addEventListener("paste", (event: ClipboardEvent) => {
    const text: string | undefined = event.clipboardData?.getData("text");

    if (!active || text === undefined) {
      return;
    }

    event.preventDefault();
    importText(text);
  });

  app.ticker.add((ticker: Ticker) => {
    drop.update(ticker.deltaMS / 1000);
    statusTime = Math.max(statusTime - ticker.deltaMS / 1000, 0);
    status.alpha = Math.min(statusTime / statusFade, 1);
  });

  canvas.eventMode = "static";
  canvas.cursor = "crosshair";
  canvas.on("pointerdown", begin);
  canvas.on("globalpointermove", move);
  canvas.on("pointerup", end);
  canvas.on("pointerupoutside", end);
  app.canvas.addEventListener("contextmenu", (event: MouseEvent) =>
    event.preventDefault(),
  );

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!active) {
      return;
    }

    const command: boolean = event.ctrlKey || event.metaKey;

    if (!command && event.code.startsWith("Digit")) {
      const index: number = Number(event.code.slice(5)) - 1;

      if (drawings[index] !== undefined) {
        selectDrawing(index);
      } else if (index === drawings.length) {
        showPower(true);
      } else {
        return;
      }

      event.preventDefault();
      return;
    }

    if (powering) {
      return;
    }

    if (command && event.code === "KeyZ") {
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    } else if (command && event.code === "KeyY") {
      redo();
    } else if (command) {
      return;
    } else if (event.code === "KeyB") {
      selectTool("pencil");
    } else if (event.code === "KeyE") {
      selectTool("eraser");
    } else if (event.code === "KeyF") {
      selectTool("fill");
    } else if (event.code === "KeyI") {
      selectTool("picker");
    } else if (event.code === "KeyL") {
      selectTool("line");
    } else if (event.code === "KeyR") {
      selectTool("rect");
    } else if (event.code === "KeyO") {
      selectTool("oval");
    } else if (event.code === "KeyH") {
      flip();
    } else if (nudges.has(event.code)) {
      const [shiftX, shiftY] = nudges.get(event.code)!;

      nudge(shiftX, shiftY);
    } else if (event.code === "KeyM") {
      mirror = !mirror;
      refresh();
    } else if (event.code === "KeyG") {
      showGrid = !showGrid;
      refresh();
    } else {
      return;
    }

    event.preventDefault();
  });

  function setActive(value: boolean): void {
    active = value;
    power.setActive(value && powering);
    view.eventMode = value ? "passive" : "none";
    stroking = false;
    clearHover();

    if (!value) {
      drop.hide();
    }
  }

  function enter(): void {
    drawing = drawings[0]!;
    stroking = false;
    hoveredAction = null;
    showPower(false);
    mode.snap(0);
    canvas.texture = drawing.texture;
    small.texture = drawing.texture;
    large.texture = drawing.texture;
    canvasFade.snap(1);
    refresh();
    titleFade.snap(1);

    for (const plate of [...tiles, ...cartridges]) {
      plate.lit.snap(plate.active() ? 1 : 0);
    }
  }

  layout();
  setActive(false);

  app.renderer.on("resize", layout);

  return {
    view: view,
    setActive: setActive,
    enter: enter,
    fullscreen: () => true,
    topic: () => "customise",
  };
}

export { createEditor };
export type { Editor };
