import {
  Container,
  Graphics,
  Point,
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
import {
  buttonWidth,
  buttonHeight,
  buttonGap,
  createButton,
  paintButton,
  type Button,
} from "../ui/button";
import { createText } from "../ui/text";
import { createGlide, type Glide } from "../ui/motion";
import { drawField } from "../ui/widgets";
import type { Topic } from "../menu/help";

type Tool = "pencil" | "eraser" | "fill" | "picker";

type Editor = {
  view: Container;
  setActive: (active: boolean) => void;
  enter?: () => void;
  fullscreen?: () => boolean;
  topic?: () => Topic;
};

const maxUndo: number = 100;
const tabGap: number = 14; // px
const boardHeight: number = 0.62; // of screen height
const boardWidth: number = 0.42; // of screen width
const boardCenterY: number = 0.56; // of screen height
const panelGap: number = 30; // px
const boxPadding: number = 18; // px
const statusGap: number = 12; // px
const checkerLight: string = "#2a2f45";
const checkerDark: string = "#1f2335";
const gridColor: string = "#ffffff";
const gridAlpha: number = 0.1;
const gridMajorAlpha: number = 0.25;
const gridMajor: number = 8; // px
const frameColor: string = "#ffffff";
const frameWidth: number = 3; // px
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

function toColor(hex: string): number {
  return ((parseInt(hex.slice(1), 16) << 8) | 0xff) >>> 0;
}

function createEditor(app: Application): Editor {
  let drawing: Drawing = drawings[0]!;
  const view: Container = new Container();
  const board: Container = new Container();
  const checker: Graphics = new Graphics();
  const canvas: Sprite = new Sprite(drawing.texture);
  const grid: Graphics = new Graphics();
  const hover: Graphics = new Graphics();
  const tools: Container = new Container();
  const swatches: Container = new Container();
  const frame: Graphics = new Graphics();
  const box: Graphics = new Graphics();
  const selection: Graphics = new Graphics();
  const preview: Container = new Container();
  const small: Sprite = new Sprite(drawing.texture);
  const large: Sprite = new Sprite(drawing.texture);
  const local: Point = new Point();
  const status: Text = createText(statusSize, statusColor);
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
  let powering: boolean = false;
  const power: Power = createPower(app, playerTexture(), droneTexture());
  const drawingParts: Array<Container> = [board, tools, swatches, preview];
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
  const chosenX: Glide = createGlide(0, drawSelection);
  const chosenY: Glide = createGlide(0, drawSelection);
  const hoverFade: Glide = createGlide(0, drawSelection);
  let hoverSwatch: number = -1;
  let chosenPlaced: boolean = false;

  function refresh(): void {
    drawing.source.update();

    for (let index = 0; index < buttons.length; index++) {
      paintButton(buttons[index]!);
    }

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

  function placeSelection(): void {
    const index: number = palette.findIndex(
      (hex: string) => toColor(hex) === color,
    );

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

  function drawSelection(): void {
    const step: number = swatchSize + swatchGap;

    selection.clear();

    if (hoverSwatch >= 0 && hoverFade.value() > 0) {
      selection
        .rect(
          (hoverSwatch % paletteColumns) * step - 1,
          Math.floor(hoverSwatch / paletteColumns) * step - 1,
          swatchSize + 2,
          swatchSize + 2,
        )
        .stroke({
          color: hoverColor,
          width: 2,
          alpha: hoverFade.value() * 0.5,
        });
    }

    selection
      .rect(
        chosenX.value() * step - 2,
        chosenY.value() * step - 2,
        swatchSize + 4,
        swatchSize + 4,
      )
      .stroke({ color: hoverColor, width: 3 });
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
    hover.clear();
    refresh();
  }

  function showPower(value: boolean): void {
    powering = value;
    stroking = false;
    hover.clear();
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
    tabs.position.set(board.x, board.y - boxPadding - buttonHeight - tabGap);
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
    large.position.set(spriteSize + panelGap / 2, 0);
    const right: number =
      swatches.x + paletteColumns * (swatchSize + swatchGap) - swatchGap;
    const bottom: number = Math.max(
      board.y + boardSize,
      tools.y + toolList.length * (buttonHeight + buttonGap) - buttonGap,
      preview.y + spriteSize * previewScale,
    );

    box.position.set(tools.x - boxPadding, board.y - boxPadding);
    drawField(
      box,
      right - tools.x + boxPadding * 2,
      bottom - board.y + boxPadding * 2,
      0,
    );
    status.position.set(
      board.x + boardSize / 2,
      bottom + boxPadding + statusGap,
    );
    power.layout(
      tools.x,
      board.y,
      swatches.x + paletteColumns * (swatchSize + swatchGap) - tools.x,
      boardSize,
    );
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
      () => !powering && drawing === target,
      () => selectDrawing(index),
    );
    button.view.x = index * (buttonWidth + buttonGap);
    buttons.push(button);
    tabs.addChild(button.view);
  }

  const powerButton: Button = createButton(
    "power",
    () => powering,
    () => showPower(true),
  );

  powerButton.view.x = drawings.length * (buttonWidth + buttonGap);
  buttons.push(powerButton);
  tabs.addChild(powerButton.view);

  large.scale.set(previewScale);
  preview.addChild(small, large);
  board.addChild(checker, canvas, grid, hover, frame);
  status.anchor.set(0.5, 0);
  status.alpha = 0;
  mode.snap(0);
  view.addChild(box, board, tabs, tools, swatches, preview, status, power.view);

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
    hover.clear();
  }

  function enter(): void {
    drawing = drawings[0]!;
    stroking = false;
    showPower(false);
    mode.snap(0);
    canvas.texture = drawing.texture;
    small.texture = drawing.texture;
    large.texture = drawing.texture;
    canvasFade.snap(1);
    refresh();

    for (const button of buttons) {
      button.lit.snap(button.active() ? 1 : 0);
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
