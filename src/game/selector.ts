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
import { getTheme, type Theme } from "../theme/theme";
import { downKeys, shotKeys, upKeys } from "./input";
import { createText, screenResolution } from "../ui/text";
import { createGlide, mix, type Glide } from "../ui/motion";

type Choice = {
  name: string;
  title: string;
  starred?: boolean;
};

type Menu = {
  heading: string;
  choices: Array<Choice>;
  remember?: boolean;
  selected?: number;
  searchable?: boolean;
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
  onSelect: (listener: (index: number) => void) => void;
  chosenIndex: () => number;
  reload: (index: number) => void;
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
const frameColor: string = "#1f4aa0";
const skyBands: number = 24;
const seaBands: number = 6;
const seaTop: number = 404; // units
const shadeAlpha: number = 0.5;
const cardColor: string = "#0c2669";
const cardAlpha: number = 0.88;
const cardWidth: number = 178; // units
const cardHeight: number = 40; // units
const cardSlant: number = 10; // units
const cardPadding: number = 8; // units
const stripeWidth: number = 4; // units
const wheelY: number = 262; // units
const wheelTop: number = 80; // units
const wheelBottom: number = 448; // units
const wheelSpacing: number = 50; // units
const wheelCurve: number = 5; // units
const wheelShrink: number = 0.12;
const wheelFade: number = 0.26;
const wheelReach: number = 4.5;
const slideDistance: number = 90; // units
const cardStagger: number = 0.08;
const fadeSpeed: number = 2;
const titleY: number = 30; // units
const titleHeight: number = 26; // units
const titleSlant: number = 8; // units
const titleSize: number = 20; // px
const entryInset: number = 14; // units
const entrySlant: number = 10; // units
const nameSize: number = 20; // px
const subtitleSize: number = 12; // px
const subtitleColor: string = "#9fd8ff";
const highlightSmoothing: number = 0.08; // s
const selectShift: number = 4; // units
const starRadius: number = 9; // units
const starInner: number = 0.45;
const starPoints: number = 5;
const starSpace: number = 23; // units
const downDuration: number = 700; // ms
const upDuration: number = 450; // ms
const rollEasing: Easing = cubicBezier(0.45, 0, 0.2, 1);
const chooseKeys: Array<string> = ["Enter", "Space"];
const arrowSize: number = 5; // units
const arrowGap: number = 6; // units
const searchY: number = 58; // units
const searchHeight: number = 18; // units
const searchSize: number = 11; // px
const searchPadding: number = 8; // units
const searchIcon: number = 4; // units
const queryLength: number = 16;
const caretBlink: number = 1; // s
const searchPlaceholder: string = "PRESS / TO SEARCH";

function drawSky(sky: Graphics): void {
  const theme: Theme = getTheme();

  sky.clear();

  for (let band = 0; band < skyBands; band++) {
    sky
      .rect(
        0,
        (band * seaTop) / skyBands,
        doorWidth,
        Math.ceil(seaTop / skyBands) + 1,
      )
      .fill(
        band < skyBands / 2
          ? mix(theme.skyTop, theme.skyMiddle, band / (skyBands / 2))
          : mix(
              theme.skyMiddle,
              theme.horizon,
              (band - skyBands / 2) / (skyBands / 2),
            ),
      );
  }

  for (let band = 0; band < seaBands; band++) {
    sky
      .rect(
        0,
        seaTop + (band * (doorHeight - seaTop)) / seaBands,
        doorWidth,
        Math.ceil((doorHeight - seaTop) / seaBands) + 1,
      )
      .fill(mix(theme.seaSurface, theme.seaDeep, band / (seaBands - 1)));
  }

  sky
    .rect(0, 0, doorWidth, doorHeight)
    .fill({ color: 0x000000, alpha: shadeAlpha })
    .rect(0, seaTop, doorWidth, 1)
    .fill(theme.light);
}

function createSelector(ticker: Ticker): Selector {
  const view: Container = new Container();
  const door: Container = new Container();
  const sky: Graphics = new Graphics();
  const rails: Graphics = new Graphics();
  const mask: Graphics = new Graphics();
  const badge: Graphics = new Graphics();
  const heading: Text = createText(titleSize, "#ffffff");
  const list: Container = new Container();
  const listMask: Graphics = new Graphics();
  const arrows: Graphics = new Graphics();
  const scroll: Spring = { value: 0, velocity: 0 };
  const entries: Array<Entry> = new Array();
  let texts: Array<Text> = [heading];
  const listeners: Array<(index: number) => void> = new Array();
  const selectListeners: Array<(index: number) => void> = new Array();
  let selected: number = 0;
  let current: Menu | null = null;
  let shown: Array<number> = new Array();
  let query: string = "";
  let typing: boolean = false;
  let caret: number = 0;
  const search: Container = new Container();
  const searchBox: Graphics = new Graphics();
  const searchText: Text = createText(searchSize, "#ffffff");
  const searchCount: Text = createText(searchSize, subtitleColor);
  const searchFocus: Glide = createGlide(0, drawSearch);
  let active: boolean = false;
  let roll: number = 0;
  let textScale: number = 1;

  function place(): void {
    view.alpha = Math.min(roll * fadeSpeed, 1);
    view.visible = roll > 0;

    for (let index = 0; index < entries.length; index++) {
      const entry: Container = entries[index]!.view;
      const offset: number = index - scroll.value;
      const distance: number = Math.abs(offset);
      const amount: number = Math.min(
        Math.max(
          roll * (1 + wheelReach * cardStagger) - distance * cardStagger,
          0,
        ),
        1,
      );

      entry.visible = distance < wheelReach;
      entry.zIndex = -distance;
      entry.scale.set(1 - wheelShrink * Math.min(distance, wheelReach));
      entry.alpha = Math.max(1 - wheelFade * distance, 0) * amount;
      entry.position.set(
        doorWidth / 2 +
          wheelCurve * offset * offset +
          slideDistance * (1 - amount) * (1 - amount),
        wheelY +
          Math.sign(offset) *
            wheelSpacing *
            (distance - (wheelShrink * distance * distance) / 2),
      );
    }
  }

  function paint(): void {
    for (let index = 0; index < entries.length; index++) {
      entries[index]!.lit.set(index === selected ? 1 : 0);
    }
  }

  function select(index: number): void {
    if (entries.length === 0) {
      return;
    }

    const before: number = selected;

    selected = (index + entries.length) % entries.length;
    paint();

    if (selected !== before) {
      announce();
    }
  }

  function drawArrows(): void {
    const center: number = doorWidth / 2;
    const top: number = wheelTop + arrowGap;
    const bottom: number = wheelBottom - arrowGap;

    arrows.clear();

    if (selected > 0) {
      arrows
        .poly([
          center - arrowSize,
          top,
          center + arrowSize,
          top,
          center,
          top - arrowSize,
        ])
        .fill({ color: 0xffffff, alpha: 0.7 });
    }

    if (selected < entries.length - 1) {
      arrows
        .poly([
          center - arrowSize,
          bottom,
          center + arrowSize,
          bottom,
          center,
          bottom + arrowSize,
        ])
        .fill({ color: 0xffffff, alpha: 0.7 });
    }
  }

  function announce(): void {
    for (const listener of selectListeners) {
      listener(shown[selected] ?? -1);
    }
  }

  function reload(index: number): void {
    rebuild();
    selected = Math.max(shown.indexOf(index), 0);
    paint();
    announce();
  }

  function choose(): void {
    if (!active) {
      return;
    }

    const original: number | undefined = shown[selected];

    if (original === undefined) {
      return;
    }

    setTyping(false);

    if (current?.remember === true) {
      current.selected = original;
    }

    for (let index = 0; index < listeners.length; index++) {
      listeners[index]!(original);
    }
  }

  drawSky(sky);
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
  listMask.rect(0, wheelTop, doorWidth, wheelBottom - wheelTop).fill(0xffffff);
  list.sortableChildren = true;
  list.mask = listMask;
  searchText.anchor.set(0, 0.5);
  searchCount.anchor.set(1, 0.5);
  search.addChild(searchBox, searchText, searchCount);
  search.visible = false;
  search.eventMode = "static";
  search.cursor = "text";
  search.hitArea = new Rectangle(
    entryInset,
    searchY - searchHeight / 2,
    doorWidth - entryInset * 2,
    searchHeight,
  );
  search.on("pointertap", () => {
    if (active) {
      setTyping(true);
    }
  });
  door.addChild(sky, badge, heading, search, list, listMask, arrows);

  function matches(choice: Choice): boolean {
    const needle: string = query.trim().toLowerCase();

    return (
      needle === "" ||
      choice.name.toLowerCase().includes(needle) ||
      choice.title.toLowerCase().includes(needle)
    );
  }

  function rebuild(): void {
    const choices: Array<Choice> = current?.choices ?? new Array();

    for (const entry of entries) {
      entry.view.destroy({ children: true });
    }

    entries.length = 0;
    texts = [heading, searchText, searchCount];
    shown = choices
      .map((choice: Choice, index: number) => (matches(choice) ? index : -1))
      .filter((index: number) => index >= 0);

    for (let position = 0; position < shown.length; position++) {
      addEntry(choices[shown[position]!]!, position);
    }

    if (shown.length === 0) {
      addEntry({ name: "No matches", title: "Try another search" }, 0);
    }

    setScale(textScale);
    drawSearch();
    place();
  }

  function setQuery(value: string): void {
    query = value.slice(0, queryLength);
    caret = 0;
    rebuild();
    selected = 0;
    scroll.value = 0;
    paint();
    announce();
  }

  function setTyping(value: boolean): void {
    if (current?.searchable !== true) {
      value = false;
    }

    typing = value;
    caret = 0;
    searchFocus.set(value ? 1 : 0);
    drawSearch();
  }

  function drawSearch(): void {
    const focus: number = searchFocus.value();
    const left: number = entryInset;
    const right: number = doorWidth - entryInset;
    const top: number = searchY - searchHeight / 2;
    const iconX: number = left + searchPadding + searchIcon;
    const total: number = current?.choices.length ?? 0;
    const blink: boolean = typing && caret % caretBlink < caretBlink / 2;

    search.visible = current?.searchable === true;
    searchBox
      .clear()
      .poly([
        left + entrySlant / 2,
        top,
        right,
        top,
        right - entrySlant / 2,
        top + searchHeight,
        left,
        top + searchHeight,
      ])
      .fill({ color: railColor, alpha: 0.55 + focus * 0.3 })
      .stroke({
        color: mix(frameColor, getTheme().accent, focus),
        width: 1 + focus,
      })
      .circle(iconX, searchY - 1, searchIcon - 1)
      .stroke({ color: 0xffffff, width: 1.25, alpha: 0.6 + focus * 0.4 })
      .moveTo(iconX + searchIcon * 0.6, searchY + searchIcon * 0.5)
      .lineTo(iconX + searchIcon * 1.3, searchY + searchIcon * 1.2)
      .stroke({ color: 0xffffff, width: 1.25, alpha: 0.6 + focus * 0.4 });
    searchText.text =
      query === "" && !typing
        ? searchPlaceholder
        : query.toUpperCase() + (blink ? "|" : "");
    searchText.alpha = query === "" && !typing ? 0.5 : 1;
    searchText.position.set(iconX + searchIcon + 6, searchY);
    searchCount.text = query === "" ? "" : shown.length + "/" + total;
    searchCount.position.set(right - searchPadding, searchY);
  }

  function setMenu(menu: Menu): void {
    heading.text = menu.heading;
    current = menu;
    query = "";
    typing = false;
    searchFocus.snap(0);
    rebuild();
    selected =
      menu.remember === true
        ? Math.max(shown.indexOf(menu.selected ?? 0), 0)
        : 0;
    scroll.value = selected;
    scroll.velocity = 0;
    paint();
    announce();
  }

  function addEntry(choice: Choice, index: number): void {
    const entry: Container = new Container();
    const card: Graphics = new Graphics();
    const name: Text = createText(nameSize, "#ffffff");
    const title: Text = createText(subtitleSize, "#ffffff");
    const top: number = -cardHeight / 2;
    const left: number = -cardWidth / 2 + cardSlant + cardPadding;
    const nameX: number = left + (choice.starred === true ? starSpace : 0);
    const star: Graphics = new Graphics();

    if (choice.starred === true) {
      const points: Array<number> = new Array();

      for (let point = 0; point < starPoints * 2; point++) {
        const angle: number = (point / (starPoints * 2)) * Math.PI * 2;
        const reach: number = starRadius * (point % 2 === 0 ? 1 : starInner);

        points.push(Math.sin(angle) * reach, -Math.cos(angle) * reach);
      }

      star.poly(points).fill(getTheme().highlight);
      star.position.set(left + starRadius, top + 2 + nameSize / 2 + 1);
    }

    name.text = choice.name.toUpperCase();
    name.position.set(nameX, top + 2);
    title.text = choice.title;
    title.style.fill = subtitleColor;
    title.position.set(left, top + 2 + nameSize);
    entry.addChild(card, star, name, title);
    entry.eventMode = "static";
    entry.cursor = "pointer";
    entry.hitArea = new Rectangle(
      -cardWidth / 2,
      -cardHeight / 2,
      cardWidth,
      cardHeight,
    );
    entry.on("pointertap", () => {
      if (!active) {
        return;
      }

      if (index === selected) {
        choose();
      } else {
        select(index);
      }
    });
    drawCard(card, 0, getTheme());
    list.addChild(entry);
    entries.push({
      view: entry,
      name: name,
      title: title,
      lit: createGlide(0, (amount: number) => {
        if (entry.destroyed) {
          return;
        }

        drawCard(card, amount, getTheme());
        name.x = nameX + amount * selectShift;
        title.x = left + amount * selectShift;
        star.x = left + starRadius + amount * selectShift;
      }),
    });
    texts.push(name, title);
  }

  function drawCard(card: Graphics, amount: number, theme: Theme): void {
    const top: number = -cardHeight / 2;
    const left: number = -cardWidth / 2;

    card
      .clear()
      .poly([
        left + cardSlant,
        top,
        -left,
        top,
        -left - cardSlant,
        -top,
        left,
        -top,
      ])
      .fill({ color: mix(cardColor, theme.accent, amount), alpha: cardAlpha })
      .stroke({ color: theme.highlight, width: 2, alpha: amount })
      .poly([
        left + cardSlant,
        top,
        left + cardSlant + stripeWidth,
        top,
        left + stripeWidth,
        -top,
        left,
        -top,
      ])
      .fill(amount > 0.5 ? theme.highlight : theme.accent);
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

    smoothDamp(scroll, selected, highlightSmoothing, current.deltaMS / 1000);
    place();
    drawArrows();

    if (typing) {
      const before: boolean = caret % caretBlink < caretBlink / 2;

      caret += current.deltaMS / 1000;

      if (before !== caret % caretBlink < caretBlink / 2) {
        drawSearch();
      }
    }
  });

  window.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      if (!active || current?.searchable !== true || event.altKey) {
        return;
      }

      const command: boolean = event.ctrlKey || event.metaKey;

      if (!typing) {
        if (
          (event.key === "/" && !command) ||
          (command && event.code === "KeyF")
        ) {
          setTyping(true);
        } else if (event.code === "Escape" && query !== "") {
          setQuery("");
        } else {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (event.code === "Escape") {
        if (query === "") {
          setTyping(false);
        } else {
          setQuery("");
        }
      } else if (event.code === "Enter" || event.code === "NumpadEnter") {
        choose();
      } else if (event.code === "Tab") {
        setTyping(false);
      } else if (event.code === "ArrowUp") {
        select(selected - 1);
      } else if (event.code === "ArrowDown") {
        select(selected + 1);
      } else if (event.code === "Backspace") {
        setQuery(command ? "" : query.slice(0, -1));
      } else if (event.key.length === 1 && !command) {
        setQuery(query + event.key);
      } else if (command && event.code === "KeyV") {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  window.addEventListener("paste", (event: ClipboardEvent) => {
    if (!active || !typing) {
      return;
    }

    setQuery(query + (event.clipboardData?.getData("text") ?? "").trim());
    event.preventDefault();
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (upKeys.includes(event.code)) {
      select(selected - 1);
    } else if (downKeys.includes(event.code)) {
      select(selected + 1);
    } else if (
      chooseKeys.includes(event.code) ||
      shotKeys.includes(event.code)
    ) {
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

    if (!value && typing) {
      setTyping(false);
    }

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
      scroll.value = selected;
      scroll.velocity = 0;
      return rollTo(1, downDuration);
    },
    rollUp: () => rollTo(0, upDuration),
    rollUpDuration: () => upDuration * roll,
    close: () => {
      roll = 0;
      place();
    },
    setActive: setActive,
    chosenIndex: () => shown[selected] ?? -1,
    reload: reload,
    setScale: setScale,
    onChoose: (listener: (index: number) => void) => {
      listeners.push(listener);
    },
    onSelect: (listener: (index: number) => void) => {
      selectListeners.push(listener);
    },
  };
}

export { createSelector };
export type { Choice, Menu, Selector };
