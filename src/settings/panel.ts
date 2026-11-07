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
import { buttonGap, buttonHeight } from "../ui/button";
import { createShadowText, fitText } from "../ui/text";
import { createWord, fitWord, paintWord, setWord, type Word } from "../ui/word";
import {
  createBrowser,
  type Browser,
  type Card,
} from "../create/maker/browser";
import { loadCreations } from "../create/storage";
import { isMusic } from "../create/sound";
import { menuSoundOf } from "../menu/soundscape";
import type { Creations, Sound } from "../create/types";
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
  getAutosave,
  getSafe,
  getFullscreen,
  getDim,
  getTv,
  getTuning,
  getVolume,
  onCrt,
  onRate,
  onResolution,
  onShake,
  onHitbox,
  onAutosave,
  onSafe,
  onFullscreen,
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
  setAutosave,
  setSafe,
  setFullscreen,
  setDim,
  setTv,
  setTuning,
  setVolume,
  setMenuSound,
  onMenuSound,
  type Channel,
  type MenuSlot,
} from "./settings";
import type { PageContent } from "../menu/page";
import { smoothDamp, type Spring } from "../effects/tween/tween";
import { getTheme } from "../theme/theme";
import { onTyping } from "../ui/typing";

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
const valueWidth: number = 474; // px
const wordGap: number = 28; // px
const sliderWidth: number = 360; // px
const sliderHeight: number = 14; // px
const sliderSlant: number = 6; // px
const sliderIdleAlpha: number = 0.55;
const valueGap: number = 24; // px
const listInset: number = 24; // px
const navWidth: number = 200; // px
const shadowColor: string = "#020b30";
const shadowDistance: number = 3; // px
const idleLabel: number = 0.4;
const labelShift: number = 8; // px
const subLabelSize: number = 28; // px
const subIndent: number = 34; // px
const branchX: number = 10; // px
const branchReach: number = 22; // px
const branchWidth: number = 2; // px
const branchAlpha: number = 0.6;
const branchGap: number = 4; // px
const sliderStep: number = 0.05;
const contentWidth: number = labelWidth + valueWidth; // px
const titleSize: number = 44; // px
const titleHeight: number = 64; // px
const categoryGap: number = 36; // px
const navGap: number = 70; // px
const listTop: number = 0.3; // of screen height
const listBottom: number = 0.9; // of screen height
const scrollSmoothing: number = 0.1; // s
const framePadding: number = 22; // px
const frameAlpha: number = 0.55;
const frameBorder: number = 2; // px
const toggleStates: Array<boolean> = [true, false];
const menuSoundNames: Array<[MenuSlot, string]> = [
  ["music", "menu music"],
  ["intro", "intro ambience"],
  ["portal", "portal ambience"],
];
const channelNames: Map<Channel, string> = new Map([
  ["master", "master volume"],
  ["soundtrack", "soundtrack"],
  ["sfx", "sound effects"],
  ["dialogue", "dialogue"],
]);

function createRow(name: string): [Container, Text] {
  const view: Container = new Container();
  const label: Text = createShadowText(
    name.toUpperCase(),
    labelSize,
    "#ffffff",
    shadowColor,
    shadowDistance,
  );

  label.anchor.set(0, 0.5);
  label.position.set(0, buttonHeight / 2);
  view.addChild(label);

  return [view, label];
}

function placeWords(words: Array<Word>): void {
  let x: number = labelWidth;

  for (const word of words) {
    word.view.position.set(x, buttonHeight / 2);
    x += word.view.width + wordGap;
  }
}

function addWords(view: Container, words: Array<Word>, all: Array<Word>): void {
  for (const word of words) {
    all.push(word);
    view.addChild(word.view);
  }

  placeWords(words);
}

function paintWords(words: Array<Word>): void {
  for (const word of words) {
    paintWord(word);
  }
}

function createToggleRow(
  name: string,
  get: () => boolean,
  set: (on: boolean) => void,
  all: Array<Word>,
): Row {
  const [view, label] = createRow(name);
  const words: Array<Word> = toggleStates.map((on: boolean) =>
    createWord(
      on ? "on" : "off",
      valueSize,
      () => get() === on,
      () => set(on),
    ),
  );

  addWords(view, words, all);

  return {
    view: view,
    label: label,
    adjust: (direction: number) => set(direction < 0),
    refresh: () => paintWords(words),
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
  all: Array<Word>,
): Row {
  const [view, label] = createRow(name);
  const words: Array<Word> = choices.map((value: number) =>
    createWord(
      title(value),
      valueSize,
      () => get() === value,
      () => set(value),
    ),
  );

  addWords(view, words, all);

  return {
    view: view,
    label: label,
    adjust: (direction: number) => {
      const index: number = choices.indexOf(get()) + direction;

      set(choices[Math.min(Math.max(index, 0), choices.length - 1)]!);
    },
    refresh: () => paintWords(words),
  };
}

function createBindingRow(
  binding: Binding,
  listening: () => Binding | null,
  listen: (binding: Binding) => void,
  all: Array<Word>,
): Row {
  const [view, label] = createRow(bindingNames.get(binding)!);
  const word: Word = createWord(
    bindingName(binding),
    valueSize,
    () => listening() === binding,
    () => listen(binding),
  );

  addWords(view, [word], all);

  return {
    view: view,
    label: label,
    adjust: () => listen(binding),
    refresh: () => {
      setWord(
        word,
        listening() === binding ? "press a key" : bindingName(binding),
      );
      paintWord(word);
    },
  };
}

function createCardRow(
  name: string,
  title: () => string,
  open: () => void,
  all: Array<Word>,
): Row {
  const [view, label] = createRow(name);
  const word: Word = createWord("", valueSize, () => true, open);

  addWords(view, [word], all);

  return {
    view: view,
    label: label,
    adjust: open,
    refresh: () => {
      fitText(word.view, title().toUpperCase(), valueWidth);
      fitWord(word);
      paintWord(word);
    },
  };
}

function createActionRow(
  name: string,
  title: string,
  action: () => void,
  all: Array<Word>,
): Row {
  const [view, label] = createRow(name);
  const word: Word = createWord(title, valueSize, () => false, action);

  addWords(view, [word], all);

  return {
    view: view,
    label: label,
    adjust: action,
    refresh: () => paintWord(word),
  };
}

function createSliderRow(
  name: string,
  get: () => number,
  set: (value: number) => void,
): Row {
  const [view, label] = createRow(name);
  const track: Graphics = new Graphics();
  const value: Text = createShadowText(
    "",
    valueSize,
    "#ffffff",
    shadowColor,
    shadowDistance,
  );
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
    value.tint = getTheme().menuText;
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
  const frame: Graphics = new Graphics();
  const crtWords: Array<Word> = new Array();
  const tvWords: Array<Word> = new Array();
  const shakeWords: Array<Word> = new Array();
  const hitboxWords: Array<Word> = new Array();
  const autosaveWords: Array<Word> = new Array();
  const safeWords: Array<Word> = new Array();
  const fullscreenWords: Array<Word> = new Array();
  const rateWords: Array<Word> = new Array();
  const resolutionWords: Array<Word> = new Array();
  const navWords: Array<Word> = new Array();
  const keyWords: Array<Word> = new Array();
  const cardWords: Array<Word> = new Array();
  let browsing: Creations = loadCreations();
  const browser: Browser = createBrowser(app, () => browsing);
  let listening: Binding | null = null;

  onTyping(() => listening !== null || browser.shown());

  function menuSoundName(slot: MenuSlot): string {
    return menuSoundOf(browsing, slot)?.name ?? "none";
  }

  function browseMenuSound(slot: MenuSlot, name: string): void {
    browsing = loadCreations();

    const sounds: Array<Sound | null> = [
      null,
      ...browsing.sounds.filter(isMusic),
    ];
    const cards: Array<Card> = sounds.map((sound: Sound | null) => ({
      label: sound?.name ?? "None",
      entry:
        sound === null
          ? null
          : {
              kind: "sound",
              index: browsing.sounds.indexOf(sound),
              item: sound,
            },
    }));
    const current: Sound | null = menuSoundOf(browsing, slot);

    listening = null;
    browser.open(name, cards, sounds.indexOf(current), (index: number) =>
      setMenuSound(slot, sounds[index]?.id ?? null),
    );
  }

  function listen(binding: Binding): void {
    listening = listening === binding ? null : binding;
    refresh();
  }
  const scroll: Spring = { value: 0, velocity: 0 };
  const categories: Array<Category> = [
    {
      name: "visual",
      rows: [
        createToggleRow("crt effect", getCrt, setCrt, crtWords),
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
        createToggleRow("tv mode", getTv, setTv, tvWords),
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
        createToggleRow(
          "fullscreen",
          getFullscreen,
          setFullscreen,
          fullscreenWords,
        ),
        createChoiceRow(
          "resolution",
          resolutions,
          (lines: number) => (lines === 0 ? "auto" : lines + "p"),
          getResolution,
          setResolution,
          resolutionWords,
        ),
        createChoiceRow(
          "framerate",
          rates,
          String,
          getRate,
          setRate,
          rateWords,
        ),
      ],
    },
    {
      name: "gameplay",
      rows: [
        createToggleRow("shake & rumble", getShake, setShake, shakeWords),
        createToggleRow(
          "always show hitbox",
          getHitbox,
          setHitbox,
          hitboxWords,
        ),
        createSliderRow("background dim", getDim, setDim),
        createToggleRow("safe for work", getSafe, setSafe, safeWords),
      ],
    },
    {
      name: "create",
      rows: [
        createToggleRow(
          "transcript autosave",
          getAutosave,
          setAutosave,
          autosaveWords,
        ),
      ],
    },
    {
      name: "controls",
      rows: [
        ...bindingList.map((binding: Binding) =>
          createBindingRow(binding, () => listening, listen, keyWords),
        ),
        createActionRow(
          "reset controls",
          "reset",
          () => {
            listening = null;
            resetBindings();
          },
          keyWords,
        ),
      ],
    },
    {
      name: "audio",
      rows: [
        ...channels.map((channel: Channel) =>
          createSliderRow(
            channelNames.get(channel)!,
            () => getVolume(channel),
            (value: number) => setVolume(channel, value),
          ),
        ),
        ...menuSoundNames.map(([slot, name]: [MenuSlot, string]) =>
          createCardRow(
            name,
            () => menuSoundName(slot),
            () => browseMenuSound(slot, name),
            cardWords,
          ),
        ),
      ],
    },
  ].map((entry: { name: string; rows: Array<Row> }) => ({
    ...entry,
    title: createShadowText(
      "",
      titleSize,
      "#ffffff",
      shadowColor,
      shadowDistance,
    ),
    top: 0,
  }));
  const rows: Array<Row> = categories.flatMap((entry: Category) => entry.rows);
  let selected: number = 0;
  let target: number = 0;
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
  }

  for (let index = 0; index < categories.length; index++) {
    const entry: Category = categories[index]!;
    const word: Word = createWord(
      entry.name,
      labelSize,
      () => categoryOf(selected) === entry,
      () => jumpTo(index),
    );

    word.view.y = index * (buttonHeight + buttonGap) + buttonHeight / 2;
    navWords.push(word);
    nav.addChild(word.view);
  }

  viewport.addChild(list, mask);
  list.mask = mask;
  view.addChild(frame, nav, viewport, browser.view);

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
          label.alpha = idleLabel + amount * (1 - idleLabel);
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

    drawFrame();

    for (const word of navWords) {
      paintWord(word);
    }
  }

  function drawFrame(): void {
    const left: number = -listInset - framePadding;
    const right: number = contentWidth + framePadding;
    const top: number = -framePadding;
    const bottom: number = visibleHeight + framePadding;

    frame
      .clear()
      .rect(left, top, right - left, bottom - top)
      .fill({ color: "#01040f", alpha: frameAlpha })
      .stroke({ color: getTheme().highlight, width: frameBorder });
    frame.position.copyFrom(viewport.position);
  }

  function layout(): void {
    const top: number = Math.round(app.screen.height * listTop);
    const left: number = Math.round(
      app.screen.width / 2 - (navWidth + navGap + contentWidth) / 2,
    );

    visibleHeight = Math.round(app.screen.height * listBottom) - top;
    nav.position.set(left, top);
    viewport.position.set(left + navWidth + navGap, top);
    mask
      .clear()
      .rect(-listInset, 0, contentWidth + listInset, visibleHeight)
      .fill(0xffffff);
    viewport.hitArea = new Rectangle(0, 0, contentWidth, visibleHeight);
    target = Math.min(target, maxScroll());
    drawFrame();
    browser.layout();
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
    browser.update(ticker.deltaMS / 1000);
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

    if (!value) {
      browser.close();
    }

    view.eventMode = value ? "passive" : "none";
  }

  onBindings(refresh);
  onCrt(refresh);
  onShake(refresh);
  onHitbox(refresh);
  onAutosave(refresh);
  onSafe(refresh);
  onFullscreen(refresh);
  onDim(refresh);
  onTv(refresh);
  onTuning(refresh);
  onVolume(refresh);
  onRate(refresh);
  onResolution(refresh);
  onMenuSound(refresh);
  arrange();
  layout();
  setActive(false);
  app.renderer.on("resize", layout);

  function enter(): void {
    browsing = loadCreations();
    selected = 0;
    target = 0;
    scroll.value = 0;
    scroll.velocity = 0;
    list.y = 0;
    refresh();

    for (let index = 0; index < rows.length; index++) {
      rows[index]!.focus?.snap(index === 0 ? 1 : 0);
    }

    for (const word of navWords) {
      word.lit.snap(word.active() ? 1 : 0);
    }
  }

  return {
    view: view,
    setActive: setActive,
    enter: enter,
    back: () => {
      if (!browser.shown()) {
        return false;
      }

      browser.close();
      return true;
    },
    topic: () => "config",
  };
}

export { createSettings };
