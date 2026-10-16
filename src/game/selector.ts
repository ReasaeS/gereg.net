import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type FederatedWheelEvent,
  type Ticker,
} from "pixi.js";
import {
  cubicBezier,
  smoothDamp,
  tween,
  type Easing,
  type Spring,
} from "../effects/tween/tween";
import { getTheme } from "../theme/theme";
import { downKeys, upKeys } from "./input";
import { createText, screenResolution } from "../ui/text";
import { createGlide, mix, type Glide } from "../ui/motion";

type Choice = {
  name: string;
  title: string;
};

type Menu = {
  heading: string;
  choices: Array<Choice>;
};

type Selector = {
  view: Container;
  setMenu: (menu: Menu) => void;
  rollDown: () => Promise<void>;
  rollUp: () => Promise<void>;
  rollUpDuration: () => number;
  close: () => void;
  setActive: (active: boolean) => void;
  setScale: (scale: number) => void;
  onChoose: (listener: (index: number) => void) => void;
};

type Entry = {
  view: Container;
  name: Text;
  title: Text;
  lit: Glide;
};

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
const selectShift: number = 4; // units
const downDuration: number = 700; // ms
const upDuration: number = 450; // ms
const rollEasing: Easing = cubicBezier(0.45, 0, 0.2, 1);
const chooseKeys: Array<string> = ["Enter", "Space", "KeyZ"];
const visibleRows: number = 8;
const arrowSize: number = 5; // units
const arrowGap: number = 6; // units

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
  const list: Container = new Container();
  const listMask: Graphics = new Graphics();
  const arrows: Graphics = new Graphics();
  const scroll: Spring = { value: 0, velocity: 0 };
  let scrollTarget: number = 0;
  const entries: Array<Entry> = new Array();
  let texts: Array<Text> = [heading];
  const highlightY: Spring = { value: listY, velocity: 0 };
  const listeners: Array<(index: number) => void> = new Array();
  let selected: number = 0;
  let active: boolean = false;
  let roll: number = 0;
  let textScale: number = 1;

  function place(): void {
    door.y = -doorHeight * (1 - roll);
    view.visible = roll > 0;
  }

  function entryY(index: number): number {
    return listY + index * entryHeight;
  }

  function paint(): void {
    for (let index = 0; index < entries.length; index++) {
      entries[index]!.lit.set(index === selected ? 1 : 0);
    }
  }

  function inView(index: number): boolean {
    const top: number = entryY(index) - scroll.value;

    return (
      top >= listY - entryHeight / 2 &&
      top <= listY + (visibleRows - 0.5) * entryHeight
    );
  }

  function reveal(): void {
    const row: number = selected - Math.round(scrollTarget / entryHeight);

    if (row < 0) {
      scrollTarget = selected * entryHeight;
    } else if (row >= visibleRows) {
      scrollTarget = (selected - visibleRows + 1) * entryHeight;
    }
  }

  function select(index: number): void {
    if (entries.length === 0) {
      return;
    }

    selected = (index + entries.length) % entries.length;
    reveal();
    paint();
  }

  function drawArrows(): void {
    const center: number = doorWidth / 2;
    const top: number = listY - arrowGap;
    const bottom: number = listY + visibleRows * entryHeight + arrowGap - 4;
    const more: number =
      (entries.length - visibleRows) * entryHeight - scroll.value;

    arrows.clear();

    if (scroll.value > 1) {
      arrows
        .poly([
          center - arrowSize,
          top,
          center + arrowSize,
          top,
          center,
          top - arrowSize,
        ])
        .fill({
          color: 0xffffff,
          alpha: Math.min(scroll.value / entryHeight, 1),
        });
    }

    if (more > 1) {
      arrows
        .poly([
          center - arrowSize,
          bottom,
          center + arrowSize,
          bottom,
          center,
          bottom + arrowSize,
        ])
        .fill({ color: 0xffffff, alpha: Math.min(more / entryHeight, 1) });
    }
  }

  function choose(): void {
    if (!active) {
      return;
    }

    for (let index = 0; index < listeners.length; index++) {
      listeners[index]!(selected);
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
  heading.anchor.set(0.5);
  heading.position.set(doorWidth / 2, titleY);
  listMask
    .rect(0, listY - 2, doorWidth, visibleRows * entryHeight)
    .fill(0xffffff);
  list.addChild(highlight);
  list.mask = listMask;
  door.addChild(slats, badge, heading, list, listMask, arrows);

  function setMenu(menu: Menu): void {
    for (const entry of entries) {
      entry.view.destroy({ children: true });
    }

    entries.length = 0;
    texts = [heading];
    heading.text = menu.heading;
    selected = 0;
    scrollTarget = 0;
    scroll.value = 0;
    scroll.velocity = 0;

    for (let index = 0; index < menu.choices.length; index++) {
      addEntry(menu.choices[index]!, index);
    }

    setScale(textScale);
    paint();
  }

  function addEntry(choice: Choice, index: number): void {
    const entry: Container = new Container();
    const name: Text = createText(nameSize, "#ffffff");
    const title: Text = createText(subtitleSize, "#ffffff");
    const top: number = entryY(index);

    name.text = choice.name.toUpperCase();
    name.position.set(entryInset + entrySlant + 6, top + 4);
    title.text = choice.title;
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
      if (active && inView(index)) {
        select(index);
      }
    });
    entry.on("pointertap", () => {
      if (!inView(index)) {
        return;
      }

      select(index);
      choose();
    });
    list.addChild(entry);
    entries.push({
      view: entry,
      name: name,
      title: title,
      lit: createGlide(0, (amount: number) => {
        name.tint = mix(0xffffff, getTheme().menuSelected, amount);
        title.tint = mix(0xffffff, getTheme().menuSelected, amount);
        name.x = entryInset + entrySlant + 6 + amount * selectShift;
        title.x = name.x;
      }),
    });
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
  view.on("wheel", (event: FederatedWheelEvent) => {
    if (active && event.deltaY !== 0) {
      select(
        Math.min(
          Math.max(selected + Math.sign(event.deltaY), 0),
          entries.length - 1,
        ),
      );
    }
  });
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
    smoothDamp(
      scroll,
      scrollTarget,
      highlightSmoothing,
      current.deltaMS / 1000,
    );
    list.y = -scroll.value;
    drawArrows();

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
    textScale = scale;

    for (let index = 0; index < texts.length; index++) {
      texts[index]!.resolution = screenResolution(scale);
    }
  }

  return {
    view: view,
    setMenu: setMenu,
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
    onChoose: (listener: (index: number) => void) => {
      listeners.push(listener);
    },
  };
}

export { createSelector };
export type { Choice, Menu, Selector };
