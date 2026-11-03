import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type Application,
} from "pixi.js";
import { getTheme } from "../theme/theme";
import { createGlide, type Glide } from "../ui/motion";
import {
  createShadowText,
  createText,
  screenResolution,
  sharpen,
} from "../ui/text";
import type { Option } from "../ui/widgets";

type Palette = {
  view: Container;
  shown: () => boolean;
};

const paletteKey: string = "KeyP";
const titleSize: number = 34; // px
const querySize: number = 22; // px
const rowSize: number = 20; // px
const rowHeight: number = 38; // px
const panelWidth: number = 460; // px
const panelPadding: number = 36; // px
const titleGap: number = 56; // px
const queryGap: number = 48; // px
const highlightInset: number = 8; // px
const shadeAlpha: number = 0.55;
const panelAlpha: number = 0.94;
const paletteReference: number = 1000; // px
const riseDistance: number = 30; // px
const paletteSmoothing: number = 0.1; // s
const highlightSmoothing: number = 0.06; // s
const highlightAlpha: number = 0.22;
const queryPrompt: string = "TYPE TO FILTER";
const emptyText: string = "NOTHING MATCHES";
const dimAlpha: number = 0.45;

function matches(label: string, query: string): boolean {
  const text: string = label.toLowerCase();
  let at: number = 0;

  for (const letter of query.toLowerCase()) {
    at = text.indexOf(letter, at);

    if (at === -1) {
      return false;
    }

    at++;
  }

  return true;
}

function upright(text: Text): Text {
  text.style.fontStyle = "normal";

  return text;
}

function createPalette(
  app: Application,
  destinations: Array<Option<string>>,
  go: (value: string) => void,
): Palette {
  const view: Container = new Container();
  const shade: Graphics = new Graphics();
  const panel: Container = new Container();
  const back: Graphics = new Graphics();
  const highlight: Graphics = new Graphics();
  const rows: Container = new Container();
  const title: Text = upright(
    createShadowText("GO TO", titleSize, "#ffffff", "#020b30", 5),
  );
  const queryText: Text = upright(createText(querySize, "#ffffff"));
  const empty: Text = upright(createText(rowSize, "#ffffff"));
  const labels: Array<Text> = new Array();
  const shown: Glide = createGlide(0, place, paletteSmoothing);
  const slide: Glide = createGlide(0, moveHighlight, highlightSmoothing);
  let open: boolean = false;
  let query: string = "";
  let visible: Array<Option<string>> = new Array();
  let selected: number = 0;
  let textScale: number = 0;
  let top: number = 0;

  function place(value: number): void {
    view.alpha = value;
    view.visible = value > 0;
    panel.y = app.screen.height / 2 + riseDistance * (1 - value);
  }

  function rowTop(index: number): number {
    return top + panelPadding + titleGap + queryGap + index * rowHeight;
  }

  function moveHighlight(value: number): void {
    highlight.y = rowTop(value);
  }

  function select(index: number): void {
    selected = Math.min(Math.max(index, 0), visible.length - 1);
    slide.set(Math.max(selected, 0));

    for (let index = 0; index < labels.length; index++) {
      labels[index]!.alpha = index === selected ? 1 : dimAlpha;
    }
  }

  function choose(index: number): void {
    const target: Option<string> | undefined = visible[index];

    if (target === undefined) {
      return;
    }

    close();
    go(target.value);
  }

  function build(): void {
    const height: number =
      panelPadding * 2 + titleGap + queryGap + destinations.length * rowHeight;
    const left: number = -panelWidth / 2;

    top = -height / 2;
    visible = destinations.filter((entry: Option<string>) =>
      matches(entry.label, query),
    );

    for (const child of rows.removeChildren()) {
      child.destroy();
    }

    labels.length = 0;

    for (let index = 0; index < visible.length; index++) {
      const row: Container = new Container();
      const label: Text = upright(createText(rowSize, "#ffffff"));

      label.text = visible[index]!.label.toUpperCase();
      label.anchor.set(0, 0.5);
      label.position.set(left + panelPadding, rowHeight / 2);
      row.y = rowTop(index);
      row.hitArea = new Rectangle(left, 0, panelWidth, rowHeight);
      row.eventMode = "static";
      row.cursor = "pointer";
      row.on("pointerover", () => select(index));
      row.on("pointertap", () => choose(index));
      row.addChild(label);
      rows.addChild(row);
      labels.push(label);
    }

    queryText.text = query === "" ? queryPrompt : query.toUpperCase();
    queryText.alpha = query === "" ? dimAlpha : 1;
    queryText.position.set(left + panelPadding, top + panelPadding + titleGap);
    empty.visible = visible.length === 0;
    empty.position.set(left + panelPadding, rowTop(0) + rowHeight / 2);
    title.position.set(0, top + panelPadding + titleSize / 2);
    highlight.visible = visible.length > 0;
    highlight
      .clear()
      .rect(
        left + highlightInset,
        0,
        panelWidth - highlightInset * 2,
        rowHeight,
      )
      .fill({ color: getTheme().highlight, alpha: highlightAlpha });
    back
      .clear()
      .rect(left, top, panelWidth, -top * 2)
      .fill({ color: "#01040f", alpha: panelAlpha })
      .stroke({ color: getTheme().highlight, width: 2 });
    textScale = 0;
    select(selected);
    layout();
  }

  function layout(): void {
    const scale: number = Math.min(app.screen.height / paletteReference, 1.4);

    shade
      .clear()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: "#000000", alpha: shadeAlpha });
    panel.scale.set(scale);
    panel.x = app.screen.width / 2;
    place(shown.value());

    if (scale !== textScale) {
      textScale = scale;
      sharpen(panel, screenResolution(scale));
    }
  }

  function show(): void {
    open = true;
    query = "";
    selected = 0;
    build();
    slide.snap(0);
    shown.set(1);
  }

  function close(): void {
    open = false;
    shown.set(0);
  }

  function type(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      close();
    } else if (event.key === "Enter") {
      choose(selected);
    } else if (event.key === "ArrowDown") {
      select(selected + 1);
    } else if (event.key === "ArrowUp") {
      select(selected - 1);
    } else if (event.key === "Backspace") {
      query = query.slice(0, -1);
      selected = 0;
      build();
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      query += event.key;
      selected = 0;
      build();
    }
  }

  title.anchor.set(0.5);
  queryText.anchor.set(0, 0.5);
  empty.anchor.set(0, 0.5);
  empty.text = emptyText;
  empty.alpha = dimAlpha;
  panel.addChild(back, highlight, title, queryText, empty, rows);
  view.addChild(shade, panel);
  view.visible = false;
  view.alpha = 0;
  view.eventMode = "static";
  shade.eventMode = "static";
  shade.on("pointertap", close);
  app.renderer.on("resize", layout);

  window.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      const toggled: boolean =
        event.altKey && event.code === paletteKey && !event.repeat;

      if (toggled) {
        if (open) {
          close();
        } else {
          show();
        }
      } else if (open) {
        type(event);
      } else {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  return { view: view, shown: () => open };
}

export { createPalette };
export type { Palette };
