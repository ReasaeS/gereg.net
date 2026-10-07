import {
  Container,
  Graphics,
  Point,
  Rectangle,
  Sprite,
  Text,
  type Texture,
  type Bounds,
  type FederatedPointerEvent,
  type FederatedWheelEvent,
  type Application,
  type Ticker,
} from "pixi.js";
import { playerTexture } from "../editor/editor";
import {
  drawFrame,
  fieldHeight,
  fieldWidth,
  fieldX,
  fieldY,
  hudHeight,
  hudWidth,
} from "../game/hud";
import type { PageContent } from "../menu/page";
import { getTheme } from "../theme/theme";
import {
  approach,
  cubicBezier,
  smoothDamp,
  type Spring,
  tween,
  type Easing,
} from "../effects/tween/tween";
import {
  derivativeNames,
  createId,
  defaultBackground,
  defaultRing,
  defaultSpell,
  defaultEnemy,
  defaultPattern,
  defaultKeyframe,
  defaultStage,
  loadCreations,
  saveCreations,
  usedSprites,
  type Background,
  type Creations,
  type Enemy,
  type Vector,
  type Pattern,
  type Keyframe,
  type Ring,
  type Spawn,
  type Spell,
  type Stage,
} from "./data";
import {
  createPreview,
  drawShape,
  motion,
  previewHeight,
  previewWidth,
  type Preview,
} from "./preview";
import {
  chipHeight,
  createChip,
  createChoice,
  createColors,
  createSlider,
  drawField,
  createHeader,
  headerHeight,
  createVector,
  createSpriteRow,
  createText,
  rowHeight,
  rowWidth,
  type Chip,
  type Control,
  type Option,
} from "./widgets";
import { getTexture, loadTexture, removeUnused, storeImage } from "./images";
import { createGallery, type Action, type Gallery, type Kind } from "./gallery";

type Item = {
  id: string;
  name: string;
  sprite?: string | null;
};

type Tab = {
  name: string;
  items: () => Array<Item>;
  selected: number;
  panel: Container;
  controls: Array<Control>;
  show: () => void;
};

const sectionGap: number = 6; // units
const frameColor: string = "#ffffff";
const panelLeft: number = 430; // units
const panelTop: number = 12; // units
const panelBottom: number = 470; // units
const panelColor: string = "#01040f";
const panelAlpha: number = 0.55;
const panelPadding: number = 6; // units
const actionGap: number = 6; // units
const actionWidth: number = (rowWidth - actionGap) / 2; // units
const headingSize: number = 16; // units
const headingHeight: number = 22; // units
const maxDelta: number = 0.05; // s
const nameLength: number = 24;
const dropColor: string = "#01040f";
const dropAlpha: number = 0.75;
const dropBorder: number = 6; // px
const dropInset: number = 24; // px
const dropSize: number = 56; // px
const timelineColor: string = "#061a52";
const markerColor: string = "#9fd8ff";
const timelineGap: number = 6; // units
const timelineHeight: number = 10; // units
const columnCenter: number = fieldX / 2; // units
const clockGap: number = 8; // units
const patternGap: number = 6; // units
const clockWidth: number = 46; // units
const fieldPadding: number = 4; // units
const typingLength: number = 7;
const caretBlink: number = 1; // s
const markerWidth: number = 1.5; // units
const playheadWidth: number = 1; // units
const clockSize: number = 8; // units
const keyframeSize: number = 4; // units
const markerAlpha: number = 0.75;
const markerPadding: number = 6; // units
const guideAlpha: number = 0.35;
const rowSmoothing: number = 0.06; // s
const scrollSmoothing: number = 0.08; // s
const scrollBarWidth: number = 2; // units
const scrollBarGap: number = 3; // units
const scrollBarMinimum: number = 12; // units
const headerSlant: number = 4; // units
const rowFade: number = 0.15; // s
const trailTime: number = 4; // s
const trailSteps: number = 48;
const positionMin: number = -0.2;
const positionMax: number = 1.2;
const derivativeLimit: number = 400; // units/s^n
const derivativeStep: number = 5; // units/s^n
const angleLimit: number = 360; // deg/s^n
const speedLimit: number = 400; // units/s^(n+1)
const ringMin: number = 10; // units
const ringMax: number = 220; // units
const ringShrink: number = 40; // units
const spinLimit: number = 180; // deg/s
const speedNames: Array<string> = derivativeNames.slice(1);
const transportWidth: number = 24; // units
const iconSize: number = 3.5; // units
const swapOutDuration: number = 200; // ms
const swapInDuration: number = 380; // ms
const swapLead: number = 100; // ms
const swapDistance: number = 80; // px
const swapEasing: Easing = cubicBezier(0.34, 1.56, 0.64, 1);
const dropFade: number = 0.15; // s
const brightColors: Array<string> = [
  "#ffffff",
  "#ff3b3b",
  "#ff8a80",
  "#ffb347",
  "#fff27a",
  "#7ae38f",
  "#2fa84f",
  "#7ad8ff",
  "#3b82ff",
  "#b48aff",
  "#ff6fd8",
  "#1d1d2b",
];
const skyColors: Array<string> = [
  "#000000",
  "#01030a",
  "#031448",
  "#0b3f9e",
  "#1a5fc4",
  "#8fd0ff",
  "#1e0a2e",
  "#4a1a5c",
  "#5c1a1a",
  "#a32a2a",
  "#1e5c2a",
  "#e6c229",
];
const aimOptions: Array<Option<boolean>> = [
  { value: false, label: "Fixed angle" },
  { value: true, label: "At player" },
];

async function createMaker(app: Application): Promise<PageContent> {
  const view: Container = new Container();
  const controls: Container = new Container();
  const scrollArea: Container = new Container();
  const scrollContent: Container = new Container();
  const scrollMask: Graphics = new Graphics();
  const scrollBar: Graphics = new Graphics();
  const scroll: Spring = { value: 0, velocity: 0 };
  let scrollTarget: number = 0;
  let contentHeight: number = 0;
  let viewportHeight: number = 1;
  const itemBar: Container = new Container();
  const board: Container = new Container();
  const gameFrame: Container = new Container();
  const backdrop: Graphics = new Graphics();
  const panelBack: Graphics = new Graphics();
  const frameMask: Graphics = new Graphics();
  let frameScale: number = 1;
  const preview: Preview = await createPreview(playerTexture());
  const creations: Creations = loadCreations();
  const tabs: Array<Tab> = new Array();
  const timeline: Container = new Container();
  const track: Graphics = new Graphics();
  const clock: Text = createText(clockSize, "#ffffff");
  const total: Text = createText(clockSize, "#ffffff");
  let tab: Tab;
  let active: boolean = false;
  let spawnIndex: number = 0;
  let keyIndex: number = 0;
  let ringIndex: number = 0;

  function selection(name: string): number {
    return tabs.find((value: Tab) => value.name === name)?.selected ?? 0;
  }

  function stage(): Stage {
    return creations.stages[selection("stage")]!;
  }

  function pattern(): Pattern {
    return creations.patterns[selection("pattern")]!;
  }

  function enemy(): Enemy {
    return creations.enemies[selection("enemy")]!;
  }

  function background(): Background {
    return creations.backgrounds[selection("background")]!;
  }

  function spell(): Spell {
    return creations.spells[selection("spell")]!;
  }

  function ring(): Ring {
    ringIndex = Math.min(ringIndex, spell().rings.length - 1);

    return spell().rings[ringIndex]!;
  }

  function keyframe(): Keyframe {
    keyIndex = Math.min(keyIndex, stage().keyframes.length - 1);

    return stage().keyframes[keyIndex]!;
  }

  function spawn(): Spawn {
    spawnIndex = Math.min(spawnIndex, keyframe().spawns.length - 1);

    return keyframe().spawns[spawnIndex]!;
  }

  function patternById(id: string | null): Pattern | null {
    return creations.patterns.find((value: Pattern) => value.id === id) ?? null;
  }

  function enemyById(id: string | null): Enemy | null {
    return creations.enemies.find((value: Enemy) => value.id === id) ?? null;
  }

  function backgroundById(id: string | null): Background | null {
    return (
      creations.backgrounds.find((value: Background) => value.id === id) ?? null
    );
  }

  function spellById(id: string | null): Spell | null {
    return creations.spells.find((value: Spell) => value.id === id) ?? null;
  }

  function resolve(value: Spawn): [Enemy, Pattern | null, Spell | null] | null {
    const found: Enemy | null = enemyById(value.enemy);

    return found === null
      ? null
      : [found, patternById(found.pattern), spellById(found.spell)];
  }

  function changed(): void {
    saveCreations(creations);

    if (tab.name !== "stage") {
      preview.clear();
      tab.show();
      return;
    }

    const now: number = preview.stageTime();
    const previous: number = Math.max(
      0,
      ...stage()
        .keyframes.map((value: Keyframe) => value.time)
        .filter((value: number) => value <= now),
    );

    tab.show();
    preview.seek(previous);
  }

  function current(): Item {
    return tab.items()[tab.selected]!;
  }

  function cleanup(): void {
    removeUnused(usedSprites(creations));
  }

  async function useImage(file: File | undefined): Promise<void> {
    if (file === undefined || !file.type.startsWith("image/")) {
      return;
    }

    const item: Item = current();

    if (item.sprite === undefined) {
      return;
    }

    try {
      const id: string = await storeImage(file);
      await loadTexture(id);
      item.sprite = id;
      preview.clear();
      changed();
      refresh();
      cleanup();
    } catch {
      console.warn("Could not use the image " + file.name);
    }
  }

  function spriteRow(): Control {
    return createSpriteRow(
      "Sprite",
      () => getTexture(current().sprite ?? null),
      () => picker.click(),
      () => {
        current().sprite = null;
        preview.clear();
        changed();
        refresh();
        cleanup();
      },
    );
  }

  const picker: HTMLInputElement = document.createElement("input");

  picker.type = "file";
  picker.accept = "image/*";
  picker.addEventListener("change", () => {
    useImage(picker.files?.[0]);
    picker.value = "";
  });

  function slider(
    name: string,
    min: number,
    max: number | (() => number),
    step: number,
    get: () => number,
    set: (value: number) => void,
  ): Control {
    return createSlider(name, min, max, step, get, (value: number) => {
      set(value);
      changed();
    });
  }

  function choice<T>(
    name: string,
    options: () => Array<Option<T>>,
    get: () => T,
    set: (value: T) => void,
  ): Control {
    return createChoice(name, options, get, (value: T) => {
      set(value);
      changed();
    });
  }

  function colors(
    name: string,
    list: Array<string>,
    get: () => string,
    set: (value: string) => void,
  ): Control {
    return createColors(name, list, get, (value: string) => {
      set(value);
      changed();
    });
  }

  function addTab(
    name: string,
    items: () => Array<Item>,
    list: Array<Control>,
    show: () => void,
  ): void {
    const panel: Container = new Container();

    for (let index = 0; index < list.length; index++) {
      list[index]!.view.y = index * rowHeight;
      panel.addChild(list[index]!.view);
    }

    panel.y = 0;
    panel.visible = false;
    scrollContent.addChild(panel);
    tabs.push({
      name: name,
      items: items,
      selected: 0,
      panel: panel,
      controls: list,
      show: show,
    });
  }

  const sectionOpen: Map<number, boolean> = new Map();
  let sections: number = 0;

  function section(name: string, list: Array<Control>): Array<Control> {
    const key: number = sections++;
    const open: () => boolean = () => sectionOpen.get(key) ?? false;
    const header: Control = createHeader(name, open, () => {
      sectionOpen.set(key, !open());
      refresh();
    });

    return [
      header,
      ...list.map((control: Control) => {
        const shown: (() => boolean) | undefined = control.shown;

        return {
          ...control,
          shown: () => open() && (shown?.() ?? true),
        };
      }),
    ];
  }

  addTab(
    "pattern",
    () => creations.patterns,
    [
      ...section("Look", [
        spriteRow(),
        slider(
          "Size",
          4,
          64,
          1,
          () => pattern().size,
          (value: number) => {
            pattern().size = value;
          },
        ),
        colors(
          "Colour",
          brightColors,
          () => pattern().color,
          (value: string) => {
            pattern().color = value;
          },
        ),
      ]),
      ...section("Spread", [
        slider(
          "Count",
          1,
          36,
          1,
          () => pattern().count,
          (value: number) => {
            pattern().count = value;
          },
        ),
        slider(
          "Spread",
          0,
          360,
          5,
          () => pattern().spread,
          (value: number) => {
            pattern().spread = value;
          },
        ),
      ]),
      ...section("Aim", [
        choice(
          "Aim",
          () => aimOptions,
          () => pattern().aim,
          (value: boolean) => {
            pattern().aim = value;
          },
        ),
        slider(
          "Angle",
          -180,
          180,
          5,
          () => pattern().heading,
          (value: number) => {
            pattern().heading = value;
          },
        ),
        ...derivativeNames.map((name: string, order: number) => ({
          ...slider(
            name,
            -angleLimit,
            angleLimit,
            5,
            () => pattern().angleDerivatives[order] ?? 0,
            (value: number) => {
              pattern().angleDerivatives[order] = value;
            },
          ),
          shown: () => pattern().angleDerivatives.length > order,
        })),
        derivativeActions(
          () => pattern().angleDerivatives,
          derivativeNames,
          () => 0,
        ),
      ]),
      ...section("Fire", [
        slider(
          "Rate",
          0.5,
          20,
          0.5,
          () => pattern().rate,
          (value: number) => {
            pattern().rate = value;
          },
        ),
        slider(
          "Speed",
          20,
          400,
          5,
          () => pattern().speed,
          (value: number) => {
            pattern().speed = value;
          },
        ),
        ...speedNames.map((name: string, order: number) => ({
          ...slider(
            name,
            -speedLimit,
            speedLimit,
            5,
            () => pattern().speedDerivatives[order] ?? 0,
            (value: number) => {
              pattern().speedDerivatives[order] = value;
            },
          ),
          shown: () => pattern().speedDerivatives.length > order,
        })),
        derivativeActions(
          () => pattern().speedDerivatives,
          speedNames,
          () => 0,
        ),
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setPattern(pattern());
    },
  );

  addTab(
    "enemy",
    () => creations.enemies,
    [
      ...section("Look", [
        spriteRow(),
        colors(
          "Colour",
          brightColors,
          () => enemy().color,
          (value: string) => {
            enemy().color = value;
          },
        ),
        slider(
          "Size",
          12,
          64,
          1,
          () => enemy().size,
          (value: number) => {
            enemy().size = value;
          },
        ),
      ]),
      ...section("Combat", [
        slider(
          "Health",
          1,
          200,
          1,
          () => enemy().health,
          (value: number) => {
            enemy().health = value;
          },
        ),
        choice(
          "Pattern",
          () => [
            { value: null, label: "None" },
            ...creations.patterns.map((value: Pattern) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => enemy().pattern,
          (value: string | null) => {
            enemy().pattern = value;
          },
        ),
        choice(
          "Spell",
          () => [
            { value: null, label: "None" },
            ...creations.spells.map((value: Spell) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => enemy().spell,
          (value: string | null) => {
            enemy().spell = value;
          },
        ),
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setEnemy(
        enemy(),
        patternById(enemy().pattern),
        spellById(enemy().spell),
      );
    },
  );

  addTab(
    "background",
    () => creations.backgrounds,
    [
      ...section("Look", [
        spriteRow(),
        colors(
          "Top",
          skyColors,
          () => background().top,
          (value: string) => {
            background().top = value;
          },
        ),
        colors(
          "Bottom",
          skyColors,
          () => background().bottom,
          (value: string) => {
            background().bottom = value;
          },
        ),
      ]),
      ...section("Motion", [
        slider(
          "Scroll",
          0,
          400,
          5,
          () => background().scroll,
          (value: number) => {
            background().scroll = value;
          },
        ),
      ]),
    ],
    () => {
      preview.setBackground(background());
      preview.setPlayerVisible(false);
      preview.setPattern(null);
    },
  );

  function actionRow(
    first: string,
    firstAction: () => void,
    second: string,
    secondAction: () => void,
  ): Control {
    const row: Container = new Container();
    const left: Chip = createChip(first, actionWidth, firstAction);
    const right: Chip = createChip(second, actionWidth, secondAction);

    left.view.y = (rowHeight - chipHeight) / 2;
    right.view.position.set(actionWidth + actionGap, left.view.y);
    row.addChild(left.view, right.view);

    return { view: row, refresh: () => undefined };
  }

  function vector(
    name: string,
    min: number,
    max: number,
    step: number,
    get: () => Vector,
    set: (value: Vector) => void,
  ): Control {
    return createVector(name, min, max, step, get, (value: Vector) => {
      set(value);
      changed();
    });
  }

  function derivativeActions<T>(
    list: () => Array<T>,
    names: Array<string>,
    blank: () => T,
  ): Control {
    const row: Container = new Container();
    const width: number = actionWidth;
    const add: Chip = createChip("", width, () => {
      if (list().length >= names.length) {
        return;
      }

      list().push(blank());
      changed();
      refresh();
    });
    const remove: Chip = createChip("", width, () => {
      list().pop();
      changed();
      refresh();
    });

    add.view.y = (rowHeight - chipHeight) / 2;
    remove.view.position.set(width + actionGap, add.view.y);
    row.addChild(add.view, remove.view);

    return {
      view: row,
      refresh: () => {
        const count: number = list().length;

        add.view.visible = count < names.length;
        remove.view.visible = count > 0;
        add.label.text = "ADD " + (names[count] ?? "").toUpperCase();
        remove.label.text = "REMOVE " + (names[count - 1] ?? "").toUpperCase();
        remove.view.x = add.view.visible ? width + actionGap : 0;
      },
    };
  }

  function selectKeyframe(index: number): void {
    keyIndex = index;
    spawnIndex = 0;
    pause();
    preview.seek(keyframe().time);
    refresh();
  }

  function keyframeLabel(value: Keyframe): string {
    return (
      value.time.toFixed(1) +
      "s  ·  " +
      value.spawns.length +
      (value.spawns.length === 1 ? " enemy" : " enemies")
    );
  }

  function selectRing(index: number): void {
    ringIndex = index;
    refresh();
  }

  addTab(
    "spell",
    () => creations.spells,
    [
      ...section("Look", [
        colors(
          "Colour",
          brightColors,
          () => spell().color,
          (value: string) => {
            spell().color = value;
          },
        ),
        slider(
          "Opacity",
          0.1,
          1,
          0.05,
          () => spell().opacity,
          (value: number) => {
            spell().opacity = value;
          },
        ),
      ]),
      ...section("Rings", [
        actionRow(
          "Add ring",
          () => {
            const source: Ring | undefined = spell().rings[ringIndex];

            spell().rings.push(
              source === undefined
                ? defaultRing()
                : {
                    ...source,
                    radius: Math.max(source.radius - ringShrink, ringMin),
                    spin: -source.spin,
                  },
            );
            changed();
            selectRing(spell().rings.length - 1);
          },
          "Remove ring",
          () => {
            if (spell().rings.length <= 1) {
              return;
            }

            spell().rings.splice(ringIndex, 1);
            changed();
            selectRing(Math.max(ringIndex - 1, 0));
          },
        ),
        choice(
          "Ring",
          () =>
            spell().rings.map((value: Ring, index: number) => ({
              value: index,
              label: "Ring " + (index + 1) + "  ·  " + value.radius,
            })),
          () => ringIndex,
          (value: number) => selectRing(value),
        ),
      ]),
      ...section("Shape", [
        slider(
          "Radius",
          ringMin,
          ringMax,
          5,
          () => ring().radius,
          (value: number) => {
            ring().radius = value;
          },
        ),
        slider(
          "Points",
          0,
          12,
          1,
          () => ring().points,
          (value: number) => {
            ring().points = value;
          },
        ),
        slider(
          "Step",
          1,
          5,
          1,
          () => ring().step,
          (value: number) => {
            ring().step = value;
          },
        ),
        slider(
          "Ticks",
          0,
          72,
          2,
          () => ring().ticks,
          (value: number) => {
            ring().ticks = value;
          },
        ),
        slider(
          "Orbs",
          0,
          0.2,
          0.01,
          () => ring().orb,
          (value: number) => {
            ring().orb = value;
          },
        ),
      ]),
      ...section("Motion", [
        slider(
          "Spin",
          -spinLimit,
          spinLimit,
          5,
          () => ring().spin,
          (value: number) => {
            ring().spin = value;
          },
        ),
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setSpell(spell());
    },
  );

  addTab(
    "stage",
    () => creations.stages,
    [
      ...section("Stage", [
        choice(
          "Background",
          () => [
            { value: null, label: "None" },
            ...creations.backgrounds.map((value: Background) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => stage().background,
          (value: string | null) => {
            stage().background = value;
          },
        ),
        slider(
          "Length",
          5,
          300,
          5,
          () => stage().length,
          (value: number) => {
            stage().length = value;
          },
        ),
      ]),
      ...section("Keyframes", [
        actionRow(
          "Add frame",
          () => {
            const time: number =
              Math.round(Math.min(preview.stageTime(), stage().length) * 2) / 2;

            stage().keyframes.push(
              defaultKeyframe(time, [{ ...spawn(), id: createId() }]),
            );
            saveCreations(creations);
            selectKeyframe(stage().keyframes.length - 1);
          },
          "Remove frame",
          () => {
            if (stage().keyframes.length <= 1) {
              return;
            }

            stage().keyframes.splice(keyIndex, 1);
            saveCreations(creations);
            selectKeyframe(Math.max(keyIndex - 1, 0));
          },
        ),
        choice(
          "Keyframe",
          () =>
            stage()
              .keyframes.map((value: Keyframe, index: number) => ({
                value: index,
                label: keyframeLabel(value),
                time: value.time,
              }))
              .sort((first, second) => first.time - second.time),
          () => keyIndex,
          (value: number) => selectKeyframe(value),
        ),
        slider(
          "Time",
          0,
          () => stage().length,
          0.5,
          () => keyframe().time,
          (value: number) => {
            keyframe().time = value;
            preview.seek(value);
          },
        ),
      ]),
      ...section("Enemy", [
        actionRow(
          "Add enemy",
          () => {
            const source: Spawn = spawn();

            keyframe().spawns.push({
              ...source,
              id: createId(),
              x: Math.min(source.x + 0.15, 0.95),
            });
            spawnIndex = keyframe().spawns.length - 1;
            changed();
            refresh();
          },
          "Remove enemy",
          () => {
            if (keyframe().spawns.length <= 1) {
              return;
            }

            keyframe().spawns.splice(spawnIndex, 1);
            spawnIndex = Math.max(spawnIndex - 1, 0);
            changed();
            refresh();
          },
        ),
        choice(
          "Enemy",
          () => [
            { value: null, label: "None" },
            ...creations.enemies.map((value: Enemy) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => spawn().enemy,
          (value: string | null) => {
            spawn().enemy = value;
            buildMarkers();
          },
        ),
        slider(
          "Count",
          1,
          20,
          1,
          () => spawn().count,
          (value: number) => {
            spawn().count = value;
          },
        ),
        slider(
          "Gap",
          0.1,
          5,
          0.1,
          () => spawn().gap,
          (value: number) => {
            spawn().gap = value;
          },
        ),
      ]),
      ...section("Movement", [
        vector(
          "Position",
          positionMin,
          positionMax,
          0.01,
          () => ({ x: spawn().x, y: spawn().y }),
          (value: Vector) => {
            spawn().x = value.x;
            spawn().y = value.y;
            placeMarkers();
          },
        ),
        ...derivativeNames.map((name: string, order: number) => ({
          ...vector(
            name,
            -derivativeLimit,
            derivativeLimit,
            derivativeStep,
            () => spawn().derivatives[order] ?? { x: 0, y: 0 },
            (value: Vector) => {
              spawn().derivatives[order] = value;
              placeMarkers();
            },
          ),
          shown: () => spawn().derivatives.length > order,
        })),
        derivativeActions(
          () => spawn().derivatives,
          derivativeNames,
          () => ({ x: 0, y: 0 }),
        ),
      ]),
    ],
    () => {
      preview.setBackground(backgroundById(stage().background));
      preview.setPlayerVisible(true);
      preview.setStage(stage(), resolve);
    },
  );

  const markerLayer: Container = new Container();
  const guides: Graphics = new Graphics();
  const ghosts: Array<Container> = new Array();
  let dragging: boolean = false;

  function buildMarkers(): void {
    for (const ghost of ghosts) {
      ghost.destroy({ children: true });
    }

    ghosts.length = 0;

    for (const value of keyframe().spawns) {
      const ghost: Container = new Container();
      const found: Enemy | null = enemyById(value.enemy);
      const texture: Texture | null = getTexture(found?.sprite ?? null);

      if (found !== null && texture !== null) {
        const image: Sprite = new Sprite(texture);

        image.anchor.set(0.5);
        image.scale.set(found.size / Math.max(texture.width, texture.height));
        ghost.addChild(image);
      } else {
        const body: Graphics = new Graphics();

        drawShape(body, found?.color ?? "#6b6b85", found?.size ?? 24);
        ghost.addChild(body);
      }

      ghost.alpha = markerAlpha;
      markerLayer.addChild(ghost);
      ghosts.push(ghost);
    }

    placeMarkers();
  }

  function placeMarkers(): void {
    const spawns: Array<Spawn> = keyframe().spawns;

    guides.clear();

    for (
      let index = 0;
      index < spawns.length && index < ghosts.length;
      index++
    ) {
      const value: Spawn = spawns[index]!;
      const x: number = value.x * previewWidth;
      const y: number = value.y * previewHeight;
      const size: number = enemyById(value.enemy)?.size ?? 24;
      const chosen: boolean = index === spawnIndex;

      ghosts[index]!.position.set(x, y);

      if (value.derivatives.length > 0) {
        guides.moveTo(x, y);

        for (let step = 1; step <= trailSteps; step++) {
          const [pointX, pointY] = motion(
            x,
            y,
            value.derivatives,
            (step / trailSteps) * trailTime,
          );

          guides.lineTo(pointX, pointY);
        }

        guides.stroke({
          color: chosen ? getTheme().accent : "#ffffff",
          width: 1.5,
          alpha: chosen ? 0.8 : guideAlpha,
        });
      }

      guides.circle(x, y, size / 2 + markerPadding).stroke({
        color: chosen ? getTheme().accent : "#ffffff",
        width: chosen ? 3 : 1.5,
        alpha: chosen ? 1 : guideAlpha * 2,
      });
    }
  }

  function markerAt(x: number, y: number): number {
    const spawns: Array<Spawn> = keyframe().spawns;
    let best: number = -1;
    let bestDistance: number = Infinity;

    for (let index = 0; index < spawns.length; index++) {
      const value: Spawn = spawns[index]!;
      const reach: number =
        (enemyById(value.enemy)?.size ?? 24) / 2 + markerPadding * 2;
      const distance: number = Math.hypot(
        value.x * previewWidth - x,
        value.y * previewHeight - y,
      );

      if (distance <= reach && distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }

    return best;
  }

  function dragTo(event: FederatedPointerEvent): void {
    const local: Point = preview.overlay.toLocal(event.global);

    spawn().x = Math.min(Math.max(local.x / previewWidth, 0), 1);
    spawn().y = Math.min(Math.max(local.y / previewHeight, 0), 1);
    placeMarkers();

    for (const control of tab.controls) {
      control.refresh();
    }
  }

  preview.overlay.addChild(guides, markerLayer);
  preview.overlay.eventMode = "static";
  preview.overlay.hitArea = new Rectangle(0, 0, previewWidth, previewHeight);
  preview.overlay.on("pointerdown", (event: FederatedPointerEvent) => {
    const local: Point = preview.overlay.toLocal(event.global);
    const index: number = markerAt(local.x, local.y);

    if (index < 0) {
      return;
    }

    spawnIndex = index;
    dragging = true;
    refresh();
  });
  preview.overlay.on("globalpointermove", (event: FederatedPointerEvent) => {
    if (dragging) {
      dragTo(event);
    }
  });

  function endDrag(): void {
    if (!dragging) {
      return;
    }

    dragging = false;
    changed();
    preview.seek(keyframe().time);
  }

  preview.overlay.on("pointerup", endDrag);
  preview.overlay.on("pointerupoutside", endDrag);

  tabs.unshift(tabs.pop()!);
  tab = tabs[0]!;

  const heading: Text = createText(headingSize, "#ffffff");
  heading.anchor.set(0, 0.5);
  heading.y = headingHeight / 2;
  itemBar.addChild(heading);

  scrollArea.y = headingHeight + sectionGap;
  scrollContent.mask = scrollMask;
  scrollArea.addChild(scrollContent, scrollMask, scrollBar);
  scrollArea.eventMode = "static";
  scrollArea.on("wheel", (event: FederatedWheelEvent) => {
    scrollTarget = Math.min(
      Math.max(scrollTarget + event.deltaY / frameScale, 0),
      maxScroll(),
    );
  });
  controls.addChild(itemBar, scrollArea);

  function maxScroll(): number {
    return Math.max(contentHeight - viewportHeight, 0);
  }

  function animateScroll(delta: number): void {
    scrollTarget = Math.min(scrollTarget, maxScroll());
    smoothDamp(scroll, scrollTarget, scrollSmoothing, delta);
    scrollContent.y = -scroll.value;
    scrollBar.clear();

    if (maxScroll() <= 0) {
      return;
    }

    const length: number = Math.max(
      (viewportHeight / contentHeight) * viewportHeight,
      scrollBarMinimum,
    );
    const offset: number =
      (scroll.value / maxScroll()) * (viewportHeight - length);

    scrollBar
      .rect(rowWidth + scrollBarGap, 0, scrollBarWidth, viewportHeight)
      .fill({ color: getTheme().menuSelected, alpha: 0.6 })
      .rect(rowWidth + scrollBarGap, offset, scrollBarWidth, length)
      .fill(getTheme().highlight);
  }

  const rowTargets: Map<Control, number> = new Map();
  let laidOut: Tab | null = null;

  function rowSpacing(control: Control): number {
    return control.header === true ? headerHeight : rowHeight;
  }

  function animateRows(delta: number): void {
    const blend: number = 1 - Math.exp(-delta / rowSmoothing);

    for (const control of tab.controls) {
      const target: number | undefined = rowTargets.get(control);
      const view: Container = control.view;

      if (target !== undefined) {
        view.y += (target - view.y) * blend;
        view.alpha = approach(view.alpha, 1, delta / rowFade);
      } else if (view.visible) {
        view.alpha = approach(view.alpha, 0, delta / rowFade);
        view.visible = view.alpha > 0;
      }
    }
  }

  function refresh(): void {
    if (tab.items()[tab.selected] === undefined) {
      return;
    }

    heading.text = current().name.toUpperCase();

    for (let index = 0; index < tabs.length; index++) {
      const value: Tab = tabs[index]!;
      value.panel.visible = value === tab;
    }

    const snap: boolean = laidOut !== tab;
    let rowY: number = 0;

    if (snap) {
      scrollTarget = 0;
      scroll.value = 0;
      scroll.velocity = 0;
    }

    laidOut = tab;

    for (let index = 0; index < tab.controls.length; index++) {
      const control: Control = tab.controls[index]!;
      const shown: boolean = control.shown?.() ?? true;

      control.view.eventMode = shown
        ? control.header === true
          ? "static"
          : "passive"
        : "none";

      if (shown) {
        if (snap || !control.view.visible) {
          control.view.y = rowY;
        }

        if (snap) {
          control.view.alpha = 1;
        }

        control.view.visible = true;
        rowTargets.set(control, rowY);
        rowY += rowSpacing(control);
        control.refresh();
      } else {
        rowTargets.delete(control);

        if (snap) {
          control.view.visible = false;
        }
      }
    }

    contentHeight = rowY;
    layout();
    timeline.visible = tab.name === "stage";
    tab.show();

    if (tab.name === "stage") {
      buildMarkers();
    }
  }

  const editor: Container = new Container();
  const gallery: Gallery = createGallery(
    app,
    () => creations,
    (kind: Kind, index: number) => openItem(kind, index),
    (kind: Kind) => createItem(kind),
    (kind: Kind, index: number, action: Action) => {
      if (action === "rename") {
        renameItem(kind, index);
      } else if (action === "delete") {
        deleteItem(kind, index);
      }
    },
  );

  function listOf(kind: Kind): Array<Item> {
    return tabs.find((value: Tab) => value.name === kind)!.items();
  }

  function renameItem(kind: Kind, index: number): void {
    const item: Item | undefined = listOf(kind)[index];
    const name: string | null =
      item === undefined ? null : window.prompt("Name", item.name);

    if (item === undefined || name === null || name.trim() === "") {
      return;
    }

    item.name = name.trim().slice(0, nameLength);
    saveCreations(creations);
    gallery.refresh();
  }

  function deleteItem(kind: Kind, index: number): void {
    const item: Item | undefined = listOf(kind)[index];

    if (item === undefined || !window.confirm('Delete "' + item.name + '"?')) {
      return;
    }

    listOf(kind).splice(index, 1);

    for (const enemyItem of creations.enemies) {
      if (enemyItem.pattern === item.id) {
        enemyItem.pattern = null;
      }

      if (enemyItem.spell === item.id) {
        enemyItem.spell = null;
      }
    }

    for (const stageItem of creations.stages) {
      if (stageItem.background === item.id) {
        stageItem.background = null;
      }

      for (const keyframeItem of stageItem.keyframes) {
        for (const spawnItem of keyframeItem.spawns) {
          if (spawnItem.enemy === item.id) {
            spawnItem.enemy = null;
          }
        }
      }
    }

    for (const value of tabs) {
      value.selected = Math.max(
        Math.min(value.selected, value.items().length - 1),
        0,
      );
    }

    saveCreations(creations);
    cleanup();
    gallery.refresh();
  }
  let editing: boolean = false;
  let dropShown: boolean = false;

  function createItem(kind: Kind): void {
    const enemyId: string | null = creations.enemies[0]?.id ?? null;
    const backgroundId: string | null = creations.backgrounds[0]?.id ?? null;
    let index: number;

    if (kind === "stage") {
      index = creations.stages.push({
        ...defaultStage(enemyId, backgroundId),
        name: "Stage " + (creations.stages.length + 1),
      });
    } else if (kind === "pattern") {
      index = creations.patterns.push({
        ...defaultPattern(),
        name: "Pattern " + (creations.patterns.length + 1),
      });
    } else if (kind === "enemy") {
      index = creations.enemies.push({
        ...defaultEnemy(creations.patterns[0]?.id ?? null),
        name: "Enemy " + (creations.enemies.length + 1),
      });
    } else if (kind === "spell") {
      index = creations.spells.push({
        ...defaultSpell(),
        name: "Spell " + (creations.spells.length + 1),
      });
    } else {
      index = creations.backgrounds.push({
        ...defaultBackground(),
        name: "Background " + (creations.backgrounds.length + 1),
      });
    }

    saveCreations(creations);
    openItem(kind, index - 1);
  }

  function openItem(kind: Kind, index: number): void {
    const next: Tab = tabs.find((value: Tab) => value.name === kind)!;

    next.selected = index;
    tab = next;
    spawnIndex = 0;
    keyIndex = 0;
    ringIndex = 0;
    sectionOpen.clear();
    laidOut = null;
    editing = true;
    gallery.setActive(false);
    preview.clear();
    refresh();
    swap(gallery.view, editor, true);
  }

  let swapToken: number = 0;

  function swap(from: Container, to: Container, animate: boolean): void {
    const token: number = ++swapToken;

    if (!animate) {
      from.visible = false;
      to.visible = true;
      from.alpha = 1;
      to.alpha = 1;
      from.x = 0;
      to.x = 0;
      return;
    }

    tween(app.ticker, swapOutDuration, (progress: number) => {
      if (token === swapToken) {
        from.alpha = 1 - progress;
        from.x = -swapDistance * progress * progress;
      }
    }).then(() => {
      if (token === swapToken) {
        from.visible = false;
        from.alpha = 1;
        from.x = 0;
      }
    });
    tween(app.ticker, swapOutDuration - swapLead, () => undefined).then(() => {
      if (token !== swapToken) {
        return;
      }

      to.visible = true;
      tween(app.ticker, swapInDuration, (progress: number) => {
        if (token === swapToken) {
          to.alpha = Math.min(progress * 2, 1);
          to.x = swapDistance * (1 - swapEasing(progress));
        }
      });
    });
  }

  function showSelector(animate: boolean = true): void {
    typing = null;
    editing = false;
    dropShown = false;
    gallery.refresh();
    gallery.appear();
    gallery.setActive(active);
    preview.clear();
    swap(editor, gallery.view, animate && editor.visible);
  }

  const drop: Container = new Container();
  const dropBack: Graphics = new Graphics();
  const dropText: Text = createText(dropSize, "#ffffff");

  dropText.anchor.set(0.5);
  drop.addChild(dropBack, dropText);
  drop.visible = false;
  const timelineLength: number = fieldHeight - chipHeight - timelineGap;

  function timelineY(time: number): number {
    return (1 - time / stage().length) * timelineLength;
  }

  function seekTimeline(y: number): void {
    const amount: number = Math.min(Math.max(1 - y / timelineLength, 0), 1);
    const keyframes: Array<Keyframe> = stage().keyframes;

    for (let index = 0; index < keyframes.length; index++) {
      const at: number = timelineY(keyframes[index]!.time);

      if (Math.abs(at - y) <= keyframeSize + 2) {
        selectKeyframe(index);
        return;
      }
    }

    preview.seek(amount * stage().length);
  }

  function drawTimeline(): void {
    const length: number = stage().length;
    const now: number = preview.stageTime();

    track
      .clear()
      .rect(0, 0, timelineHeight, timelineLength)
      .fill({ color: timelineColor, alpha: 0.85 });

    for (let index = 0; index < stage().keyframes.length; index++) {
      const value: Keyframe = stage().keyframes[index]!;
      const color: string =
        index === keyIndex ? getTheme().accent : markerColor;
      const y: number = timelineY(value.time);

      for (const entry of value.spawns) {
        for (let wave = 1; wave < entry.count; wave++) {
          const at: number = value.time + wave * entry.gap;

          if (at <= length) {
            track
              .rect(
                timelineHeight / 3,
                timelineY(at) - markerWidth / 2,
                timelineHeight / 3,
                markerWidth,
              )
              .fill({ color: color, alpha: 0.6 });
          }
        }
      }

      track
        .poly([
          0,
          y,
          timelineHeight / 2,
          y - keyframeSize,
          timelineHeight,
          y,
          timelineHeight / 2,
          y + keyframeSize,
        ])
        .fill(color);
    }

    track
      .rect(
        -4,
        timelineY(now) - playheadWidth / 2,
        timelineHeight + 8,
        playheadWidth,
      )
      .fill(getTheme().highlight);
    clock.text = now.toFixed(1) + "s";
    total.text = length + "s";
  }

  track.eventMode = "static";
  track.cursor = "pointer";
  track.on("pointerdown", (event: FederatedPointerEvent) => {
    seekTimeline(track.toLocal(event.global).y);
  });
  let playing: boolean = true;
  const transport: Container = new Container();
  const playIcon: Graphics = new Graphics();
  const patternIcon: Graphics = new Graphics();
  const patternBar: Container = new Container();
  const patternClock: Text = createText(clockSize, "#ffffff");
  const clockField: Container = new Container();
  const clockBox: Graphics = new Graphics();
  let patternPlaying: boolean = true;
  let typing: string | null = null;
  let typingFresh: boolean = false;
  let caretTime: number = 0;

  function drawPlayIcon(): void {
    drawToggle(playIcon, playing);
    drawToggle(patternIcon, patternPlaying);
  }

  function drawToggle(icon: Graphics, running: boolean): void {
    const center: number = transportWidth / 2;
    const middle: number = chipHeight / 2;

    icon.clear();

    if (running) {
      icon
        .rect(
          center - iconSize * 0.8,
          middle - iconSize,
          iconSize * 0.55,
          iconSize * 2,
        )
        .rect(
          center + iconSize * 0.25,
          middle - iconSize,
          iconSize * 0.55,
          iconSize * 2,
        )
        .fill(0xffffff);
    } else {
      icon
        .poly([
          center - iconSize * 0.7,
          middle - iconSize,
          center + iconSize,
          middle,
          center - iconSize * 0.7,
          middle + iconSize,
        ])
        .fill(0xffffff);
    }
  }

  function togglePlaying(): void {
    if (tab.name === "pattern") {
      patternPlaying = !patternPlaying;
    } else {
      playing = !playing;
    }

    drawPlayIcon();
  }

  function pause(): void {
    playing = false;
    drawPlayIcon();
  }

  const playChip: Chip = createChip("", transportWidth, togglePlaying);
  const patternChip: Chip = createChip("", transportWidth, togglePlaying);

  patternChip.view.addChild(patternIcon);
  patternClock.anchor.set(0, 0.5);
  patternClock.position.set(fieldPadding, chipHeight / 2);
  clockField.position.set(transportWidth + patternGap, 0);
  clockField.addChild(clockBox, patternClock);
  patternBar.addChild(patternChip.view, clockField);
  clockField.eventMode = "static";
  clockField.cursor = "text";
  clockField.hitArea = new Rectangle(0, 0, clockWidth, chipHeight);
  clockField.on("pointertap", () => {
    if (typing === null) {
      typing = preview.patternTime().toFixed(1);
      typingFresh = true;
      patternPlaying = false;
      drawPlayIcon();
    }
  });

  function finishTyping(apply: boolean): void {
    if (typing === null) {
      return;
    }

    const value: number = Number(typing);

    if (apply && typing !== "" && Number.isFinite(value)) {
      preview.seekPattern(value);
    }

    typing = null;
  }

  window.addEventListener("pointerdown", (event: PointerEvent) => {
    if (typing !== null && event.target === app.canvas) {
      const bounds: Bounds = clockField.getBounds();
      const point: Point = app.renderer.events.pointer.global;

      if (!bounds.containsPoint(point.x, point.y)) {
        finishTyping(true);
      }
    }
  });

  window.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      if (typing === null) {
        return;
      }

      if (event.key === "Enter") {
        finishTyping(true);
      } else if (event.key === "Escape") {
        finishTyping(false);
      } else if (event.key === "Backspace") {
        typing = typingFresh ? "" : typing.slice(0, -1);
        typingFresh = false;
      } else if (
        (/^[0-9]$/.test(event.key) ||
          (event.key === "." && (typingFresh || !typing.includes(".")))) &&
        (typingFresh || typing.length < typingLength)
      ) {
        typing = (typingFresh ? "" : typing) + event.key;
        typingFresh = false;
      } else {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
  patternBar.position.set(
    fieldX + fieldWidth / 2 - transportWidth,
    fieldY + fieldHeight + (hudHeight - fieldY - fieldHeight - chipHeight) / 2,
  );

  playChip.view.addChild(playIcon);
  transport.addChild(playChip.view);
  drawPlayIcon();

  timeline.addChild(track, clock, total, transport);
  drawFrame(backdrop);
  panelBack
    .rect(
      panelLeft - panelPadding,
      panelTop - panelPadding,
      rowWidth + panelPadding * 2,
      panelBottom - panelTop + panelPadding * 2,
    )
    .fill({ color: panelColor, alpha: panelAlpha });
  frameMask.rect(0, 0, hudWidth, hudHeight).fill(0xffffff);
  board.position.set(fieldX, fieldY);
  board.addChild(preview.view);
  controls.position.set(panelLeft, panelTop);
  track.position.set(columnCenter - timelineHeight / 2, 0);
  track.hitArea = new Rectangle(
    -6,
    -keyframeSize,
    timelineHeight + 12,
    timelineLength + keyframeSize * 2,
  );
  clock.anchor.set(0.5);
  clock.position.set(columnCenter, fieldHeight + clockGap);
  total.anchor.set(0.5);
  total.position.set(columnCenter, -clockGap);
  transport.position.set(
    columnCenter - transportWidth / 2,
    timelineLength + timelineGap,
  );
  timeline.position.set(0, fieldY);
  gameFrame.addChild(
    backdrop,
    panelBack,
    board,
    controls,
    timeline,
    patternBar,
    frameMask,
  );
  gameFrame.mask = frameMask;
  editor.addChild(gameFrame);
  view.addChild(editor, gallery.view, drop);

  function hasFiles(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes("Files") ?? false;
  }

  function showDrop(value: boolean): void {
    dropShown = value && active && editing && current().sprite !== undefined;
    dropText.text = "DROP IMAGE FOR " + tab.name.toUpperCase() + " SPRITE";
  }

  window.addEventListener("dragover", (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    showDrop(true);
  });

  window.addEventListener("dragleave", (event: DragEvent) => {
    if (event.relatedTarget === null) {
      showDrop(false);
    }
  });

  window.addEventListener("drop", (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    showDrop(false);

    if (active && editing) {
      useImage(event.dataTransfer?.files[0]);
    }
  });

  function sharpen(target: Container, resolution: number): void {
    if (target instanceof Text && target.resolution !== resolution) {
      target.resolution = resolution;
    }

    for (const child of target.children) {
      sharpen(child, resolution);
    }
  }

  function layout(): void {
    const width: number = app.screen.width;
    const height: number = app.screen.height;
    const bottom: number = panelBottom;

    frameScale = Math.min(width / hudWidth, height / hudHeight);
    gameFrame.scale.set(frameScale);
    gameFrame.position.set(
      Math.round(width / 2 - (hudWidth * frameScale) / 2),
      Math.round(height / 2 - (hudHeight * frameScale) / 2),
    );
    viewportHeight = bottom - panelTop - scrollArea.y;
    scrollMask
      .clear()
      .rect(-headerSlant, 0, rowWidth + headerSlant * 2, viewportHeight)
      .fill(0xffffff);
    scrollArea.hitArea = new Rectangle(0, 0, rowWidth, viewportHeight);
    sharpen(gameFrame, frameScale * (window.devicePixelRatio || 1));
    dropBack
      .clear()
      .rect(0, 0, width, height)
      .fill({ color: dropColor, alpha: dropAlpha })
      .rect(dropInset, dropInset, width - dropInset * 2, height - dropInset * 2)
      .stroke({ color: frameColor, width: dropBorder, alignment: 1 });
    dropText.position.set(width / 2, height / 2);
  }

  app.ticker.add((ticker: Ticker) => {
    if (view.parent?.visible !== true) {
      return;
    }

    const delta: number = Math.min(ticker.deltaMS / 1000, maxDelta);

    if (editing) {
      animateRows(delta);
      animateScroll(delta);
    }

    drop.alpha = approach(drop.alpha, dropShown ? 1 : 0, delta / dropFade);
    drop.visible = drop.alpha > 0;

    if (!editing) {
      return;
    }

    preview.overlay.visible = tab.name === "stage" && !playing;

    if (
      tab.name === "stage" ? playing : tab.name !== "pattern" || patternPlaying
    ) {
      preview.update(delta);
    }

    patternBar.visible = tab.name === "pattern";
    drawField(clockBox, clockWidth, chipHeight, typing !== null);

    if (typing === null) {
      patternClock.text = preview.patternTime().toFixed(1) + "s";
      patternClock.tint = 0xffffff;
    } else {
      caretTime += delta;
      patternClock.text =
        typing + (caretTime % caretBlink < caretBlink / 2 ? "|" : " ") + "s";
      patternClock.tint = getTheme().accent;
    }

    if (timeline.visible) {
      drawTimeline();
    }
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!active || !editing || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (
      (tab.name === "stage" || tab.name === "pattern") &&
      event.code === "Space"
    ) {
      togglePlaying();
      event.preventDefault();
      return;
    }
  });

  function setActive(value: boolean): void {
    active = value;
    typing = null;
    view.eventMode = value ? "passive" : "none";
    dropShown = false;
    drop.visible = false;
    drop.alpha = 0;
    gallery.setActive(value && !editing);
  }

  function back(): boolean {
    if (!editing) {
      return false;
    }

    showSelector();
    return true;
  }

  tab.panel.visible = true;
  refresh();
  Promise.all([...usedSprites(creations)].map(loadTexture)).then(() => {
    refresh();
    gallery.refresh();
    cleanup();
  });
  layout();
  editor.visible = false;
  showSelector(false);
  setActive(false);
  app.renderer.on("resize", layout);

  return {
    view: view,
    setActive: setActive,
    enter: () => showSelector(false),
    fullscreen: () => true,
    leave: () => (editing ? Promise.resolve() : gallery.disappear()),
    leaveTime: () => (editing ? 0 : gallery.disappearTime()),
    back: back,
  };
}

export { createMaker };
