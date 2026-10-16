import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type Application,
  type Bounds,
  type Point,
  type Ticker,
} from "pixi.js";
import { createGlide, mix, type Glide } from "../../ui/motion";
import type { Rarity } from "../rarity";
import {
  categoryList,
  categoryTypes,
  orderList,
  orderNames,
  type Category,
  type Order,
  type Search,
} from "./kinds";
import {
  cardInner,
  createSerif,
  detailColor,
  diamond,
  trim,
  trimLit,
} from "./style";

type SearchBar = {
  view: Container;
  height: number; // px
  search: () => Search;
  filtering: () => boolean;
  focused: () => boolean;
  layout: (width: number) => void;
  setCategory: (category: Category) => void;
  setActive: (active: boolean) => void;
  reset: () => void;
};

type Option = {
  view: Container;
  label: Text;
  mark: Graphics;
  lit: boolean;
  hovered: boolean;
  glow: Glide;
};

const optionSize: number = 12; // px
const optionGap: number = 24; // px
const groupGap: number = 44; // px
const rowGap: number = 34; // px
const markY: number = 13; // px
const markSize: number = 3; // px
const optionHover: number = 1.06;
const idleAlpha: number = 0.55;
const fieldWidth: number = 260; // px
const fieldHeight: number = 26; // px
const fieldPadding: number = 10; // px
const fieldSize: number = 13; // px
const fieldEnd: number = 4; // px
const iconRadius: number = 5; // px
const queryLength: number = 24;
const caretBlink: number = 1; // s
const rowFade: number = 0.2; // s
const placeholder: string = "SEARCH BY NAME";

function createOption(text: string, color: string, tap: () => void): Option {
  const view: Container = new Container();
  const label: Text = createSerif(optionSize, "#ffffff");
  const mark: Graphics = new Graphics();
  const hover: Glide = createGlide(1, (scale: number) => view.scale.set(scale));
  const option: Option = {
    view: view,
    label: label,
    mark: mark,
    lit: false,
    hovered: false,
    glow: createGlide(0, (amount: number) => {
      label.tint = mix(trim, color, amount);
      label.alpha = idleAlpha + (1 - idleAlpha) * amount;
      mark.alpha = amount;
    }),
  };

  label.text = text.toUpperCase();
  label.anchor.set(0.5);
  diamond(mark, 0, markY, markSize);
  mark.fill(color);
  mark.alpha = 0;
  label.tint = trim;
  label.alpha = idleAlpha;
  view.addChild(label, mark);
  view.eventMode = "static";
  view.cursor = "pointer";
  view.hitArea = new Rectangle(
    -label.width / 2 - optionGap / 2,
    -optionSize,
    label.width + optionGap,
    optionSize * 2 + markSize,
  );
  view.on("pointerover", () => {
    option.hovered = true;
    hover.set(optionHover);
    paintOption(option);
  });
  view.on("pointerout", () => {
    option.hovered = false;
    hover.set(1);
    paintOption(option);
  });
  view.on("pointertap", tap);

  return option;
}

function paintOption(option: Option): void {
  option.glow.set(option.lit ? 1 : option.hovered ? 0.5 : 0);
}

function placeRow(items: Array<Container>, widths: Array<number>): number {
  let x: number = 0;

  for (let index = 0; index < items.length; index++) {
    items[index]!.x = x + widths[index]! / 2;
    x += widths[index]! + optionGap;
  }

  for (const item of items) {
    item.x -= (x - optionGap) / 2;
  }

  return x - optionGap;
}

function createSearchBar(app: Application, changed: () => void): SearchBar {
  const view: Container = new Container();
  const top: Container = new Container();
  const bottom: Container = new Container();
  const field: Container = new Container();
  const box: Graphics = new Graphics();
  const icon: Graphics = new Graphics();
  const input: Text = createSerif(fieldSize, "#ffffff");
  const sortLabel: Text = createSerif(optionSize, detailColor);
  const showLabel: Text = createSerif(optionSize, detailColor);
  const filters: Map<Category, Set<string>> = new Map();
  const focus: Glide = createGlide(0, drawField);
  const bottomFade: Glide = createGlide(
    1,
    (value: number) => {
      bottom.alpha = value;
    },
    rowFade,
  );
  const orders: Array<Option> = orderList.map((order: Order) =>
    createOption(orderNames.get(order)!, trimLit, () => setOrder(order)),
  );
  const reverse: Option = createOption("reverse", trimLit, () => {
    reversed = !reversed;
    paint();
    changed();
  });
  let all: Option | null = null;
  let types: Array<[Option, string]> = new Array();
  let category: Category = categoryList[0]!;
  let query: string = "";
  let order: Order = "rarity";
  let reversed: boolean = false;
  let typing: boolean = false;
  let active: boolean = false;
  let caretTime: number = 0;
  let width: number = 0;

  for (const value of categoryList) {
    filters.set(value, new Set());
  }

  function selection(): Set<string> {
    return filters.get(category)!;
  }

  function drawField(amount: number): void {
    const border: number = mix(trim, trimLit, amount);

    box
      .clear()
      .rect(0, 0, fieldWidth, fieldHeight)
      .fill({ color: cardInner, alpha: 0.45 + amount * 0.35 })
      .rect(0, 0, fieldWidth, fieldHeight)
      .stroke({ color: border, width: 1, alignment: 1 });
    diamond(box, 0, fieldHeight / 2, fieldEnd);
    diamond(box, fieldWidth, fieldHeight / 2, fieldEnd);
    box.fill(border);
    icon.tint = border;
  }

  function drawInput(): void {
    const room: number = fieldWidth - fieldPadding * 3 - iconRadius * 2;

    if (query === "" && !typing) {
      input.text = placeholder;
      input.alpha = idleAlpha;
    } else {
      input.text =
        query + (typing && caretTime % caretBlink < caretBlink / 2 ? "|" : "");
      input.alpha = 1;
    }

    input.scale.set(1);
    input.scale.set(Math.min(room / Math.max(input.width, 1), 1));
  }

  function setTyping(value: boolean): void {
    typing = value && active;
    caretTime = 0;
    focus.set(typing ? 1 : 0);
    drawInput();
  }

  function setQuery(value: string): void {
    if (value === query) {
      return;
    }

    query = value.slice(0, queryLength);
    caretTime = 0;
    drawInput();
    changed();
  }

  function setOrder(value: Order): void {
    if (value === order) {
      return;
    }

    order = value;
    paint();
    changed();
  }

  function toggleType(label: string | null): void {
    const chosen: Set<string> = selection();

    if (label === null) {
      chosen.clear();
    } else if (chosen.has(label)) {
      chosen.delete(label);
    } else {
      chosen.add(label);
    }

    if (chosen.size === types.length) {
      chosen.clear();
    }

    paint();
    changed();
  }

  function paint(): void {
    const chosen: Set<string> = selection();

    for (let index = 0; index < orders.length; index++) {
      orders[index]!.lit = orderList[index] === order;
      paintOption(orders[index]!);
    }

    reverse.lit = reversed;
    paintOption(reverse);

    if (all !== null) {
      all.lit = chosen.size === 0;
      paintOption(all);
    }

    for (const [option, label] of types) {
      option.lit = chosen.has(label);
      paintOption(option);
    }
  }

  function buildTypes(): void {
    for (const child of bottom.removeChildren()) {
      if (child !== showLabel) {
        child.destroy({ children: true });
      }
    }

    all = createOption("all", trimLit, () => toggleType(null));
    types = categoryTypes(category).map((rarity: Rarity<unknown>) => [
      createOption(rarity.label, rarity.color, () => toggleType(rarity.label)),
      rarity.label,
    ]);
    bottom.addChild(showLabel, all.view);

    for (const [option] of types) {
      bottom.addChild(option.view);
    }

    placeRow(
      [showLabel, all.view, ...types.map(([option]) => option.view)],
      [
        showLabel.width,
        all.label.width,
        ...types.map(([option]) => option.label.width),
      ],
    );
    paint();
  }

  function layout(available: number): void {
    width = available;

    if (width <= 0) {
      return;
    }

    for (const row of [top, bottom]) {
      row.scale.set(1);
      row.scale.set(Math.min(width / Math.max(row.width, 1), 1));
    }
  }

  function setCategory(value: Category): void {
    if (value === category && all !== null) {
      return;
    }

    category = value;
    buildTypes();
    layout(width);
    bottomFade.snap(0);
    bottomFade.set(1);
  }

  function setActive(value: boolean): void {
    active = value;

    if (!value) {
      setTyping(false);
    }
  }

  function reset(): void {
    query = "";

    for (const chosen of filters.values()) {
      chosen.clear();
    }

    setTyping(false);
    paint();
  }

  icon
    .circle(fieldPadding + iconRadius, fieldHeight / 2 - 1, iconRadius)
    .stroke({ color: 0xffffff, width: 1.5 })
    .moveTo(
      fieldPadding + iconRadius * 1.7,
      fieldHeight / 2 - 1 + iconRadius * 0.7,
    )
    .lineTo(
      fieldPadding + iconRadius * 2.6,
      fieldHeight / 2 - 1 + iconRadius * 1.6,
    )
    .stroke({ color: 0xffffff, width: 1.5 });
  input.anchor.set(0, 0.5);
  input.position.set(fieldPadding * 2 + iconRadius * 2, fieldHeight / 2);
  field.addChild(box, icon, input);
  field.eventMode = "static";
  field.cursor = "text";
  field.hitArea = new Rectangle(0, 0, fieldWidth, fieldHeight);
  field.pivot.set(fieldWidth / 2, fieldHeight / 2);
  field.on("pointertap", () => setTyping(true));
  sortLabel.text = "SORT";
  sortLabel.anchor.set(0.5);
  showLabel.text = "SHOW";
  showLabel.anchor.set(0.5);
  top.addChild(field, sortLabel, reverse.view);

  for (const option of orders) {
    top.addChild(option.view);
  }

  const topItems: Array<Container> = [
    field,
    sortLabel,
    ...orders.map((option: Option) => option.view),
    reverse.view,
  ];
  const topWidths: Array<number> = [
    fieldWidth + groupGap - optionGap,
    sortLabel.width,
    ...orders.map((option: Option) => option.label.width),
    reverse.label.width + groupGap - optionGap,
  ];

  placeRow(topItems, topWidths);
  field.x -= (groupGap - optionGap) / 2;
  reverse.view.x += (groupGap - optionGap) / 2;
  bottom.y = rowGap;
  view.addChild(top, bottom);
  drawField(0);
  drawInput();
  buildTypes();

  app.ticker.add((ticker: Ticker) => {
    if (!typing) {
      return;
    }

    caretTime += ticker.deltaMS / 1000;
    drawInput();
  });

  window.addEventListener("pointerdown", (event: PointerEvent) => {
    if (typing && event.target === app.canvas) {
      const bounds: Bounds = field.getBounds();
      const point: Point = app.renderer.events.pointer.global;

      if (!bounds.containsPoint(point.x, point.y)) {
        setTyping(false);
      }
    }
  });

  window.addEventListener("paste", (event: ClipboardEvent) => {
    if (!typing) {
      return;
    }

    setQuery(query + (event.clipboardData?.getData("text") ?? "").trim());
    event.preventDefault();
  });

  window.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      if (!active) {
        return;
      }

      const command: boolean = event.ctrlKey || event.metaKey;

      if (!typing) {
        if (
          (event.key === "/" && !command && !event.altKey) ||
          (command && event.code === "KeyF")
        ) {
          setTyping(true);
          event.preventDefault();
          event.stopImmediatePropagation();
        }

        return;
      }

      if (event.altKey || (command && event.key !== "Backspace")) {
        return;
      }

      if (event.key === "Escape") {
        setQuery("");
        setTyping(false);
      } else if (
        event.key === "Enter" ||
        event.key === "Tab" ||
        event.key === "ArrowDown"
      ) {
        setTyping(false);
      } else if (event.key === "Backspace") {
        setQuery(command ? "" : query.slice(0, -1));
      } else if (event.key.length === 1 && query.length < queryLength) {
        setQuery(query + event.key);
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  return {
    view: view,
    height: rowGap + optionSize,
    search: () => ({
      query: query,
      order: order,
      reversed: reversed,
      types: selection(),
    }),
    filtering: () => query.trim() !== "" || selection().size > 0,
    focused: () => typing,
    layout: layout,
    setCategory: setCategory,
    setActive: setActive,
    reset: reset,
  };
}

export { createSearchBar };
export type { SearchBar };
