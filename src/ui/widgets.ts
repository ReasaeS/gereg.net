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
import type { Vector } from "../create/types";
import { createText } from "./text";
import { createGlide, mix, type Glide } from "./motion";
import { createRetype, type Retype } from "./retype";

type Control = {
  view: Container;
  refresh: () => void;
  shown?: () => boolean;
  header?: boolean;
};

type Name = string | (() => string);

type Row = {
  view: Container;
  refresh: () => void;
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

type Track = {
  view: Graphics;
  refresh: () => void;
};

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
const hoverAlpha: number = 0.25;
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
const choiceSlide: number = 10; // units
const fieldColor: string = "#01040f";
const fieldAlpha: number = 0.85;

function nameOf(name: Name): string {
  return (typeof name === "string" ? name : name()).toUpperCase();
}

function onScreen(view: Container): boolean {
  for (let node: Container | null = view; node !== null; node = node.parent) {
    if (!node.visible) {
      return false;
    }
  }

  return true;
}

function createRow(name: Name): Row {
  const row: Container = new Container();
  const label: Text = createText(labelSize, labelColor);
  const retype: Retype = createRetype(label);

  label.text = nameOf(name);
  label.anchor.set(0, 0.5);
  label.y = labelY;
  row.addChild(label);

  return {
    view: row,
    refresh: () => retype.set(nameOf(name), onScreen(row) && row.alpha > 0.5),
  };
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
  const lit: Glide = createGlide(on() ? 1 : 0, draw);
  const hover: Glide = createGlide(0, draw);

  function draw(): void {
    const amount: number = lit.value();

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
        color: mix(getTheme().menuSelected, getTheme().highlight, amount),
        alpha:
          chipIdleAlpha +
          (1 - chipIdleAlpha) * amount +
          hoverAlpha * hover.value() * (1 - amount),
      });
    label.tint = mix(getTheme().menuText, getTheme().menuSelected, amount);
  }

  function paint(): void {
    lit.set(on() ? 1 : 0);
    draw();
  }

  label.text = name.toUpperCase();
  label.anchor.set(0.5);
  label.position.set(width / 2, chipHeight / 2);
  view.addChild(back, label);
  view.eventMode = "static";
  view.cursor = "pointer";
  view.hitArea = new Rectangle(0, 0, width, chipHeight);
  view.on("pointertap", action);
  view.on("pointerover", () => hover.set(1));
  view.on("pointerout", () => hover.set(0));
  draw();

  return { view: view, label: label, paint: paint };
}

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
  const amount: Glide = createGlide(0, draw);
  const hover: Glide = createGlide(0, draw);
  let dragging: boolean = false;
  let placed: boolean = false;

  function amountOf(value: number): number {
    return Math.min(Math.max((value - min) / (max() - min), 0), 1);
  }

  function draw(): void {
    const shown: number = amount.value();
    const origin: number = amountOf(0);

    track
      .clear()
      .rect(0, -trackHeight / 2, width, trackHeight)
      .fill({ color: getTheme().menuSelected, alpha: 0.8 })
      .rect(
        width * Math.min(shown, origin),
        -trackHeight / 2,
        width * Math.abs(shown - origin),
        trackHeight,
      )
      .fill(getTheme().accent);
    knob.x = width * shown;
    knob.scale.y = 1 + hover.value() * 0.25;
  }

  function refresh(): void {
    if (placed) {
      amount.set(amountOf(get()));
    } else {
      placed = true;
      amount.snap(amountOf(get()));
    }

    draw();
  }

  function pick(event: FederatedPointerEvent): void {
    const local: number = track.toLocal(event.global).x;
    const share: number = Math.min(Math.max(local / width, 0), 1);
    const raw: number = min + (max() - min) * share;

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
  track.on("pointerover", () => hover.set(1));
  track.on("pointerout", () => hover.set(0));
  knob.eventMode = "none";
  track.addChild(knob);

  return { view: track, refresh: refresh };
}

function rounded(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function createSlider(
  name: Name,
  min: number,
  max: number | (() => number),
  step: number,
  get: () => number,
  set: (value: number) => void,
): Control {
  const row: Row = createRow(name);
  const view: Container = row.view;
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
    row.refresh();
    track.refresh();
    value.text = rounded(get());
  }

  track.view.position.set(0, controlY);
  view.addChild(track.view);

  return { view: view, refresh: refresh };
}

function createVector(
  name: Name,
  min: number,
  max: number,
  step: number,
  get: () => Vector,
  set: (value: Vector) => void,
): Control {
  const row: Row = createRow(name);
  const view: Container = row.view;
  const value: Text = createValue(view);
  const width: number = (rowWidth - vectorGap) / 2;
  const axes: Array<Track> = new Array();

  function refresh(): void {
    row.refresh();

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
  name: Name,
  options: () => Array<Option<T>>,
  get: () => T,
  set: (value: T) => void,
): Control {
  const row: Row = createRow(name);
  const view: Container = row.view;
  const value: Text = createText(valueSize, "#ffffff");
  const slide: Glide = createGlide(0, (offset: number) => {
    value.x = rowWidth / 2 + offset;
    value.alpha = 1 - Math.min(Math.abs(offset) / choiceSlide, 1) * 0.8;
  });

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
    slide.snap(direction * choiceSlide);
    slide.set(0);
    refresh();
  }

  const previous: Chip = createChip("<", arrowWidth, () => step(-1));
  const next: Chip = createChip(">", arrowWidth, () => step(1));

  function refresh(): void {
    row.refresh();
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
  name: Name,
  colors: Array<string>,
  get: () => string,
  set: (value: string) => void,
): Control {
  const row: Row = createRow(name);
  const view: Container = row.view;
  const swatches: Graphics = new Graphics();
  const size: number = (rowWidth + swatchGap) / colors.length - swatchGap;
  const height: number = Math.min(size, chipHeight);
  const chosen: Glide = createGlide(0, draw);
  const shown: Glide = createGlide(0, draw);
  const hover: Glide = createGlide(0, draw);
  let hovered: number = -1;
  let placed: boolean = false;

  function outline(position: number, alpha: number, width: number): void {
    swatches
      .rect(position * (size + swatchGap), -height / 2, size, height)
      .stroke({
        color: getTheme().highlight,
        width: width,
        alpha: alpha,
        alignment: 0,
      });
  }

  function draw(): void {
    swatches.clear();

    for (let index = 0; index < colors.length; index++) {
      swatches
        .rect(index * (size + swatchGap), -height / 2, size, height)
        .fill(colors[index]!);
    }

    if (hovered >= 0 && hover.value() > 0) {
      outline(hovered, hover.value() * 0.5, 1);
    }

    if (shown.value() > 0) {
      outline(chosen.value(), shown.value(), 1.5);
    }
  }

  function refresh(): void {
    const index: number = colors.indexOf(get());

    row.refresh();

    if (!placed) {
      placed = true;
      chosen.snap(Math.max(index, 0));
      shown.snap(index >= 0 ? 1 : 0);
    } else {
      if (index >= 0) {
        chosen.set(index);
      }

      shown.set(index >= 0 ? 1 : 0);
    }

    draw();
  }

  function indexAt(event: FederatedPointerEvent): number {
    const x: number = swatches.toLocal(event.global).x;

    return Math.min(
      Math.max(Math.floor(x / (size + swatchGap)), 0),
      colors.length - 1,
    );
  }

  swatches.position.set(0, controlY);
  swatches.eventMode = "static";
  swatches.cursor = "pointer";
  swatches.hitArea = new Rectangle(0, -height / 2, rowWidth, height);
  swatches.on("pointertap", (event: FederatedPointerEvent) => {
    set(colors[indexAt(event)]!);
    refresh();
  });
  swatches.on("pointermove", (event: FederatedPointerEvent) => {
    hovered = indexAt(event);
    hover.set(1);
    draw();
  });
  swatches.on("pointerout", () => hover.set(0));
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
  const opened: Glide = createGlide(open() ? 1 : 0, draw);
  const hover: Glide = createGlide(0, draw);

  function draw(): void {
    const amount: number = opened.value();

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
      .fill({
        color: getTheme().accent,
        alpha: Math.min(0.5 + amount * 0.5 + hover.value() * 0.2, 1),
      });
    chevron.rotation = (amount - 1) * (Math.PI / 2);
    title.alpha = Math.min(0.7 + amount * 0.3 + hover.value() * 0.15, 1);
  }

  function refresh(): void {
    opened.set(open() ? 1 : 0);
    draw();
  }

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
  view.on("pointerover", () => hover.set(1));
  view.on("pointerout", () => hover.set(0));
  draw();

  return { view: view, refresh: refresh, header: true };
}

function drawField(
  graphics: Graphics,
  width: number,
  height: number,
  focus: number,
): void {
  graphics
    .clear()
    .rect(0, 0, width, height)
    .fill({ color: fieldColor, alpha: fieldAlpha })
    .rect(0, 0, width, height)
    .stroke({
      color: mix(getTheme().highlight, getTheme().accent, focus),
      width: 0.75 + focus * 0.75,
      alpha: 0.7 + focus * 0.3,
      alignment: 1,
    });
}

function createSpriteRow(
  name: Name,
  get: () => Texture | null,
  choose: () => void,
  clear: () => void,
): Control {
  const row: Row = createRow(name);
  const view: Container = row.view;
  const chooseChip: Chip = createChip("Choose", 72, choose);
  const clearChip: Chip = createChip("Clear", 52, clear);
  const frame: Graphics = new Graphics();
  const thumbnail: Sprite = new Sprite();
  const top: number = controlY - chipHeight / 2;
  const thumbnailX: number = rowWidth - thumbnailSize;
  const fade: Glide = createGlide(0, (alpha: number) => {
    thumbnail.alpha = alpha;
  });
  let current: Texture | null = null;

  function refresh(): void {
    const texture: Texture | null = get();

    row.refresh();

    if (texture === current) {
      return;
    }

    current = texture;
    thumbnail.visible = texture !== null;

    if (texture !== null) {
      thumbnail.texture = texture;
      thumbnail.scale.set(
        thumbnailSize / Math.max(texture.width, texture.height),
      );
      fade.snap(0);
      fade.set(1);
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
  rowHeight,
  rowWidth,
  chipHeight,
  headerHeight,
  headerSlant,
  createRow,
  createChip,
  createSlider,
  createVector,
  createChoice,
  createColors,
  createHeader,
  drawField,
  createSpriteRow,
};
export type { Control, Chip, Option, Name };
