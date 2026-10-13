import {
  Container,
  Graphics,
  Sprite,
  Text,
  type Application,
  type Texture,
  type Ticker,
} from "pixi.js";
import {
  createChip,
  createChoice,
  createColors,
  createText,
  createSlider,
  rowHeight,
  rowWidth,
  chipHeight,
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
import { createBomb, type Bomb } from "../game/bomb";

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
  let active: boolean = false;
  let bombHeld: boolean = false;

  function changed(): void {
    saveDrones();
    refresh();
  }

  const reset: Chip = createChip("reset", resetWidth, () => {
    resetDrones();
    refresh();
  });

  const summary: Text = createText(summarySize, hintColor);
  const summaryRow: Container = new Container();

  const controls: Array<Control> = [
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
  ];

  function refresh(): void {
    let y: number = 0;

    for (const control of controls) {
      const shown: boolean = control.shown?.() ?? true;

      control.view.visible = shown;

      if (shown) {
        control.view.y = y;
        control.refresh();
        y += rowHeight;
      }
    }

    reset.view.y = y + rowHeight / 2 - chipHeight / 2;
    reset.paint();
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
    const fieldScale: number = Math.min(
      height / fieldHeight,
      (width * 0.55) / fieldWidth,
    );
    const panelHeight: number = (controls.length + 1) * rowHeight;
    const fieldPixels: number = fieldWidth * fieldScale;
    const panelScale: number = Math.min(
      height / panelHeight,
      (width - fieldPixels - panelGap) / rowWidth,
    );
    const total: number = fieldPixels + panelGap + rowWidth * panelScale;
    const left: number = x + (width - total) / 2;

    field.scale.set(fieldScale);
    field.position.set(Math.round(left), Math.round(y));
    panel.scale.set(panelScale);
    panel.position.set(
      Math.round(left + fieldPixels + panelGap),
      Math.round(y),
    );
    hint.scale.set(fieldScale);
    sharpen(panel, panelScale * (window.devicePixelRatio || 1));
    sharpen(hint, fieldScale * (window.devicePixelRatio || 1));
    hint.position.set(
      Math.round(left + fieldPixels / 2),
      Math.round(y + fieldHeight * fieldScale + hintGap * fieldScale),
    );
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
  panel.addChild(
    ...controls.map((control: Control) => control.view),
    reset.view,
  );
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
    if (active) {
      update(Math.min(ticker.deltaMS / 1000, maxDelta));
    }
  });

  return { view: view, layout: layout, setActive: setActive };
}

export { createPower };
export type { Power };
