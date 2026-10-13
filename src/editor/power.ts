import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  type Application,
  type FederatedWheelEvent,
  type Texture,
  type Ticker,
} from "pixi.js";
import {
  createChip,
  createChoice,
  createColors,
  createHeader,
  createText,
  createSlider,
  rowHeight,
  rowWidth,
  chipHeight,
  headerHeight,
  type Chip,
  type Control,
  type Option,
} from "../create/widgets";
import {
  createSquad,
  droneSettings,
  maxPower,
  minPower,
  resetDrones,
  saveDrones,
  type Squad,
} from "../game/drones";
import {
  downKeys,
  bombKeys,
  focusKeys,
  hitboxColor,
  hitboxRadius,
  leftKeys,
  rightKeys,
  upKeys,
} from "../game/playfield";
import {
  archetype,
  archetypes,
  setArchetype,
  type Archetype,
  type ArchetypeId,
} from "../game/archetype";
import { hudHeight, hudWidth } from "../game/hud";
import { approach, smoothDamp, type Spring } from "../effects/tween/tween";
import { getTheme } from "../theme/theme";
import {
  bombLook,
  createBomb,
  resetLooks,
  saveLooks,
  type Bomb,
  type Look,
} from "../game/bomb";

type Power = {
  view: Container;
  layout: (x: number, y: number, width: number, height: number) => void;
  setActive: (active: boolean) => void;
};

const fieldWidth: number = 384; // units
const fieldHeight: number = 448; // units
const fieldColor: string = "#01040f";
const frameColor: string = "#ffffff";
const frameWidth: number = 1.5; // units
const playerSize: number = 32; // units
const playerStartY: number = 0.8; // of field height
const panelGap: number = 30; // px
const rowSmoothing: number = 0.06; // s
const rowFade: number = 0.15; // s
const scrollSmoothing: number = 0.08; // s
const scrollBarWidth: number = 2; // units
const scrollBarGap: number = 3; // units
const scrollBarMinimum: number = 12; // units
const summarySize: number = 10; // units
const hintSize: number = 11; // units
const hintGap: number = 8; // units
const hintColor: string = "#9fd8ff";
const resetWidth: number = 60; // units
const maxDelta: number = 0.05; // s
const shotKeys: Array<string> = ["KeyZ"];
const fontFamily: Array<string> = [
  "Barlow Condensed",
  "Arial Black",
  "Impact",
  "sans-serif",
];
const tintColors: Array<string> = [
  "#000000",
  "#1a0a2e",
  "#2a0a3a",
  "#3a0a14",
  "#3a3000",
  "#0a2a14",
  "#001a3a",
  "#ffffff",
];
const shotColors: Array<string> = [
  "#ffffff",
  "#ff3b3b",
  "#ff8a80",
  "#ffb347",
  "#fff27a",
  "#7ae38f",
  "#7ad8ff",
  "#3b82ff",
  "#b48aff",
  "#ff6fd8",
];

function createPower(
  app: Application,
  playerTexture: Texture,
  droneTexture: Texture,
): Power {
  const view: Container = new Container();
  const field: Container = new Container();
  const back: Graphics = new Graphics();
  const mask: Graphics = new Graphics();
  const bombMask: Graphics = new Graphics();
  const frame: Graphics = new Graphics();
  const player: Sprite = new Sprite(playerTexture);
  const hitbox: Graphics = new Graphics();
  const squad: Squad = createSquad(droneTexture, fieldWidth, fieldHeight);
  const bomb: Bomb = createBomb(fieldWidth, fieldHeight);
  const panel: Container = new Container();
  const content: Container = new Container();
  const panelMask: Graphics = new Graphics();
  const hint: Text = new Text({
    text: "ARROWS  MOVE   ·   SHIFT  FOCUS   ·   Z  SHOOT   ·   X  BOMB",
    style: {
      fontFamily: fontFamily,
      fontSize: hintSize,
      fontStyle: "italic",
      fontWeight: "900",
      fill: hintColor,
    },
  });
  const held: Set<string> = new Set();
  let power: number = maxPower;
  const opened: Set<string> = new Set();
  let active: boolean = false;
  const scroll: Spring = { value: 0, velocity: 0 };
  const rowTargets: Map<Container, number> = new Map();
  const scrollBar: Graphics = new Graphics();
  let scrollTarget: number = 0;
  let laidOut: boolean = false;
  let contentHeight: number = 0;
  let viewHeight: number = 0;
  let bombHeld: boolean = false;

  function changed(): void {
    saveDrones();
    refresh();
  }

  function look(): Look {
    return bombLook(archetype().bomb);
  }

  function restyled(): void {
    saveLooks();
    refresh();
  }

  const reset: Chip = createChip("reset", resetWidth, () => {
    resetDrones();
    resetLooks();
    refresh();
  });

  function section(name: string, list: Array<Control>): Array<Control> {
    const header: Control = createHeader(
      name,
      () => opened.has(name),
      () => {
        if (!opened.delete(name)) {
          opened.add(name);
        }

        refresh();
      },
    );

    return [
      header,
      ...list.map((control: Control) => {
        const shown: (() => boolean) | undefined = control.shown;

        return {
          ...control,
          shown: () => opened.has(name) && (shown?.() ?? true),
        };
      }),
    ];
  }

  const summary: Text = createText(summarySize, hintColor);
  const summaryRow: Container = new Container();

  const controls: Array<Control> = [
    ...section("Archetype", [
      createChoice(
        "Archetype",
        () =>
          archetypes.map((entry: Archetype): Option<ArchetypeId> => ({
            value: entry.id,
            label: entry.name,
          })),
        () => archetype().id,
        (value: ArchetypeId) => {
          setArchetype(value);
          refresh();
        },
      ),
      {
        view: summaryRow,
        refresh: () => {
          summary.text = archetype().summary.toUpperCase();
        },
      },
    ]),
    ...section("Drones", [
      createSlider(
        "Power preview",
        minPower,
        maxPower,
        0.05,
        () => power,
        (value: number) => {
          power = value;
          squad.setPower(value);
          refresh();
        },
      ),
      createSlider(
        "Drone spin",
        -720,
        720,
        15,
        () => droneSettings().spin,
        (value: number) => {
          droneSettings().spin = value;
          changed();
        },
      ),
      createColors(
        "Main shot",
        shotColors,
        () => droneSettings().mainColor,
        (value: string) => {
          droneSettings().mainColor = value;
          changed();
        },
      ),
      createColors(
        "Drone shot",
        shotColors,
        () => droneSettings().shotColor,
        (value: string) => {
          droneSettings().shotColor = value;
          changed();
        },
      ),
    ]),
    ...section("Bomb", [
      createColors(
        "Bomb glow",
        shotColors,
        () => look().glow,
        (value: string) => {
          look().glow = value;
          restyled();
        },
      ),
      createColors(
        "Bomb ring",
        shotColors,
        () => look().ring,
        (value: string) => {
          look().ring = value;
          restyled();
        },
      ),
      createSlider(
        "Ring thickness",
        1,
        10,
        0.5,
        () => look().ringWidth,
        (value: number) => {
          look().ringWidth = value;
          restyled();
        },
      ),
      {
        ...createSlider(
          "Ring count",
          1,
          6,
          1,
          () => look().rings,
          (value: number) => {
            look().rings = value;
            restyled();
          },
        ),
        shown: () => archetype().bomb !== "spark",
      },
      createColors(
        "Screen tint",
        tintColors,
        () => look().tint,
        (value: string) => {
          look().tint = value;
          restyled();
        },
      ),
      createSlider(
        "Tint strength",
        0,
        0.8,
        0.05,
        () => look().tintAlpha,
        (value: number) => {
          look().tintAlpha = value;
          restyled();
        },
      ),
    ]),
  ];

  function place(view: Container, shown: boolean, y: number): void {
    if (shown) {
      if (!laidOut || !view.visible) {
        view.y = y;
      }

      if (!laidOut) {
        view.alpha = 1;
      }

      view.visible = true;
      rowTargets.set(view, y);
    } else {
      rowTargets.delete(view);

      if (!laidOut) {
        view.visible = false;
      }
    }
  }

  function refresh(): void {
    let y: number = 0;

    for (const control of controls) {
      const shown: boolean = control.shown?.() ?? true;

      control.view.eventMode = shown
        ? control.header === true
          ? "static"
          : "passive"
        : "none";
      place(control.view, shown, y);

      if (shown) {
        control.refresh();
        y += control.header === true ? headerHeight : rowHeight;
      }
    }

    place(reset.view, true, y + rowHeight / 2 - chipHeight / 2);
    reset.paint();
    contentHeight = y + rowHeight;
    laidOut = true;
  }

  function maxScroll(): number {
    return Math.max(contentHeight - viewHeight, 0);
  }

  function animate(delta: number): void {
    const blend: number = 1 - Math.exp(-delta / rowSmoothing);

    for (const view of [
      ...controls.map((control: Control) => control.view),
      reset.view,
    ]) {
      const target: number | undefined = rowTargets.get(view);

      if (target !== undefined) {
        view.y += (target - view.y) * blend;
        view.alpha = approach(view.alpha, 1, delta / rowFade);
      } else if (view.visible) {
        view.alpha = approach(view.alpha, 0, delta / rowFade);
        view.visible = view.alpha > 0;
      }
    }

    scrollTarget = Math.min(scrollTarget, maxScroll());
    smoothDamp(scroll, scrollTarget, scrollSmoothing, delta);
    content.y = -scroll.value;
    scrollBar.clear();

    if (maxScroll() <= 0) {
      return;
    }

    const length: number = Math.max(
      (viewHeight / contentHeight) * viewHeight,
      scrollBarMinimum,
    );
    const offset: number = (scroll.value / maxScroll()) * (viewHeight - length);

    scrollBar
      .rect(rowWidth + scrollBarGap, 0, scrollBarWidth, viewHeight)
      .fill({ color: getTheme().menuSelected, alpha: 0.6 })
      .rect(rowWidth + scrollBarGap, offset, scrollBarWidth, length)
      .fill(getTheme().highlight);
  }

  function sharpen(target: Container, resolution: number): void {
    if (target instanceof Text && target.resolution !== resolution) {
      target.resolution = resolution;
    }

    for (const child of target.children) {
      sharpen(child, resolution);
    }
  }

  function layout(x: number, y: number, width: number, height: number): void {
    const panelScale: number = Math.min(
      app.screen.width / hudWidth,
      app.screen.height / hudHeight,
    );
    const panelPixels: number = rowWidth * panelScale;
    const fieldScale: number = Math.min(
      height / fieldHeight,
      (width - panelPixels - panelGap) / fieldWidth,
    );
    const fieldPixels: number = fieldWidth * fieldScale;
    const total: number = fieldPixels + panelGap + panelPixels;
    const left: number = x + (width - total) / 2;

    viewHeight = height / panelScale;
    field.scale.set(fieldScale);
    field.position.set(Math.round(left), Math.round(y));
    panel.scale.set(panelScale);
    panel.position.set(
      Math.round(left + fieldPixels + panelGap),
      Math.round(y),
    );
    panelMask.clear().rect(0, 0, rowWidth, viewHeight).fill(0xffffff);
    panel.hitArea = new Rectangle(0, 0, rowWidth, viewHeight);
    hint.scale.set(fieldScale);
    hint.position.set(
      Math.round(left + fieldPixels / 2),
      Math.round(y + fieldHeight * fieldScale + hintGap * fieldScale),
    );
    sharpen(panel, panelScale * (window.devicePixelRatio || 1));
    sharpen(hint, fieldScale * (window.devicePixelRatio || 1));
  }

  function pressed(keys: Array<string>): boolean {
    return keys.some((key: string) => held.has(key));
  }

  function update(delta: number): void {
    const focused: boolean = pressed(focusKeys);
    const speed: number = focused ? archetype().focusSpeed : archetype().speed;
    let moveX: number =
      (pressed(rightKeys) ? 1 : 0) - (pressed(leftKeys) ? 1 : 0);
    let moveY: number = (pressed(downKeys) ? 1 : 0) - (pressed(upKeys) ? 1 : 0);

    if (moveX !== 0 && moveY !== 0) {
      moveX *= Math.SQRT1_2;
      moveY *= Math.SQRT1_2;
    }

    player.position.set(
      Math.min(
        Math.max(player.x + moveX * speed * delta, playerSize / 2),
        fieldWidth - playerSize / 2,
      ),
      Math.min(
        Math.max(player.y + moveY * speed * delta, playerSize / 2),
        fieldHeight - playerSize / 2,
      ),
    );
    hitbox.position.copyFrom(player.position);
    hitbox.visible = focused;
    squad.update(delta, player.x, player.y, focused, pressed(shotKeys));

    if (pressed(bombKeys) && !bombHeld) {
      bomb.trigger(player.x, player.y);
    }

    bombHeld = pressed(bombKeys);
    bomb.update(delta, player.x, player.y);
  }

  function setActive(value: boolean): void {
    active = value;
    held.clear();

    if (value) {
      refresh();
    }
  }

  back.rect(0, 0, fieldWidth, fieldHeight).fill(fieldColor);
  mask.rect(0, 0, fieldWidth, fieldHeight).fill(0xffffff);
  bombMask.rect(0, 0, fieldWidth, fieldHeight).fill(0xffffff);
  frame
    .rect(0, 0, fieldWidth, fieldHeight)
    .stroke({ color: frameColor, width: frameWidth, alignment: 0 });
  player.anchor.set(0.5);
  player.width = playerSize;
  player.height = playerSize;
  player.position.set(fieldWidth / 2, fieldHeight * playerStartY);
  hitbox
    .circle(0, 0, hitboxRadius)
    .fill(hitboxColor)
    .stroke({ color: "#ffffff", width: 1 });
  hitbox.visible = false;
  field.addChild(
    back,
    squad.shotLayer,
    player,
    squad.view,
    bomb.view,
    hitbox,
    mask,
    bombMask,
    frame,
  );
  squad.shotLayer.mask = mask;
  bomb.view.mask = bombMask;
  bomb.setStock(Infinity);
  hint.anchor.set(0.5, 0);
  reset.view.x = rowWidth - resetWidth;
  summary.anchor.set(0.5);
  summary.position.set(rowWidth / 2, rowHeight / 2);
  summaryRow.addChild(summary);
  content.addChild(
    ...controls.map((control: Control) => control.view),
    reset.view,
  );
  panel.addChild(content, panelMask, scrollBar);
  content.mask = panelMask;
  panel.eventMode = "static";
  panel.on("wheel", (event: FederatedWheelEvent) => {
    scrollTarget = Math.min(
      Math.max(scrollTarget + event.deltaY / panel.scale.y, 0),
      maxScroll(),
    );
  });
  view.addChild(field, panel, hint);
  refresh();

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    const code: string = event.code;

    if (
      !active ||
      event.ctrlKey ||
      event.metaKey ||
      ![
        ...leftKeys,
        ...rightKeys,
        ...upKeys,
        ...downKeys,
        ...focusKeys,
        ...shotKeys,
        ...bombKeys,
      ].includes(code)
    ) {
      return;
    }

    held.add(code);
    event.preventDefault();
  });

  window.addEventListener("keyup", (event: KeyboardEvent) => {
    held.delete(event.code);
  });

  window.addEventListener("blur", () => {
    held.clear();
  });

  app.ticker.add((ticker: Ticker) => {
    if (view.visible) {
      animate(Math.min(ticker.deltaMS / 1000, maxDelta));
    }

    if (active) {
      update(Math.min(ticker.deltaMS / 1000, maxDelta));
    }
  });

  return { view: view, layout: layout, setActive: setActive };
}

export { createPower };
export type { Power };
