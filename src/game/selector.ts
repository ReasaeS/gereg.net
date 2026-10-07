import { Container, Graphics, Rectangle, Text, type Ticker } from "pixi.js";
import {
  cubicBezier,
  smoothDamp,
  tween,
  type Easing,
  type Spring,
} from "../effects/tween/tween";
import { getTheme } from "../theme/theme";
import { levels, type Level } from "./levels";

type Selector = {
  view: Container;
  rollDown: () => Promise<void>;
  rollUp: () => Promise<void>;
  rollUpDuration: () => number;
  close: () => void;
  setActive: (active: boolean) => void;
  setScale: (scale: number) => void;
  onChoose: (listener: (level: Level) => void) => void;
};

type Entry = {
  view: Container;
  name: Text;
  title: Text;
};

const fontFamily: Array<string> = [
  "Barlow Condensed",
  "Arial Black",
  "Impact",
  "sans-serif",
];
const doorX: number = 424; // units
const doorY: number = 8; // units
const doorWidth: number = 208; // units
const doorHeight: number = 464; // units
const railWidth: number = 5; // units
const railColor: string = "#01040f";
const slatHeight: number = 16; // units
const slatColor: string = "#0c2669";
const slatLight: string = "#1f4aa0";
const slatShadow: string = "#020a26";
const slatGroove: number = 2; // units
const bottomHeight: number = 14; // units
const bottomColor: string = "#020a26";
const handleWidth: number = 44; // units
const handleHeight: number = 5; // units
const titleY: number = 30; // units
const titleHeight: number = 26; // units
const titleSlant: number = 8; // units
const titleSize: number = 20; // px
const listY: number = 82; // units
const entryHeight: number = 44; // units
const entryInset: number = 14; // units
const entrySlant: number = 10; // units
const nameSize: number = 20; // px
const subtitleSize: number = 12; // px
const subtitleColor: string = "#9fd8ff";
const highlightSmoothing: number = 0.08; // s
const downDuration: number = 700; // ms
const upDuration: number = 450; // ms
const rollEasing: Easing = cubicBezier(0.45, 0, 0.2, 1);
const upKeys: Array<string> = ["ArrowUp", "KeyW"];
const downKeys: Array<string> = ["ArrowDown", "KeyS"];
const chooseKeys: Array<string> = ["Enter", "Space", "KeyZ"];

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

function drawDoor(door: Graphics): void {
  door.clear();

  for (let y = 0; y < doorHeight - bottomHeight; y += slatHeight) {
    door
      .rect(0, y, doorWidth, slatHeight)
      .fill(slatColor)
      .rect(0, y, doorWidth, slatGroove)
      .fill(slatLight)
      .rect(0, y + slatHeight - slatGroove, doorWidth, slatGroove)
      .fill(slatShadow);
  }

  door
    .rect(0, doorHeight - bottomHeight, doorWidth, bottomHeight)
    .fill(bottomColor)
    .rect(
      doorWidth / 2 - handleWidth / 2,
      doorHeight - bottomHeight / 2 - handleHeight / 2,
      handleWidth,
      handleHeight,
    )
    .fill(getTheme().accent);
}

function createSelector(ticker: Ticker): Selector {
  const view: Container = new Container();
  const door: Container = new Container();
  const slats: Graphics = new Graphics();
  const rails: Graphics = new Graphics();
  const mask: Graphics = new Graphics();
  const badge: Graphics = new Graphics();
  const heading: Text = createText(titleSize, "#ffffff");
  const highlight: Graphics = new Graphics();
  const entries: Array<Entry> = new Array();
  const texts: Array<Text> = [heading];
  const highlightY: Spring = { value: listY, velocity: 0 };
  const listeners: Array<(level: Level) => void> = new Array();
  let selected: number = 0;
  let active: boolean = false;
  let roll: number = 0;

  function place(): void {
    door.y = -doorHeight * (1 - roll);
    view.visible = roll > 0;
  }

  function entryY(index: number): number {
    return listY + index * entryHeight;
  }

  function paint(): void {
    for (let index = 0; index < entries.length; index++) {
      const entry: Entry = entries[index]!;
      const chosen: boolean = index === selected;

      entry.name.tint = chosen ? getTheme().menuSelected : 0xffffff;
      entry.title.tint = chosen ? getTheme().menuSelected : 0xffffff;
    }
  }

  function select(index: number): void {
    selected = (index + levels.length) % levels.length;
    paint();
  }

  function choose(): void {
    if (!active) {
      return;
    }

    const level: Level = levels[selected]!;

    for (let index = 0; index < listeners.length; index++) {
      listeners[index]!(level);
    }
  }

  drawDoor(slats);
  badge
    .poly([
      entryInset + titleSlant,
      titleY - titleHeight / 2,
      doorWidth - entryInset,
      titleY - titleHeight / 2,
      doorWidth - entryInset - titleSlant,
      titleY + titleHeight / 2,
      entryInset,
      titleY + titleHeight / 2,
    ])
    .fill(getTheme().accent);
  heading.text = "STAGE SELECT";
  heading.anchor.set(0.5);
  heading.position.set(doorWidth / 2, titleY);
  door.addChild(slats, badge, heading, highlight);

  for (let index = 0; index < levels.length; index++) {
    const level: Level = levels[index]!;
    const entry: Container = new Container();
    const name: Text = createText(nameSize, "#ffffff");
    const title: Text = createText(subtitleSize, "#ffffff");
    const top: number = entryY(index);

    name.text = level.name.toUpperCase();
    name.position.set(entryInset + entrySlant + 6, top + 4);
    title.text = level.title;
    title.style.fill = subtitleColor;
    title.position.set(entryInset + entrySlant + 6, top + 4 + nameSize + 1);
    entry.addChild(name, title);
    entry.eventMode = "static";
    entry.cursor = "pointer";
    entry.hitArea = new Rectangle(
      entryInset,
      top,
      doorWidth - entryInset * 2,
      entryHeight - 4,
    );
    entry.on("pointerover", () => {
      if (active) {
        select(index);
      }
    });
    entry.on("pointertap", () => {
      select(index);
      choose();
    });
    door.addChild(entry);
    entries.push({ view: entry, name: name, title: title });
    texts.push(name, title);
  }

  rails
    .rect(0, 0, railWidth, doorHeight)
    .rect(doorWidth - railWidth, 0, railWidth, doorHeight)
    .fill(railColor);
  mask.rect(0, 0, doorWidth, doorHeight).fill(0xffffff);
  door.mask = mask;
  view.position.set(doorX, doorY);
  view.addChild(door, mask, rails);
  view.eventMode = "none";
  paint();
  place();

  ticker.add((current: Ticker) => {
    if (!view.visible) {
      return;
    }

    smoothDamp(
      highlightY,
      entryY(selected),
      highlightSmoothing,
      current.deltaMS / 1000,
    );

    const top: number = highlightY.value;
    const bottom: number = top + entryHeight - 4;

    highlight
      .clear()
      .poly([
        entryInset + entrySlant,
        top,
        doorWidth - entryInset,
        top,
        doorWidth - entryInset - entrySlant,
        bottom,
        entryInset,
        bottom,
      ])
      .fill(getTheme().highlight);
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (upKeys.includes(event.code)) {
      select(selected - 1);
    } else if (downKeys.includes(event.code)) {
      select(selected + 1);
    } else if (chooseKeys.includes(event.code)) {
      choose();
    } else {
      return;
    }

    event.preventDefault();
  });

  function rollTo(target: number, duration: number): Promise<void> {
    const from: number = roll;

    if (from === target) {
      return Promise.resolve();
    }

    return tween(ticker, duration * Math.abs(target - from), (progress) => {
      roll = from + (target - from) * rollEasing(progress);
      place();
    });
  }

  function setActive(value: boolean): void {
    active = value;
    view.eventMode = value ? "passive" : "none";
  }

  function setScale(scale: number): void {
    for (let index = 0; index < texts.length; index++) {
      texts[index]!.resolution = scale * (window.devicePixelRatio || 1);
    }
  }

  return {
    view: view,
    rollDown: () => {
      highlightY.value = entryY(selected);
      highlightY.velocity = 0;
      return rollTo(1, downDuration);
    },
    rollUp: () => rollTo(0, upDuration),
    rollUpDuration: () => upDuration * roll,
    close: () => {
      roll = 0;
      place();
    },
    setActive: setActive,
    setScale: setScale,
    onChoose: (listener: (level: Level) => void) => {
      listeners.push(listener);
    },
  };
}

export { createSelector };
export type { Selector };
