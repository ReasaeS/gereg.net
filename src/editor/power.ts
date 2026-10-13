import {
  Container,
  Graphics,
  Text,
  type Application,
  type Texture,
  type Ticker,
} from "pixi.js";
import {
  createChip,
  createChoice,
  createColors,
  createSlider,
  rowHeight,
  rowWidth,
  chipHeight,
  type Chip,
  type Control,
  type Option,
} from "../ui/widgets";
import { createRows, createSection, type Rows } from "../ui/rows";
import { createGlide, type Glide } from "../ui/motion";
import { createText, screenResolution, sharpen } from "../ui/text";
import {
  droneSettings,
  maxPower,
  minPower,
  resetDrones,
  saveDrones,
} from "../game/drones";
import {
  bombKeys,
  createKeyboard,
  focusKeys,
  shotKeys,
  steering,
  type Keyboard,
} from "../game/input";
import {
  archetype,
  archetypes,
  setArchetype,
  type Archetype,
  type ArchetypeId,
} from "../game/archetype";
import { fieldHeight, fieldWidth, hudScale } from "../game/field";
import { createPilot, type Pilot } from "../game/pilot";
import { frameDelta } from "../effects/tween/tween";
import { bombLook, resetLooks, saveLooks, type Look } from "../game/bomb";

type Power = {
  view: Container;
  layout: (x: number, y: number, width: number, height: number) => void;
  setActive: (active: boolean) => void;
};

const fieldColor: string = "#01040f";
const frameColor: string = "#ffffff";
const frameWidth: number = 1.5; // units
const playerStartY: number = 0.8; // of field height
const panelGap: number = 30; // px
const summarySize: number = 10; // units
const hintSize: number = 11; // units
const hintGap: number = 8; // units
const hintColor: string = "#9fd8ff";
const resetWidth: number = 60; // units
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
  const frame: Graphics = new Graphics();
  const pilot: Pilot = createPilot(
    playerTexture,
    droneTexture,
    fieldWidth,
    fieldHeight,
  );
  const rows: Rows = createRows();
  const hint: Text = createText(hintSize, hintColor);
  const opened: Set<string> = new Set();
  let power: number = maxPower;
  let active: boolean = false;
  let laidOut: boolean = false;
  const keyboard: Keyboard = createKeyboard(() => active);

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
  const resetRow: Container = new Container();

  function section(name: string, list: Array<Control>): Array<Control> {
    return createSection(
      name,
      list,
      () => opened.has(name),
      () => {
        if (!opened.delete(name)) {
          opened.add(name);
        }

        refresh();
      },
    );
  }

  const summary: Text = createText(summarySize, hintColor);
  const summaryRow: Container = new Container();
  const summaryFade: Glide = createGlide(1, (alpha: number) => {
    summary.alpha = alpha;
  });

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
          const text: string = archetype().summary.toUpperCase();

          if (summary.text !== text) {
            summary.text = text;
            summaryFade.snap(0);
            summaryFade.set(1);
          }
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
          pilot.squad.setPower(value);
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
    {
      view: resetRow,
      refresh: () => reset.paint(),
    },
  ];

  function refresh(): void {
    rows.place(controls, !laidOut);
    laidOut = true;
  }

  function layout(x: number, y: number, width: number, height: number): void {
    const panelScale: number = hudScale(app.screen.width, app.screen.height);
    const panelPixels: number = rowWidth * panelScale;
    const fieldScale: number = Math.min(
      height / fieldHeight,
      (width - panelPixels - panelGap) / fieldWidth,
    );
    const fieldPixels: number = fieldWidth * fieldScale;
    const total: number = fieldPixels + panelGap + panelPixels;
    const left: number = x + (width - total) / 2;

    field.scale.set(fieldScale);
    field.position.set(Math.round(left), Math.round(y));
    rows.view.scale.set(panelScale);
    rows.view.position.set(
      Math.round(left + fieldPixels + panelGap),
      Math.round(y),
    );
    rows.setViewport(height / panelScale);
    hint.scale.set(fieldScale);
    hint.position.set(
      Math.round(left + fieldPixels / 2),
      Math.round(y + fieldHeight * fieldScale + hintGap * fieldScale),
    );
    sharpen(rows.view, screenResolution(panelScale));
    sharpen(hint, screenResolution(fieldScale));
  }

  function update(delta: number): void {
    pilot.update(
      delta,
      steering(keyboard.pressed),
      keyboard.pressed(focusKeys),
      keyboard.pressed(shotKeys),
      keyboard.pressed(bombKeys),
    );
  }

  function setActive(value: boolean): void {
    active = value;
    keyboard.clear();

    if (value) {
      refresh();
    }
  }

  back.rect(0, 0, fieldWidth, fieldHeight).fill(fieldColor);
  mask.rect(0, 0, fieldWidth, fieldHeight).fill(0xffffff);
  frame
    .rect(0, 0, fieldWidth, fieldHeight)
    .stroke({ color: frameColor, width: frameWidth, alignment: 0 });
  pilot.reset(fieldWidth / 2, fieldHeight * playerStartY);
  pilot.bomb.setStock(Infinity);
  field.addChild(back, ...pilot.layers(), mask, frame);
  field.mask = mask;
  hint.text = "ARROWS  MOVE   ·   SHIFT  FOCUS   ·   Z  SHOOT   ·   X  BOMB";
  hint.anchor.set(0.5, 0);
  reset.view.position.set(
    rowWidth - resetWidth,
    rowHeight / 2 - chipHeight / 2,
  );
  resetRow.addChild(reset.view);
  summary.anchor.set(0.5);
  summary.position.set(rowWidth / 2, rowHeight / 2);
  summaryRow.addChild(summary);
  rows.content.addChild(...controls.map((control: Control) => control.view));
  view.addChild(field, rows.view, hint);
  refresh();

  app.ticker.add((ticker: Ticker) => {
    if (view.visible) {
      rows.animate(frameDelta(ticker));
    }

    if (active) {
      update(frameDelta(ticker));
    }
  });

  return { view: view, layout: layout, setActive: setActive };
}

export { createPower };
export type { Power };
