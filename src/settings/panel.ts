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
  paintButton,
  type Button,
} from "../ui/button";
import { createText } from "../ui/text";
import {
  bindingList,
  bindingName,
  bindingNames,
  downKeys,
  leftKeys,
  onBindings,
  resetBindings,
  rightKeys,
  setBinding,
  upKeys,
  type Binding,
} from "../game/input";
import { createGlide, type Glide } from "../ui/motion";
import {
  channels,
  getCrt,
  getRate,
  getResolution,
  getShake,
  getHitbox,
  getDim,
  getTv,
  getTuning,
  getVolume,
  onCrt,
  onRate,
  onResolution,
  onShake,
  onHitbox,
  onDim,
  onTv,
  onTuning,
  onVolume,
  rates,
  resolutions,
  setCrt,
  setRate,
  setResolution,
  setShake,
  setHitbox,
  setDim,
  setTv,
  setTuning,
  setVolume,
  type Channel,
} from "./settings";
import type { PageContent } from "../menu/page";
import { smoothDamp, type Spring } from "../effects/tween/tween";
import { getTheme } from "../theme/theme";

type Row = {
  view: Container;
  label: Text;
  adjust: (direction: number) => void;
  refresh: () => void;
  focus?: Glide;
  shown?: () => boolean;
  branch?: Graphics;
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
const labelShift: number = 8; // px
const subLabelSize: number = 28; // px
const subIndent: number = 34; // px
const branchX: number = 10; // px
const branchReach: number = 22; // px
const branchWidth: number = 2; // px
const branchAlpha: number = 0.6;
const branchGap: number = 4; // px
const sliderStep: number = 0.05;
const contentWidth: number = labelWidth + sliderWidth + valueGap + 90; // px
const titleSize: number = 44; // px
const titleHeight: number = 64; // px
const categoryGap: number = 36; // px
const navGap: number = 70; // px
const listTop: number = 0.3; // of screen height
const listBottom: number = 0.9; // of screen height
const scrollSmoothing: number = 0.1; // s
const rateButtonWidth: number = 88; // px
const keyButtonWidth: number = 220; // px
const toggleStates: Array<boolean> = [true, false];
const channelNames: Map<Channel, string> = new Map([
  ["master", "master volume"],
  ["soundtrack", "soundtrack"],
  ["sfx", "sound effects"],
  ["dialogue", "dialogue"],
]);

function createRow(name: string): [Container, Text] {
  const view: Container = new Container();
  const label: Text = createText(labelSize);

  label.text = name.toUpperCase();
  label.anchor.set(0, 0.5);
  label.position.set(0, buttonHeight / 2);
  view.addChild(label);

  return [view, label];
}

function createToggleRow(
  name: string,
  get: () => boolean,
  set: (on: boolean) => void,
  buttons: Array<Button>,
): Row {
  const [view, label] = createRow(name);

  for (let index = 0; index < toggleStates.length; index++) {
    const on: boolean = toggleStates[index]!;
    const button: Button = createButton(
      on ? "on" : "off",
      () => get() === on,
      () => set(on),
    );

    button.view.position.set(labelWidth + index * (buttonWidth + buttonGap), 0);
    buttons.push(button);
    view.addChild(button.view);
  }

  return {
    view: view,
    label: label,
    adjust: (direction: number) => set(direction < 0),
    refresh: () => {
      for (const button of buttons) {
        paintButton(button);
      }
    },
  };
}

function subRow(row: Row, shown: () => boolean): Row {
  const branch: Graphics = new Graphics();

  row.label.style.fontSize = subLabelSize;
  row.label.x = subIndent;
  row.view.addChildAt(branch, 0);

  return { ...row, shown: shown, branch: branch };
}

function drawBranch(branch: Graphics, joined: boolean): void {
  const top: number = joined
    ? buttonHeight / 2 - rowHeight
    : buttonHeight - rowHeight + branchGap;

  branch
    .clear()
    .moveTo(branchX, top)
    .lineTo(branchX, buttonHeight / 2)
    .lineTo(branchX + branchReach, buttonHeight / 2)
    .stroke({
      color: getTheme().accent,
      alpha: branchAlpha,
      width: branchWidth,
    });
}

function createChoiceRow(
  name: string,
  choices: Array<number>,
  title: (value: number) => string,
  get: () => number,
  set: (value: number) => void,
  buttons: Array<Button>,
): Row {
  const [view, label] = createRow(name);

  for (let index = 0; index < choices.length; index++) {
    const value: number = choices[index]!;
    const button: Button = createButton(
      title(value),
      () => get() === value,
      () => set(value),
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
      const index: number = choices.indexOf(get()) + direction;

      set(choices[Math.min(Math.max(index, 0), choices.length - 1)]!);
    },
    refresh: () => {
      for (const button of buttons) {
        paintButton(button);
      }
    },
  };
}

function createBindingRow(
  binding: Binding,
  listening: () => Binding | null,
  listen: (binding: Binding) => void,
  buttons: Array<Button>,
): Row {
  const [view, label] = createRow(bindingNames.get(binding)!);
  const button: Button = createButton(
    bindingName(binding),
    () => listening() === binding,
    () => listen(binding),
    keyButtonWidth,
  );

  button.view.position.set(labelWidth, 0);
  buttons.push(button);
  view.addChild(button.view);

  return {
    view: view,
    label: label,
    adjust: () => listen(binding),
    refresh: () => {
      button.label.text =
        listening() === binding ? "PRESS A KEY" : bindingName(binding);
      paintButton(button);
    },
  };
}

function createActionRow(
  name: string,
  title: string,
  action: () => void,
  buttons: Array<Button>,
): Row {
  const [view, label] = createRow(name);
  const button: Button = createButton(title, () => false, action);

  button.view.position.set(labelWidth, 0);
  buttons.push(button);
  view.addChild(button.view);

  return {
    view: view,
    label: label,
    adjust: action,
    refresh: () => paintButton(button),
  };
}

function createSliderRow(
  name: string,
  get: () => number,
  set: (value: number) => void,
): Row {
  const [view, label] = createRow(name);
  const track: Graphics = new Graphics();
  const value: Text = createText(valueSize);
  const level: Glide = createGlide(get(), draw);
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

  function draw(): void {
    const volume: number = level.value();

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
  }

  function refresh(): void {
    level.set(get());
    value.text = Math.round(get() * 100) + "%";
    draw();
  }

  function pick(event: FederatedPointerEvent): void {
    const x: number = track.toLocal(event.global).x;

    set(Math.round((x / sliderWidth) * 100) / 100);
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
    adjust: (direction: number) => set(get() + direction * sliderStep),
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
  const crtButtons: Array<Button> = new Array();
  const tvButtons: Array<Button> = new Array();
  const shakeButtons: Array<Button> = new Array();
  const hitboxButtons: Array<Button> = new Array();
  const rateButtons: Array<Button> = new Array();
  const resolutionButtons: Array<Button> = new Array();
  const navButtons: Array<Button> = new Array();
  const keyButtons: Array<Button> = new Array();
  let listening: Binding | null = null;

  function listen(binding: Binding): void {
    listening = listening === binding ? null : binding;
    refresh();
  }
  const scroll: Spring = { value: 0, velocity: 0 };
  const categories: Array<Category> = [
    {
      name: "visual",
      rows: [
        createToggleRow("crt effect", getCrt, setCrt, crtButtons),
        subRow(
          createSliderRow(
            "scanlines",
            () => getTuning("scanlines"),
            (value: number) => setTuning("scanlines", value),
          ),
          getCrt,
        ),
        subRow(
          createSliderRow(
            "colour fringe",
            () => getTuning("fringe"),
            (value: number) => setTuning("fringe", value),
          ),
          getCrt,
        ),
        subRow(
          createSliderRow(
            "glow",
            () => getTuning("glow"),
            (value: number) => setTuning("glow", value),
          ),
          getCrt,
        ),
        subRow(
          createSliderRow(
            "flicker",
            () => getTuning("flicker"),
            (value: number) => setTuning("flicker", value),
          ),
          getCrt,
        ),
        createToggleRow("tv mode", getTv, setTv, tvButtons),
        subRow(
          createSliderRow(
            "curvature strength",
            () => getTuning("curvature"),
            (value: number) => setTuning("curvature", value),
          ),
          getTv,
        ),
        subRow(
          createSliderRow(
            "vignette power",
            () => getTuning("vignette"),
            (value: number) => setTuning("vignette", value),
          ),
          getTv,
        ),
      ],
    },
    {
      name: "display",
      rows: [
        createChoiceRow(
          "resolution",
          resolutions,
          (lines: number) => (lines === 0 ? "auto" : lines + "p"),
          getResolution,
          setResolution,
          resolutionButtons,
        ),
        createChoiceRow(
          "framerate",
          rates,
          String,
          getRate,
          setRate,
          rateButtons,
        ),
      ],
    },
    {
      name: "gameplay",
      rows: [
        createToggleRow("shake & rumble", getShake, setShake, shakeButtons),
        createToggleRow(
          "always show hitbox",
          getHitbox,
          setHitbox,
          hitboxButtons,
        ),
        createSliderRow("background dim", getDim, setDim),
      ],
    },
    {
      name: "controls",
      rows: [
        ...bindingList.map((binding: Binding) =>
          createBindingRow(binding, () => listening, listen, keyButtons),
        ),
        createActionRow(
          "reset controls",
          "reset",
          () => {
            listening = null;
            resetBindings();
          },
          keyButtons,
        ),
      ],
    },
    {
      name: "audio",
      rows: channels.map((channel: Channel) =>
        createSliderRow(
          channelNames.get(channel)!,
          () => getVolume(channel),
          (value: number) => setVolume(channel, value),
        ),
      ),
    },
  ].map((entry: { name: string; rows: Array<Row> }) => ({
    ...entry,
    title: createText(titleSize),
    top: 0,
  }));
  const rows: Array<Row> = categories.flatMap((entry: Category) => entry.rows);
  let selected: number = 0;
  let target: number = 0;
  let placed: boolean = false;
  const markerY: Glide = createGlide(0, (y: number) => {
    marker.y = y;
  });
  let active: boolean = false;
  let visibleHeight: number = 1;
  let contentHeight: number = 0;

  const presence: Map<Row, Glide> = new Map();

  for (const entry of categories) {
    entry.title.text = entry.name.toUpperCase();
    entry.title.anchor.set(0, 0.5);
    list.addChild(entry.title);

    for (const row of entry.rows) {
      const shown: () => boolean = row.shown ?? (() => true);

      list.addChild(row.view);
      presence.set(row, createGlide(shown() ? 1 : 0, arrange));
    }
  }

  function amountOf(row: Row): number {
    return presence.get(row)!.value();
  }

  function arrange(): void {
    let y: number = 0;

    for (const entry of categories) {
      entry.top = y;
      entry.title.position.set(0, y + titleHeight / 2);
      y += titleHeight;

      for (const row of entry.rows) {
        const amount: number = amountOf(row);

        row.view.y = y;
        row.view.alpha = amount;
        row.view.visible = amount > 0;
        y += rowHeight * amount;
      }

      y += categoryGap;
    }

    contentHeight = y - categoryGap;
    target = Math.min(target, maxScroll());

    if (placed) {
      markerY.set(rows[selected]!.view.y);
    }
  }

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

  function isShown(row: Row): boolean {
    return row.shown?.() ?? true;
  }

  function step(direction: number): void {
    let index: number = selected;

    do {
      index = (index + direction + rows.length) % rows.length;
    } while (!isShown(rows[index]!) && index !== selected);

    select(index);
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
    if (!isShown(rows[selected]!)) {
      selected = rows.findIndex(isShown);
    }

    for (let index = 0; index < rows.length; index++) {
      const row: Row = rows[index]!;

      presence.get(row)!.set(isShown(row) ? 1 : 0);
      const label: Text = row.label;

      const indent: number = row.branch === undefined ? 0 : subIndent;

      row.focus ??= createGlide(
        index === selected ? 1 : 0,
        (amount: number) => {
          label.alpha = 0.7 + amount * 0.3;
          label.x = indent + amount * labelShift;
        },
      );

      if (row.branch !== undefined) {
        drawBranch(row.branch, rows[index - 1]?.branch !== undefined);
      }
      label.tint = getTheme().menuText;
      row.focus.set(index === selected ? 1 : 0);
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
    marker.x = -markerWidth - markerGap;

    if (placed) {
      markerY.set(rows[selected]!.view.y);
    } else {
      placed = true;
      markerY.snap(rows[selected]!.view.y);
    }
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
    if (!active || listening === null) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.code !== "Escape" && !setBinding(listening, event.code)) {
      return;
    }

    listening = null;
    refresh();
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
    } else if (upKeys.includes(event.code)) {
      step(-1);
    } else if (downKeys.includes(event.code)) {
      step(1);
    } else if (leftKeys.includes(event.code)) {
      rows[selected]!.adjust(-1);
    } else if (rightKeys.includes(event.code)) {
      rows[selected]!.adjust(1);
    } else {
      return;
    }

    event.preventDefault();
  });

  function setActive(value: boolean): void {
    active = value;
    listening = null;
    view.eventMode = value ? "passive" : "none";
  }

  onBindings(refresh);
  onCrt(refresh);
  onShake(refresh);
  onHitbox(refresh);
  onDim(refresh);
  onTv(refresh);
  onTuning(refresh);
  onVolume(refresh);
  onRate(refresh);
  onResolution(refresh);
  arrange();
  layout();
  setActive(false);
  app.renderer.on("resize", layout);

  function enter(): void {
    selected = 0;
    target = 0;
    scroll.value = 0;
    scroll.velocity = 0;
    list.y = 0;
    placed = false;
    refresh();

    for (let index = 0; index < rows.length; index++) {
      rows[index]!.focus?.snap(index === 0 ? 1 : 0);
    }

    for (const button of navButtons) {
      button.lit.snap(button.active() ? 1 : 0);
    }
  }

  return {
    view: view,
    setActive: setActive,
    enter: enter,
    topic: () => "config",
  };
}

export { createSettings };
