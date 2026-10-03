import {
  BufferImageSource,
  Container,
  Graphics,
  Point,
  Sprite,
  Text,
  Texture,
  type Application,
  type FederatedPointerEvent,
  type Ticker,
} from "pixi.js";
import {
  createPixels,
  inside,
  getPixel,
  setPixel,
  drawLine,
  floodFill,
  isEmpty,
  encodePixels,
  decodePixels,
  exportPixels,
  importPixels,
  type Pixels,
} from "./pixels";
import { drawGameDefault, drawMenuDefault } from "./default";
import {
  buttonWidth,
  buttonHeight,
  buttonGap,
  createButton,
  paintButton,
  type Button,
} from "./button";

type Tool = "pencil" | "eraser" | "fill" | "picker";

type Drawing = {
  name: string;
  storageKey: string;
  pixels: Pixels;
  source: BufferImageSource;
  texture: Texture;
  undo: Array<Uint8Array>;
  redo: Array<Uint8Array>;
  drawDefault: (pixels: Pixels) => void;
};

type Editor = {
  view: Container;
  setActive: (active: boolean) => void;
};

const spriteSize: number = 32; // px
const gameStorageKey: string = "geregnet.playerSprite";
const menuStorageKey: string = "geregnet.menuSprite";
const maxUndo: number = 100;
const fontFamily: Array<string> = [
  "Barlow Condensed",
  "Arial Black",
  "Impact",
  "sans-serif",
];
const tabGap: number = 14; // px
const boardHeight: number = 0.62; // of screen height
const boardWidth: number = 0.42; // of screen width
const boardCenterY: number = 0.56; // of screen height
const panelGap: number = 30; // px
const checkerLight: string = "#2a2f45";
const checkerDark: string = "#1f2335";
const frameColor: string = "#ffffff";
const frameWidth: number = 3; // px
const gridColor: string = "#ffffff";
const gridAlpha: number = 0.1;
const gridMajorAlpha: number = 0.25;
const gridMajor: number = 8; // px
const hoverColor: string = "#ffffff";
const paletteColumns: number = 4;
const swatchMaxSize: number = 36; // px
const swatchGap: number = 4; // px
const previewScale: number = 3;
const transparent: number = 0;
const statusSize: number = 24; // px
const statusColor: string = "#cfeeff";
const statusDuration: number = 2.5; // s
const statusFade: number = 0.5; // s

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

function createDrawing(
  name: string,
  storageKey: string,
  drawDefault: (pixels: Pixels) => void,
): Drawing {
  const pixels: Pixels = createPixels(spriteSize);
  const source: BufferImageSource = new BufferImageSource({
    resource: pixels.data,
    width: spriteSize,
    height: spriteSize,
    scaleMode: "nearest",
  });

  return {
    name: name,
    storageKey: storageKey,
    pixels: pixels,
    source: source,
    texture: new Texture({ source: source }),
    undo: new Array(),
    redo: new Array(),
    drawDefault: drawDefault,
  };
}

const drawings: Array<Drawing> = [
  createDrawing("in game", gameStorageKey, drawGameDefault),
  createDrawing("menu", menuStorageKey, drawMenuDefault),
];
let drawing: Drawing = drawings[0]!;

function toColor(hex: string): number {
  return ((parseInt(hex.slice(1), 16) << 8) | 0xff) >>> 0;
}

function load(target: Drawing): void {
  target.drawDefault(target.pixels);

  try {
    const saved: string | null = localStorage.getItem(target.storageKey);

    if (saved !== null && !decodePixels(target.pixels, saved)) {
      target.drawDefault(target.pixels);
    }

    if (isEmpty(target.pixels)) {
      target.drawDefault(target.pixels);
    }
  } catch {
    console.warn("Could not load the " + target.name + " sprite");
  }

  target.source.update();
}

function save(): void {
  try {
    localStorage.setItem(drawing.storageKey, encodePixels(drawing.pixels));
  } catch {
    console.warn("Could not save the " + drawing.name + " sprite");
  }
}

function playerTexture(): Texture {
  return drawings[0]!.texture;
}

function menuTexture(): Texture {
  return drawings[1]!.texture;
}

function menuPixels(): Pixels {
  return drawings[1]!.pixels;
}

function createEditor(app: Application): Editor {
  const view: Container = new Container();
  const board: Container = new Container();
  const checker: Graphics = new Graphics();
  const canvas: Sprite = new Sprite(drawing.texture);
  const grid: Graphics = new Graphics();
  const hover: Graphics = new Graphics();
  const frame: Graphics = new Graphics();
  const tools: Container = new Container();
  const swatches: Container = new Container();
  const selection: Graphics = new Graphics();
  const preview: Container = new Container();
  const small: Sprite = new Sprite(drawing.texture);
  const large: Sprite = new Sprite(drawing.texture);
  const local: Point = new Point();
  const status: Text = new Text({
    text: "",
    style: {
      fontFamily: fontFamily,
      fontSize: statusSize,
      fontStyle: "italic",
      fontWeight: "900",
      fill: statusColor,
    },
  });
  let statusTime: number = 0;
  const buttons: Array<Button> = new Array();
  const tabs: Container = new Container();
  let tool: Tool = "pencil";
  let color: number = toColor(palette[0]!);
  let mirror: boolean = false;
  let showGrid: boolean = true;
  let active: boolean = false;
  let stroking: boolean = false;
  let erasing: boolean = false;
  let lastX: number = 0;
  let lastY: number = 0;
  let cell: number = 1;
  let swatchSize: number = swatchMaxSize;

  function refresh(): void {
    drawing.source.update();

    for (let index = 0; index < buttons.length; index++) {
      paintButton(buttons[index]!);
    }

    drawSelection();
    grid.visible = showGrid;
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
    plot(x, y);
    refresh();
  }

  function move(event: FederatedPointerEvent): void {
    const [x, y] = cellAt(event) as [number, number];

    drawHover(x, y);

    if (!stroking) {
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
    save();
  }

  function drawHover(x: number, y: number): void {
    hover.clear();

    if (!active || !inside(drawing.pixels, x, y)) {
      return;
    }

    hover.rect(x * cell, y * cell, cell, cell);

    if (mirror) {
      hover.rect((spriteSize - 1 - x) * cell, y * cell, cell, cell);
    }

    hover.stroke({ color: hoverColor, width: 2, alpha: 0.8 });
  }

  function drawSelection(): void {
    selection.clear();

    for (let index = 0; index < palette.length; index++) {
      if (toColor(palette[index]!) !== color) {
        continue;
      }

      const column: number = index % paletteColumns;
      const row: number = Math.floor(index / paletteColumns);

      selection
        .rect(
          column * (swatchSize + swatchGap) - 2,
          row * (swatchSize + swatchGap) - 2,
          swatchSize + 4,
          swatchSize + 4,
        )
        .stroke({ color: hoverColor, width: 3 });
    }
  }

  function selectDrawing(index: number): void {
    const next: Drawing | undefined = drawings[index];

    if (next === undefined || next === drawing) {
      return;
    }

    stroking = false;
    drawing = next;
    canvas.texture = drawing.texture;
    small.texture = drawing.texture;
    large.texture = drawing.texture;
    hover.clear();
    refresh();
  }

  function selectTool(value: Tool): void {
    tool = value;
    refresh();
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
      .stroke({ color: frameColor, width: frameWidth, alignment: 0 });
    tabs.position.set(board.x, board.y - buttonHeight - tabGap);
    tools.position.set(board.x - panelGap - buttonWidth, board.y);

    swatchSize = Math.min(
      swatchMaxSize,
      boardSize / (palette.length / paletteColumns) - swatchGap,
    );
    swatches.position.set(board.x + boardSize + panelGap, board.y);
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
    large.position.set(spriteSize + panelGap / 2, 0);
    status.position.set(board.x + boardSize / 2, board.y + boardSize + 12);
    refresh();
  }

  const toolList: Array<[string, () => boolean, () => void]> = [
    ["pencil", () => tool === "pencil", () => selectTool("pencil")],
    ["eraser", () => tool === "eraser", () => selectTool("eraser")],
    ["fill", () => tool === "fill", () => selectTool("fill")],
    ["pick", () => tool === "picker", () => selectTool("picker")],
    [
      "mirror",
      () => mirror,
      () => {
        mirror = !mirror;
        refresh();
      },
    ],
    [
      "grid",
      () => showGrid,
      () => {
        showGrid = !showGrid;
        refresh();
      },
    ],
    ["undo", () => false, undo],
    ["redo", () => false, redo],
    ["clear", () => false, clear],
    ["reset", () => false, reset],
    ["export", () => false, exportSprite],
    ["import", () => false, importSprite],
  ];

  for (let index = 0; index < toolList.length; index++) {
    const [name, isOn, action] = toolList[index]!;
    const button: Button = createButton(name, isOn, action);
    button.view.y = index * (buttonHeight + buttonGap);
    buttons.push(button);
    tools.addChild(button.view);
  }

  for (let index = 0; index < drawings.length; index++) {
    const target: Drawing = drawings[index]!;
    const button: Button = createButton(
      target.name,
      () => drawing === target,
      () => selectDrawing(index),
    );
    button.view.x = index * (buttonWidth + buttonGap);
    buttons.push(button);
    tabs.addChild(button.view);
  }

  large.scale.set(previewScale);
  preview.addChild(small, large);
  board.addChild(checker, canvas, grid, hover, frame);
  status.anchor.set(0.5, 0);
  status.alpha = 0;
  view.addChild(board, tabs, tools, swatches, preview, status);

  window.addEventListener("paste", (event: ClipboardEvent) => {
    const text: string | undefined = event.clipboardData?.getData("text");

    if (!active || text === undefined) {
      return;
    }

    event.preventDefault();
    importText(text);
  });

  app.ticker.add((ticker: Ticker) => {
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
      } else {
        return;
      }

      event.preventDefault();
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
    view.eventMode = value ? "passive" : "none";
    stroking = false;
    hover.clear();
  }

  for (let index = 0; index < drawings.length; index++) {
    load(drawings[index]!);
  }

  layout();
  setActive(false);

  app.renderer.on("resize", layout);

  return { view: view, setActive: setActive };
}

export { createEditor, playerTexture, menuTexture, menuPixels };
export type { Editor };
