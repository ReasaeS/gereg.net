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
  type Category,
  type Order,
  type Search,
} from "./kinds";
import { cardInner, createSerif, diamond, trim, trimLit } from "./style";

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
const rowGap: number = 34; // px
const markY: number = 13; // px
const markSize: number = 3; // px
const optionHover: number = 1.06;
const idleAlpha: number = 0.55;
const fieldWidth: number = 360; // px
const fieldHeight: number = 26; // px
const fieldPadding: number = 10; // px
const fieldSize: number = 13; // px
const fieldEnd: number = 4; // px
const iconRadius: number = 5; // px
const queryLength: number = 64;
const caretBlink: number = 1; // s
const rowFade: number = 0.2; // s
const placeholder: string = "SEARCH BY NAME · SORT: · SHOW:";
const sortCommand: string = "sort:";
const showCommand: string = "show:";
const reverseWord: string = "reverse";

function createOption(text: string, color: string, tap: () => void): Option {
  const view: Container = new Container();
  const label: Text = createSerif(optionSize, "#ffffff");
  const mark: Graphics = new Graphics();
  const hover: Glide = createGlide(1, (scale: number) => {
    if (!view.destroyed) {
      view.scale.set(scale);
    }
  });
  const option: Option = {
    view: view,
    label: label,
    mark: mark,
    lit: false,
    hovered: false,
    glow: createGlide(0, (amount: number) => {
      if (view.destroyed) {
        return;
      }

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
  const hints: Container = new Container();
  const field: Container = new Container();
  const box: Graphics = new Graphics();
  const icon: Graphics = new Graphics();
  const input: Text = createSerif(fieldSize, "#ffffff");
  const focus: Glide = createGlide(0, drawField);
  const hintFade: Glide = createGlide(
    0,
    (value: number) => {
      hints.alpha = value;
      hints.visible = value > 0;
    },
    rowFade,
  );
  let suggestions: Array<string> = new Array();
  let category: Category = categoryList[0]!;
  let query: string = "";
  let typing: boolean = false;
  let active: boolean = false;
  let caretTime: number = 0;
  let width: number = 0;

  function tokens(): Array<string> {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((token: string) => token !== "");
  }

  function typeLabels(): Array<Rarity<unknown>> {
    return categoryTypes(category);
  }

  function parse(): Search {
    const words: Array<string> = new Array();
    const types: Set<string> = new Set();
    let order: Order = "rarity";
    let reversed: boolean = false;

    for (const token of tokens()) {
      if (token.startsWith(sortCommand)) {
        const value: string = token.slice(sortCommand.length);

        if (value === reverseWord) {
          reversed = true;
        } else if (orderList.includes(value as Order)) {
          order = value as Order;
        }
      } else if (token.startsWith(showCommand)) {
        for (const value of token.slice(showCommand.length).split(",")) {
          const found: Rarity<unknown> | undefined = typeLabels().find(
            (rarity: Rarity<unknown>) => rarity.label.toLowerCase() === value,
          );

          if (found !== undefined) {
            types.add(found.label);
          }
        }
      } else {
        words.push(token);
      }
    }

    if (types.size === typeLabels().length) {
      types.clear();
    }

    return {
      query: words.join(" "),
      order: order,
      reversed: reversed,
      types: types,
    };
  }

  function choices(): Array<[string, string]> {
    const last: string = query.endsWith(" ")
      ? ""
      : (query.toLowerCase().split(/\s+/).pop() ?? "");
    const all: Array<[string, string]> = last.startsWith(sortCommand)
      ? [...orderList, reverseWord].map((value: string) => [
          sortCommand + value,
          trimLit,
        ])
      : last.startsWith(showCommand)
        ? typeLabels().map((rarity: Rarity<unknown>) => [
            showCommand + rarity.label.toLowerCase(),
            rarity.color,
          ])
        : [
            [sortCommand, trimLit],
            [showCommand, trimLit],
          ];

    return all.filter(
      ([token]: [string, string]) => token.startsWith(last) && token !== last,
    );
  }

  function buildHints(): void {
    for (const child of hints.removeChildren()) {
      child.destroy({ children: true });
    }

    const found: Array<[string, string]> = choices();
    const present: Array<string> = tokens();
    const options: Array<Option> = found.map(
      ([token, color]: [string, string]) =>
        createOption(token, color, () => complete(token)),
    );

    suggestions = found.map(([token]: [string, string]) => token);

    for (let index = 0; index < options.length; index++) {
      options[index]!.lit = present.includes(found[index]![0]);
      paintOption(options[index]!);
      hints.addChild(options[index]!.view);
    }

    placeRow(
      options.map((option: Option) => option.view),
      options.map((option: Option) => option.label.width),
    );
    hints.scale.set(1);
    hints.scale.set(Math.min(width / Math.max(hints.width, 1), 1));
  }

  function complete(token: string): void {
    const words: Array<string> = query.split(" ");

    words[words.length - 1] = token;
    setQuery(words.join(" ") + (token.endsWith(":") ? "" : " "));
    setTyping(true);
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
    hintFade.set(typing ? 1 : 0);
    hints.eventMode = typing ? "static" : "none";
    buildHints();
    drawInput();
  }

  function setQuery(value: string): void {
    if (value === query) {
      return;
    }

    query = value.slice(0, queryLength);
    caretTime = 0;
    buildHints();
    drawInput();
    changed();
  }

  function layout(available: number): void {
    width = available;

    if (width <= 0) {
      return;
    }

    top.scale.set(1);
    top.scale.set(Math.min(width / Math.max(top.width, 1), 1));
    buildHints();
  }

  function setCategory(value: Category): void {
    category = value;
    buildHints();
  }

  function setActive(value: boolean): void {
    active = value;

    if (!value) {
      setTyping(false);
    }
  }

  function reset(): void {
    query = "";
    setTyping(false);
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
  top.addChild(field);
  hints.y = rowGap;
  hints.visible = false;
  view.addChild(top, hints);
  drawField(0);
  drawInput();

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

      const hinted: Bounds = hints.getBounds();

      if (
        !bounds.containsPoint(point.x, point.y) &&
        !hinted.containsPoint(point.x, point.y)
      ) {
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
      } else if (event.key === "Tab" && suggestions.length > 0) {
        complete(suggestions[0]!);
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
    search: parse,
    filtering: () => {
      const search: Search = parse();

      return search.query !== "" || search.types.size > 0;
    },
    focused: () => typing,
    layout: layout,
    setCategory: setCategory,
    setActive: setActive,
    reset: reset,
  };
}

export { createSearchBar };
export type { SearchBar };
