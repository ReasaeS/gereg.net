import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  type Texture,
  type FederatedPointerEvent,
} from "pixi.js";
import { getTheme } from "../theme/theme";
import type { Vector } from "./data";

type Control = {
  view: Container;
  refresh: () => void;
  shown?: () => boolean;
  header?: boolean;
};

type Chip = {
  view: Container;
  label: Text;
  paint: () => void;
};

type Option<T> = {
  value: T;
  label: string;
};

const fontFamily: Array<string> = [
  "Barlow Condensed",
  "Arial Black",
  "Impact",
  "sans-serif",
];
const rowHeight: number = 30; // units
const rowWidth: number = 196; // units
const labelY: number = 8; // units
const controlY: number = 21; // units
const labelSize: number = 10; // units
const valueSize: number = 10; // units
const labelColor: string = "#9fd8ff";
const chipHeight: number = 14; // units
const chipSlant: number = 4; // units
const chipSize: number = 9; // units
const chipIdleAlpha: number = 0.55;
const arrowWidth: number = 20; // units
const trackHeight: number = 3; // units
const knobWidth: number = 5; // units
const knobHeight: number = 11; // units
const swatchGap: number = 2; // units
const vectorGap: number = 10; // units
const headerHeight: number = 24; // units
const headerSize: number = 13; // units
const headerBar: number = 3; // units
const headerSlant: number = 4; // units
const chevronSize: number = 3.5; // units
const thumbnailSize: number = 18; // units
const fieldColor: string = "#01040f";
const fieldAlpha: number = 0.85;

function createText(size: number, color: string): Text {
  return new Text({
    text: "",
    style: {
      fontFamily: fontFamily,
      fontSize: size,
      fontStyle: "italic",
      fontWeight: "900",
      fill: color,
    },
  });
}

function createRow(name: string): Container {
  const row: Container = new Container();
  const label: Text = createText(labelSize, labelColor);

  label.text = name.toUpperCase();
  label.anchor.set(0, 0.5);
  label.y = labelY;
  row.addChild(label);

  return row;
}

function createValue(row: Container): Text {
  const value: Text = createText(valueSize, "#ffffff");

  value.anchor.set(1, 0.5);
  value.position.set(rowWidth, labelY);
  row.addChild(value);

  return value;
}

function createChip(
  name: string,
  width: number,
  action: () => void,
  on: () => boolean = () => false,
): Chip {
  const view: Container = new Container();
  const back: Graphics = new Graphics();
  const label: Text = createText(chipSize, "#ffffff");

  label.text = name.toUpperCase();
  label.anchor.set(0.5);
  label.position.set(width / 2, chipHeight / 2);
  view.addChild(back, label);
  view.eventMode = "static";
  view.cursor = "pointer";
  view.hitArea = new Rectangle(0, 0, width, chipHeight);
  view.on("pointertap", action);

  function paint(): void {
    const lit: boolean = on();

    back
      .clear()
      .poly([
        chipSlant,
        0,
        width,
        0,
        width - chipSlant,
        chipHeight,
        0,
        chipHeight,
      ])
      .fill({
        color: lit ? getTheme().highlight : getTheme().menuSelected,
        alpha: lit ? 1 : chipIdleAlpha,
      });
    label.tint = lit ? getTheme().menuSelected : getTheme().menuText;
  }

  paint();

  return { view: view, label: label, paint: paint };
}

type Track = {
  view: Graphics;
  refresh: () => void;
};

function createTrack(
  width: number,
  min: number,
  max: () => number,
  step: number,
  get: () => number,
  set: (value: number) => void,
): Track {
  const track: Graphics = new Graphics();
  const knob: Graphics = new Graphics();
  let dragging: boolean = false;

  function amountOf(value: number): number {
    return Math.min(Math.max((value - min) / (max() - min), 0), 1);
  }

  function refresh(): void {
    const amount: number = amountOf(get());
    const origin: number = amountOf(0);

    track
      .clear()
      .rect(0, -trackHeight / 2, width, trackHeight)
      .fill({ color: getTheme().menuSelected, alpha: 0.8 })
      .rect(
        width * Math.min(amount, origin),
        -trackHeight / 2,
        width * Math.abs(amount - origin),
        trackHeight,
      )
      .fill(getTheme().accent);
    knob.x = width * amount;
  }

  function pick(event: FederatedPointerEvent): void {
    const local: number = track.toLocal(event.global).x;
    const amount: number = Math.min(Math.max(local / width, 0), 1);
    const raw: number = min + (max() - min) * amount;

    set(Math.round(raw / step) * step);
    refresh();
  }

  knob
    .rect(-knobWidth / 2, -knobHeight / 2, knobWidth, knobHeight)
    .fill(getTheme().highlight);
  track.eventMode = "static";
  track.cursor = "pointer";
  track.hitArea = new Rectangle(
    -knobWidth / 2,
    -knobHeight,
    width + knobWidth,
    knobHeight * 2,
  );
  track.on("pointerdown", (event: FederatedPointerEvent) => {
    dragging = true;
    pick(event);
  });
  track.on("globalpointermove", (event: FederatedPointerEvent) => {
    if (dragging) {
      pick(event);
    }
  });
  track.on("pointerup", () => {
    dragging = false;
  });
  track.on("pointerupoutside", () => {
    dragging = false;
  });
  knob.eventMode = "none";
  track.addChild(knob);

  return { view: track, refresh: refresh };
}

function rounded(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function createSlider(
  name: string,
  min: number,
  max: number | (() => number),
  step: number,
  get: () => number,
  set: (value: number) => void,
): Control {
  const view: Container = createRow(name);
  const value: Text = createValue(view);
  const track: Track = createTrack(
    rowWidth,
    min,
    typeof max === "number" ? () => max : max,
    step,
    get,
    (amount: number) => {
      set(amount);
      value.text = rounded(get());
    },
  );

  function refresh(): void {
    track.refresh();
    value.text = rounded(get());
  }

  track.view.position.set(0, controlY);
  view.addChild(track.view);

  return { view: view, refresh: refresh };
}

function createVector(
  name: string,
  min: number,
  max: number,
  step: number,
  get: () => Vector,
  set: (value: Vector) => void,
): Control {
  const view: Container = createRow(name);
  const value: Text = createValue(view);
  const width: number = (rowWidth - vectorGap) / 2;
  const axes: Array<Track> = new Array();

  function refresh(): void {
    for (const axis of axes) {
      axis.refresh();
    }

    value.text = rounded(get().x) + ", " + rounded(get().y);
  }

  for (const axis of ["x", "y"] as Array<"x" | "y">) {
    const track: Track = createTrack(
      width,
      min,
      () => max,
      step,
      () => get()[axis],
      (amount: number) => {
        set({ ...get(), [axis]: amount });
        refresh();
      },
    );

    track.view.position.set(axis === "x" ? 0 : width + vectorGap, controlY);
    view.addChild(track.view);
    axes.push(track);
  }

  return { view: view, refresh: refresh };
}

function createChoice<T>(
  name: string,
  options: () => Array<Option<T>>,
  get: () => T,
  set: (value: T) => void,
): Control {
  const view: Container = createRow(name);
  const value: Text = createText(valueSize, "#ffffff");

  function index(): number {
    return Math.max(
      options().findIndex((option: Option<T>) => option.value === get()),
      0,
    );
  }

  function step(direction: number): void {
    const list: Array<Option<T>> = options();

    if (list.length === 0) {
      return;
    }

    set(list[(index() + direction + list.length) % list.length]!.value);
    refresh();
  }

  const previous: Chip = createChip("<", arrowWidth, () => step(-1));
  const next: Chip = createChip(">", arrowWidth, () => step(1));

  function refresh(): void {
    value.text = options()[index()]?.label.toUpperCase() ?? "-";
  }

  previous.view.position.set(0, controlY - chipHeight / 2);
  next.view.position.set(rowWidth - arrowWidth, controlY - chipHeight / 2);
  value.anchor.set(0.5);
  value.position.set(rowWidth / 2, controlY);
  view.addChild(previous.view, next.view, value);

  return { view: view, refresh: refresh };
}

function createColors(
  name: string,
  colors: Array<string>,
  get: () => string,
  set: (value: string) => void,
): Control {
  const view: Container = createRow(name);
  const swatches: Graphics = new Graphics();
  const size: number = (rowWidth + swatchGap) / colors.length - swatchGap;

  function refresh(): void {
    swatches.clear();

    for (let index = 0; index < colors.length; index++) {
      const x: number = index * (size + swatchGap);
      const color: string = colors[index]!;

      swatches.rect(x, -size / 2, size, size).fill(color);

      if (color === get()) {
        swatches
          .rect(x, -size / 2, size, size)
          .stroke({ color: getTheme().highlight, width: 1.5, alignment: 0 });
      }
    }
  }

  swatches.position.set(0, controlY);
  swatches.eventMode = "static";
  swatches.cursor = "pointer";
  swatches.hitArea = new Rectangle(0, -size / 2, rowWidth, size);
  swatches.on("pointertap", (event: FederatedPointerEvent) => {
    const x: number = swatches.toLocal(event.global).x;
    const index: number = Math.floor(x / (size + swatchGap));
    const color: string | undefined = colors[index];

    if (color !== undefined) {
      set(color);
      refresh();
    }
  });
  view.addChild(swatches);

  return { view: view, refresh: refresh };
}

function createHeader(
  name: string,
  open: () => boolean,
  toggle: () => void,
): Control {
  const view: Container = new Container();
  const back: Graphics = new Graphics();
  const chevron: Graphics = new Graphics();
  const title: Text = createText(headerSize, "#ffffff");
  const middle: number = headerHeight / 2;

  title.text = name.toUpperCase();
  title.anchor.set(0, 0.5);
  title.position.set(chevronSize * 3 + 4, middle);
  chevron
    .poly([
      -chevronSize,
      -chevronSize * 0.6,
      chevronSize,
      -chevronSize * 0.6,
      0,
      chevronSize * 0.8,
    ])
    .fill(0xffffff);
  chevron.position.set(chevronSize + 2, middle);
  view.addChild(back, chevron, title);
  view.eventMode = "static";
  view.cursor = "pointer";
  view.hitArea = new Rectangle(0, 0, rowWidth, headerHeight);
  view.on("pointertap", toggle);

  function refresh(): void {
    back
      .clear()
      .poly([
        headerSlant,
        headerHeight - headerBar,
        rowWidth,
        headerHeight - headerBar,
        rowWidth - headerSlant,
        headerHeight,
        0,
        headerHeight,
      ])
      .fill({ color: getTheme().accent, alpha: open() ? 1 : 0.5 });
    chevron.rotation = open() ? 0 : -Math.PI / 2;
    title.alpha = open() ? 1 : 0.7;
  }

  refresh();

  return { view: view, refresh: refresh, header: true };
}

function drawField(
  graphics: Graphics,
  width: number,
  height: number,
  focused: boolean,
): void {
  graphics
    .clear()
    .rect(0, 0, width, height)
    .fill({ color: fieldColor, alpha: fieldAlpha })
    .rect(0, 0, width, height)
    .stroke({
      color: focused ? getTheme().accent : getTheme().highlight,
      width: focused ? 1.5 : 0.75,
      alpha: focused ? 1 : 0.7,
      alignment: 1,
    });
}

function createSpriteRow(
  name: string,
  get: () => Texture | null,
  choose: () => void,
  clear: () => void,
): Control {
  const view: Container = createRow(name);
  const chooseChip: Chip = createChip("Choose", 72, choose);
  const clearChip: Chip = createChip("Clear", 52, clear);
  const frame: Graphics = new Graphics();
  const thumbnail: Sprite = new Sprite();
  const top: number = controlY - chipHeight / 2;
  const thumbnailX: number = rowWidth - thumbnailSize;

  function refresh(): void {
    const texture: Texture | null = get();

    thumbnail.visible = texture !== null;

    if (texture !== null) {
      thumbnail.texture = texture;
      thumbnail.scale.set(
        thumbnailSize / Math.max(texture.width, texture.height),
      );
    }
  }

  chooseChip.view.position.set(0, top);
  clearChip.view.position.set(72 + 6, top);
  frame
    .rect(
      thumbnailX,
      controlY - thumbnailSize / 2 - 4,
      thumbnailSize,
      thumbnailSize,
    )
    .stroke({ color: getTheme().highlight, width: 1, alpha: 0.6 });
  thumbnail.anchor.set(0.5);
  thumbnail.position.set(thumbnailX + thumbnailSize / 2, controlY - 4);
  view.addChild(chooseChip.view, clearChip.view, frame, thumbnail);

  return { view: view, refresh: refresh };
}

export {
  fontFamily,
  rowHeight,
  rowWidth,
  chipHeight,
  createText,
  createRow,
  createChip,
  createSlider,
  createVector,
  createChoice,
  createColors,
  createHeader,
  headerHeight,
  drawField,
  createSpriteRow,
};
export type { Control, Chip, Option };
