import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type Application,
  type FederatedPointerEvent,
  type FederatedWheelEvent,
  type Ticker,
} from "pixi.js";
import {
  buttonGap,
  buttonHeight,
  buttonWidth,
  createButton,
  fontFamily,
  paintButton,
  type Button,
} from "../editor/button";
import {
  channels,
  getRate,
  getSky,
  getVolume,
  onRate,
  onSky,
  onVolume,
  rates,
  setRate,
  setSky,
  setVolume,
  type Channel,
  type Sky,
} from "./settings";
import type { PageContent } from "../menu/page";
import { smoothDamp, type Spring } from "../effects/tween/tween";
import { getTheme } from "../theme/theme";

type Row = {
  view: Container;
  label: Text;
  adjust: (direction: number) => void;
  refresh: () => void;
};

const labelSize: number = 34; // px
const valueSize: number = 28; // px
const labelWidth: number = 300; // px
const rowHeight: number = 64; // px
const sliderWidth: number = 360; // px
const sliderHeight: number = 14; // px
const sliderSlant: number = 6; // px
const sliderIdleAlpha: number = 0.55;
const valueGap: number = 24; // px
const markerWidth: number = 10; // px
const markerGap: number = 18; // px
const volumeStep: number = 0.05;
const contentWidth: number = labelWidth + sliderWidth + valueGap + 90; // px
const titleSize: number = 44; // px
const titleHeight: number = 64; // px
const categoryGap: number = 36; // px
const navGap: number = 70; // px
const listTop: number = 0.3; // of screen height
const listBottom: number = 0.9; // of screen height
const scrollSmoothing: number = 0.1; // s
const skies: Array<Sky> = ["day", "night"];
const rateButtonWidth: number = 88; // px
const channelNames: Map<Channel, string> = new Map([
  ["master", "master volume"],
  ["soundtrack", "soundtrack"],
  ["sfx", "sound effects"],
  ["dialogue", "dialogue"],
]);

function createText(size: number): Text {
  return new Text({
    text: "",
    style: {
      fontFamily: fontFamily,
      fontSize: size,
      fontStyle: "italic",
      fontWeight: "900",
      fill: 0xffffff,
    },
  });
}

function createRow(name: string): [Container, Text] {
  const view: Container = new Container();
  const label: Text = createText(labelSize);

  label.text = name.toUpperCase();
  label.anchor.set(0, 0.5);
  label.position.set(0, buttonHeight / 2);
  view.addChild(label);

  return [view, label];
}

function createSkyRow(buttons: Array<Button>): Row {
  const [view, label] = createRow("sky");

  for (let index = 0; index < skies.length; index++) {
    const sky: Sky = skies[index]!;
    const button: Button = createButton(
      sky,
      () => getSky() === sky,
      () => setSky(sky),
    );

    button.view.position.set(labelWidth + index * (buttonWidth + buttonGap), 0);
    buttons.push(button);
    view.addChild(button.view);
  }

  return {
    view: view,
    label: label,
    adjust: (direction: number) => setSky(direction < 0 ? "day" : "night"),
    refresh: () => {
      for (const button of buttons) {
        paintButton(button);
      }
    },
  };
}

function createRateRow(buttons: Array<Button>): Row {
  const [view, label] = createRow("framerate");

  for (let index = 0; index < rates.length; index++) {
    const value: number = rates[index]!;
    const button: Button = createButton(
      String(value),
      () => getRate() === value,
      () => setRate(value),
      rateButtonWidth,
    );

    button.view.position.set(
      labelWidth + index * (rateButtonWidth + buttonGap),
      0,
    );
    buttons.push(button);
    view.addChild(button.view);
  }

  return {
    view: view,
    label: label,
    adjust: (direction: number) => {
      const index: number = rates.indexOf(getRate()) + direction;

      setRate(rates[Math.min(Math.max(index, 0), rates.length - 1)]!);
    },
    refresh: () => {
      for (const button of buttons) {
        paintButton(button);
      }
    },
  };
}

function createVolumeRow(channel: Channel): Row {
  const [view, label] = createRow(channelNames.get(channel)!);
  const track: Graphics = new Graphics();
  const value: Text = createText(valueSize);
  let dragging: boolean = false;

  function shape(graphics: Graphics, width: number): Graphics {
    return graphics.poly([
      sliderSlant,
      0,
      width,
      0,
      width - sliderSlant,
      sliderHeight,
      0,
      sliderHeight,
    ]);
  }

  function refresh(): void {
    const volume: number = getVolume(channel);

    track.clear();
    shape(track, sliderWidth).fill({
      color: getTheme().menuSelected,
      alpha: sliderIdleAlpha,
    });

    if (volume > 0) {
      shape(track, Math.max(sliderWidth * volume, sliderSlant * 2)).fill(
        getTheme().highlight,
      );
    }

    value.text = Math.round(volume * 100) + "%";
  }

  function pick(event: FederatedPointerEvent): void {
    const x: number = track.toLocal(event.global).x;

    setVolume(channel, Math.round((x / sliderWidth) * 100) / 100);
  }

  track.position.set(labelWidth, (buttonHeight - sliderHeight) / 2);
  track.eventMode = "static";
  track.cursor = "pointer";
  track.hitArea = new Rectangle(
    -sliderSlant,
    -(buttonHeight - sliderHeight) / 2,
    sliderWidth + sliderSlant * 2,
    buttonHeight,
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
  value.anchor.set(0, 0.5);
  value.position.set(labelWidth + sliderWidth + valueGap, buttonHeight / 2);
  view.addChild(track, value);

  return {
    view: view,
    label: label,
    adjust: (direction: number) =>
      setVolume(channel, getVolume(channel) + direction * volumeStep),
    refresh: refresh,
  };
}

type Category = {
  name: string;
  rows: Array<Row>;
  title: Text;
  top: number; // px
};

function createSettings(app: Application): PageContent {
  const view: Container = new Container();
  const nav: Container = new Container();
  const viewport: Container = new Container();
  const list: Container = new Container();
  const mask: Graphics = new Graphics();
  const marker: Graphics = new Graphics();
  const skyButtons: Array<Button> = new Array();
  const rateButtons: Array<Button> = new Array();
  const navButtons: Array<Button> = new Array();
  const scroll: Spring = { value: 0, velocity: 0 };
  const categories: Array<Category> = [
    {
      name: "display",
      rows: [createSkyRow(skyButtons), createRateRow(rateButtons)],
    },
    {
      name: "audio",
      rows: channels.map((channel: Channel) => createVolumeRow(channel)),
    },
  ].map((entry: { name: string; rows: Array<Row> }) => ({
    ...entry,
    title: createText(titleSize),
    top: 0,
  }));
  const rows: Array<Row> = categories.flatMap((entry: Category) => entry.rows);
  let selected: number = 0;
  let target: number = 0;
  let active: boolean = false;
  let visibleHeight: number = 1;
  let contentHeight: number = 0;

  for (const entry of categories) {
    entry.top = contentHeight;
    entry.title.text = entry.name.toUpperCase();
    entry.title.anchor.set(0, 0.5);
    entry.title.position.set(0, contentHeight + titleHeight / 2);
    list.addChild(entry.title);
    contentHeight += titleHeight;

    for (const row of entry.rows) {
      row.view.y = contentHeight;
      list.addChild(row.view);
      contentHeight += rowHeight;
    }

    contentHeight += categoryGap;
  }

  contentHeight -= categoryGap;

  for (let index = 0; index < categories.length; index++) {
    const entry: Category = categories[index]!;
    const button: Button = createButton(
      entry.name,
      () => categoryOf(selected) === entry,
      () => jumpTo(index),
    );

    button.view.y = index * (buttonHeight + buttonGap);
    navButtons.push(button);
    nav.addChild(button.view);
  }

  list.addChild(marker);
  viewport.addChild(list, mask);
  list.mask = mask;
  view.addChild(nav, viewport);

  function categoryOf(index: number): Category {
    let count: number = 0;

    for (const entry of categories) {
      count += entry.rows.length;

      if (index < count) {
        return entry;
      }
    }

    return categories[categories.length - 1]!;
  }

  function maxScroll(): number {
    return Math.max(contentHeight - visibleHeight, 0);
  }

  function reveal(top: number, bottom: number): void {
    if (top < target) {
      target = top;
    } else if (bottom > target + visibleHeight) {
      target = bottom - visibleHeight;
    }

    target = Math.min(Math.max(target, 0), maxScroll());
  }

  function select(index: number): void {
    const row: Row = rows[index]!;

    selected = index;
    reveal(row.view.y, row.view.y + rowHeight);
    refresh();
  }

  function jumpTo(index: number): void {
    const entry: Category | undefined = categories[index];

    if (entry === undefined) {
      return;
    }

    target = Math.min(entry.top, maxScroll());
    selected = rows.indexOf(entry.rows[0]!);
    refresh();
  }

  function refresh(): void {
    for (let index = 0; index < rows.length; index++) {
      const row: Row = rows[index]!;

      row.label.tint = getTheme().menuText;
      row.label.alpha = index === selected ? 1 : 0.7;
      row.refresh();
    }

    for (const entry of categories) {
      entry.title.tint = getTheme().accent;
    }

    for (const button of navButtons) {
      paintButton(button);
    }

    marker
      .clear()
      .poly([0, 0, markerWidth, buttonHeight / 2, 0, buttonHeight])
      .fill(getTheme().accent);
    marker.position.set(-markerWidth - markerGap, rows[selected]!.view.y);
  }

  function layout(): void {
    const top: number = Math.round(app.screen.height * listTop);
    const left: number = Math.round(
      app.screen.width / 2 - (buttonWidth + navGap + contentWidth) / 2,
    );

    visibleHeight = Math.round(app.screen.height * listBottom) - top;
    nav.position.set(left, top);
    viewport.position.set(left + buttonWidth + navGap, top);
    mask
      .clear()
      .rect(
        -markerWidth - markerGap * 2,
        0,
        contentWidth + markerWidth + markerGap * 2,
        visibleHeight,
      )
      .fill(0xffffff);
    viewport.hitArea = new Rectangle(0, 0, contentWidth, visibleHeight);
    target = Math.min(target, maxScroll());
  }

  viewport.eventMode = "static";
  viewport.on("wheel", (event: FederatedWheelEvent) => {
    target = Math.min(Math.max(target + event.deltaY, 0), maxScroll());
  });

  app.ticker.add((ticker: Ticker) => {
    if (!view.visible) {
      return;
    }

    smoothDamp(scroll, target, scrollSmoothing, ticker.deltaMS / 1000);
    list.y = -scroll.value;
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!active || event.altKey) {
      return;
    }

    const current: number = categories.indexOf(categoryOf(selected));

    if (event.code === "KeyQ" || event.code === "PageUp") {
      jumpTo(Math.max(current - 1, 0));
    } else if (event.code === "KeyE" || event.code === "PageDown") {
      jumpTo(Math.min(current + 1, categories.length - 1));
    } else if (event.code.startsWith("Digit")) {
      jumpTo(Number(event.code.slice(5)) - 1);
    } else if (event.code === "ArrowUp" || event.code === "KeyW") {
      select((selected - 1 + rows.length) % rows.length);
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
      select((selected + 1) % rows.length);
    } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
      rows[selected]!.adjust(-1);
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      rows[selected]!.adjust(1);
    } else {
      return;
    }

    event.preventDefault();
  });

  function setActive(value: boolean): void {
    active = value;
    view.eventMode = value ? "passive" : "none";
  }

  onSky(refresh);
  onVolume(refresh);
  onRate(refresh);
  layout();
  setActive(false);
  app.renderer.on("resize", layout);

  return { view: view, setActive: setActive };
}

export { createSettings };
