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
import { createBackdrop, type Backdrop } from "./backdrop";
import { drawSound, importAudio, loadAudio, playSound } from "./sound";
import { createScene, type Scene } from "./cutscene";
import {
  applyTranscript,
  cleanName,
  editTranscript,
  formatTranscript,
} from "./transcript";
import { createClock, runClock, type Clock } from "../game/clock";
import {
  downKeys,
  focusKeys,
  leftKeys,
  rightKeys,
  upKeys,
} from "../game/playfield";
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
  wallAngle,
  defaultBackground,
  defaultRing,
  defaultSpell,
  defaultSound,
  defaultEmotion,
  defaultCharacter,
  defaultCutscene,
  defaultEnemy,
  defaultPattern,
  defaultKeyframe,
  defaultStage,
  loadCreations,
  saveCreations,
  usedSprites,
  usedFiles,
  type Background,
  type Difficulty,
  type Frame,
  type Wall,
  type Curve,
  type Wave,
  type Rank,
  type Creations,
  type Enemy,
  type Vector,
  type Pattern,
  type Keyframe,
  type Ring,
  type Spawn,
  type Spell,
  type Sound,
  type Cutscene,
  type Character,
  type Emotion,
  type Waveform,
  type SoundSource,
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
import {
  createGallery,
  type Action,
  type Category,
  type Gallery,
  type Kind,
} from "./gallery";
import {
  cosmetics,
  difficulties,
  frames,
  defaultName,
  ranks,
  type Cosmetic,
  type Rarity,
} from "./rarity";

const kindWords: Map<Kind, string> = new Map([
  ["stage", "Stage"],
  ["pattern", "Pattern"],
  ["enemy", "Enemy"],
  ["background", "Background"],
  ["spell", "Spell"],
  ["sound", "Sound"],
  ["character", "Character"],
  ["cutscene", "Cutscene"],
]);

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
const playtestWidth: number = 98; // units
const movementKeys: Array<string> = [
  ...leftKeys,
  ...rightKeys,
  ...upKeys,
  ...downKeys,
  ...focusKeys,
];
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
const wallOptions: Array<Option<Wall>> = [
  { value: "top", label: "Top" },
  { value: "right", label: "Right" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
];
const curveOptions: Array<Option<Curve>> = [
  { value: "polynomial", label: "Polynomial" },
  { value: "sinusoidal", label: "Sinusoidal" },
];
const waveNames: Array<string> = ["wave 1", "wave 2", "wave 3"];
const waveAmplitude: number = 60; // units
const angleAmplitude: number = 30; // deg
const swayLimit: number = 200; // units
const waveFrequency: number = 0.5; // Hz
const frequencyMin: number = 0.05; // Hz
const frequencyMax: number = 5; // Hz
const frequencyStep: number = 0.05; // Hz
const phaseLimit: number = 180; // deg
const gapPhaseShiftLimit: number = 1; // of wall/s
const phaseShiftLimit: number = 360; // deg/s
const waveOptions: Array<Option<Waveform>> = [
  { value: "square", label: "Square" },
  { value: "sine", label: "Sine" },
  { value: "sawtooth", label: "Saw" },
  { value: "triangle", label: "Triangle" },
  { value: "noise", label: "Noise" },
];
const soundDelay: number = 250; // ms
const sourceOptions: Array<Option<SoundSource>> = [
  { value: "synth", label: "Synth" },
  { value: "file", label: "File" },
];
const soundNameGap: number = 12; // units
const pitchMin: number = 40; // Hz
const pitchMax: number = 2000; // Hz
const soundPlotWidth: number = 320; // units
const soundPlotHeight: number = 160; // units
const lineSpeedMin: number = 5; // chars/s
const lineSpeedMax: number = 120; // chars/s
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
  const soundPlot: Graphics = new Graphics();
  const soundName: Text = createText(clockSize, "#ffffff");
  let soundTimer: number | null = null;
  const scene: Scene = createScene(speak, () => creations.characters);
  const cardScene: Scene = createScene(
    () => undefined,
    () => creations.characters,
  );
  const gameFrame: Container = new Container();
  const backdrop: Backdrop = createBackdrop(app);
  const hudFrame: Graphics = new Graphics();
  const panelBack: Graphics = new Graphics();
  const frameMask: Graphics = new Graphics();
  let frameScale: number = 1;
  const preview: Preview = await createPreview(playerTexture());
  const cardPreview: Preview = await createPreview(playerTexture());
  const cardTicks: Clock = createClock();
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
  let emotionIndex: number = 0;

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

  function sound(): Sound {
    return creations.sounds[selection("sound")]!;
  }

  function spell(): Spell {
    return creations.spells[selection("spell")]!;
  }

  function cutscene(): Cutscene {
    return creations.cutscenes[selection("cutscene")]!;
  }

  function character(): Character {
    return creations.characters[selection("character")]!;
  }

  function scened(): boolean {
    return tab.name === "cutscene" || tab.name === "character";
  }

  function showcase(): Cutscene {
    return {
      id: "",
      name: "",
      voice: null,
      speed: defaultCutscene(new Array()).speed,
      lines: [
        {
          id: "",
          character: character().id,
          emotion: emotion().id,
          text: emotion().name,
        },
      ],
    };
  }

  function playScene(): void {
    scene.play(tab.name === "character" ? showcase() : cutscene(), 0);
  }

  function emotion(): Emotion {
    emotionIndex = Math.min(emotionIndex, character().emotions.length - 1);

    return character().emotions[emotionIndex]!;
  }

  function speak(value: Cutscene): void {
    const voice: Sound | null = soundById(value.voice);

    if (voice !== null) {
      playSound(voice);
    }
  }

  function soundById(id: string | null): Sound | null {
    return creations.sounds.find((value: Sound) => value.id === id) ?? null;
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

  function spellOf(value: Enemy): Spell | null {
    return value.rank === "regular" ? null : spellById(value.spell);
  }

  function resolve(value: Spawn): [Enemy, Pattern | null, Spell | null] | null {
    const found: Enemy | null = enemyById(value.enemy);

    return found === null
      ? null
      : [found, patternById(found.pattern), spellOf(found)];
  }

  function rarityOptions<T>(list: Array<Rarity<T>>): () => Array<Option<T>> {
    return () =>
      list.map((entry: Rarity<T>) => ({
        value: entry.value,
        label: entry.label,
      }));
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
    removeUnused(usedFiles(creations));
  }

  async function useImage(file: File | undefined): Promise<void> {
    if (file === undefined || !file.type.startsWith("image/")) {
      return;
    }

    const item: Item = tab.name === "character" ? emotion() : current();

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
      refresh();
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
      refresh();
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

  function section(
    name: string,
    list: Array<Control>,
    visible: () => boolean = () => true,
  ): Array<Control> {
    const key: number = sections++;
    const open: () => boolean = () => sectionOpen.get(key) ?? false;
    const header: Control = createHeader(name, open, () => {
      sectionOpen.set(key, !open());
      refresh();
    });

    return [
      { ...header, shown: visible },
      ...list.map((control: Control) => {
        const shown: (() => boolean) | undefined = control.shown;

        return {
          ...control,
          shown: () => visible() && open() && (shown?.() ?? true),
        };
      }),
    ];
  }

  const cosmeticKeys: Map<Cosmetic, number> = new Map();

  function cosmeticSection(kind: Cosmetic): Array<Control> {
    cosmeticKeys.set(kind, sections);

    return section("Cosmetic", [
      choice(
        "Type",
        rarityOptions(cosmetics),
        () => kind,
        (value: Cosmetic) => convertCosmetic(value),
      ),
    ]);
  }

  function forgetCosmetic(id: string): void {
    for (const cutsceneItem of creations.cutscenes) {
      if (cutsceneItem.voice === id) {
        cutsceneItem.voice = null;
      }
    }
  }

  function rarityKey(kind: Kind, item: Item): string {
    return kind === "stage"
      ? (item as Stage).difficulty
      : kind === "enemy"
        ? (item as Enemy).rank
        : kind === "pattern"
          ? (item as Pattern).frame
          : kind;
  }

  function freshName(kind: Kind, item: Item): string {
    const word: string = kindWords.get(kind)!;
    const key: string = rarityKey(kind, item);
    const taken: Set<string> = new Set(
      listOf(kind)
        .filter(
          (other: Item) => other !== item && rarityKey(kind, other) === key,
        )
        .map((other: Item) => other.name),
    );
    let number: number = 1;

    while (taken.has(word + " " + number)) {
      number++;
    }

    return word + " " + number;
  }

  function renameDefault(kind: Kind, item: Item): void {
    if (defaultName.test(item.name)) {
      item.name = freshName(kind, item);
    }
  }

  function convertCosmetic(to: Cosmetic): void {
    const item: Item = current();
    const from: Kind = tab.name as Kind;
    let index: number;

    if (from === to) {
      return;
    }

    listOf(from).splice(tab.selected, 1);

    for (const stageItem of creations.stages) {
      if (stageItem.background === item.id) {
        stageItem.background = null;
      }
    }

    for (const enemyItem of creations.enemies) {
      if (enemyItem.spell === item.id) {
        enemyItem.spell = null;
      }
    }

    forgetCosmetic(item.id);

    if (to === "spell") {
      index = creations.spells.push({
        ...defaultSpell(),
        id: item.id,
        name: item.name,
      });
    } else if (to === "sound") {
      index = creations.sounds.push({
        ...defaultSound(),
        id: item.id,
        name: item.name,
      });
    } else if (to === "character") {
      index = creations.characters.push({
        ...defaultCharacter(item.name),
        id: item.id,
        name: cleanName(item.name) || "Character",
      });
    } else if (to === "cutscene") {
      index = creations.cutscenes.push({
        ...defaultCutscene(creations.characters),
        id: item.id,
        name: item.name,
      });
    } else {
      index = creations.backgrounds.push({
        ...defaultBackground(),
        id: item.id,
        name: item.name,
      });
    }

    for (const value of tabs) {
      value.selected = Math.max(
        Math.min(value.selected, value.items().length - 1),
        0,
      );
    }

    renameDefault(to, listOf(to)[index - 1]!);
    saveCreations(creations);
    cleanup();
    showItem(to, index - 1);
    sectionOpen.set(cosmeticKeys.get(to)!, true);
    refresh();
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
        {
          ...slider(
            "Coverage",
            0.05,
            5,
            0.05,
            () => pattern().cover,
            (value: number) => {
              pattern().cover = value;
            },
          ),
          shown: () => pattern().frame === "objective",
        },
        {
          ...slider(
            "Spread",
            0,
            360,
            5,
            () => pattern().spread,
            (value: number) => {
              pattern().spread = value;
            },
          ),
          shown: () =>
            pattern().frame === "subjective" && Math.round(pattern().count) > 1,
        },
      ]),
      ...section(
        "Gaps",
        [
          slider(
            "Frequency",
            0,
            8,
            1,
            () => pattern().gapFrequency,
            (value: number) => {
              pattern().gapFrequency = value;
            },
          ),
          {
            ...slider(
              "Offset",
              -0.5,
              0.5,
              0.01,
              () => pattern().gapShift,
              (value: number) => {
                pattern().gapShift = value;
              },
            ),
            shown: () => pattern().gapFrequency > 0,
          },
          {
            ...slider(
              "Phase shift",
              -gapPhaseShiftLimit,
              gapPhaseShiftLimit,
              0.01,
              () => pattern().gapPhaseShift,
              (value: number) => {
                pattern().gapPhaseShift = value;
              },
            ),
            shown: () => pattern().gapFrequency > 0,
          },
          {
            ...slider(
              "Width",
              0.01,
              1,
              0.01,
              () => pattern().gapWidth,
              (value: number) => {
                pattern().gapWidth = value;
              },
            ),
            shown: () => pattern().gapFrequency > 0,
          },
        ],
        () => pattern().frame === "objective",
      ),
      ...section("Aim", [
        choice(
          "Frame",
          rarityOptions(frames),
          () => pattern().frame,
          (value: Frame) => {
            pattern().frame = value;
            renameDefault("pattern", pattern());
          },
        ),
        {
          ...choice(
            "Wall",
            () => wallOptions,
            () => pattern().wall,
            (value: Wall) => {
              const turn: number = wallAngle(value) - wallAngle(pattern().wall);
              const velocity: Vector = pattern().velocity;

              pattern().velocity = {
                x: Math.round(
                  velocity.x * Math.cos(turn) - velocity.y * Math.sin(turn),
                ),
                y: Math.round(
                  velocity.x * Math.sin(turn) + velocity.y * Math.cos(turn),
                ),
              };
              pattern().wall = value;
            },
          ),
          shown: () => pattern().frame === "objective",
        },
        {
          ...choice(
            "Aim",
            () => aimOptions,
            () => pattern().aim,
            (value: boolean) => {
              pattern().aim = value;
            },
          ),
          shown: () => pattern().frame === "subjective",
        },
        {
          ...slider(
            "Angle",
            -180,
            180,
            5,
            () => pattern().heading,
            (value: number) => {
              pattern().heading = value;
            },
          ),
          shown: () => pattern().frame === "subjective" && !pattern().aim,
        },
        {
          ...choice(
            "Mode",
            () => curveOptions,
            () => pattern().aimCurve,
            (value: Curve) => {
              pattern().aimCurve = value;
            },
          ),
          shown: () => pattern().frame === "subjective",
        },
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
          shown: () =>
            pattern().frame === "subjective" &&
            pattern().aimCurve === "polynomial" &&
            pattern().angleDerivatives.length > order,
        })),
        {
          ...derivativeActions(
            () => pattern().angleDerivatives,
            derivativeNames,
            () => 0,
          ),
          shown: () =>
            pattern().frame === "subjective" &&
            pattern().aimCurve === "polynomial",
        },
        ...waveRows(
          () => pattern().aimWaves,
          (name: string, get: () => number, set: (value: number) => void) =>
            slider(name, -phaseLimit, phaseLimit, 5, get, set),
          () => angleAmplitude,
          () =>
            pattern().frame === "subjective" &&
            pattern().aimCurve === "sinusoidal",
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
        {
          ...slider(
            "Speed",
            20,
            400,
            5,
            () => pattern().speed,
            (value: number) => {
              pattern().speed = value;
            },
          ),
          shown: () => pattern().frame === "subjective",
        },
        {
          ...vector(
            "Speed",
            -speedLimit,
            speedLimit,
            5,
            () => pattern().velocity,
            (value: Vector) => {
              pattern().velocity = value;
            },
          ),
          shown: () => pattern().frame === "objective",
        },
        choice(
          "Mode",
          () => curveOptions,
          () => pattern().curve,
          (value: Curve) => {
            pattern().curve = value;
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
          shown: () =>
            pattern().frame === "subjective" &&
            pattern().curve === "polynomial" &&
            pattern().speedDerivatives.length > order,
        })),
        {
          ...derivativeActions(
            () => pattern().speedDerivatives,
            speedNames,
            () => 0,
          ),
          shown: () =>
            pattern().frame === "subjective" &&
            pattern().curve === "polynomial",
        },
        ...speedNames.map((name: string, order: number) => ({
          ...vector(
            name,
            -speedLimit,
            speedLimit,
            5,
            () => pattern().driftDerivatives[order] ?? { x: 0, y: 0 },
            (value: Vector) => {
              pattern().driftDerivatives[order] = value;
            },
          ),
          shown: () =>
            pattern().frame === "objective" &&
            pattern().curve === "polynomial" &&
            pattern().driftDerivatives.length > order,
        })),
        {
          ...derivativeActions(
            () => pattern().driftDerivatives,
            speedNames,
            () => ({ x: 0, y: 0 }),
          ),
          shown: () =>
            pattern().frame === "objective" && pattern().curve === "polynomial",
        },
        ...waveRows(
          () => pattern().angleWaves,
          (name: string, get: () => number, set: (value: number) => void) =>
            slider(name, -phaseLimit, phaseLimit, 5, get, set),
          () => angleAmplitude,
          () =>
            pattern().frame === "subjective" &&
            pattern().curve === "sinusoidal",
        ),
        ...waveRows(
          () => pattern().swayWaves,
          (name: string, get: () => Vector, set: (value: Vector) => void) =>
            vector(name, -swayLimit, swayLimit, 5, get, set),
          () => ({ x: waveAmplitude, y: 0 }),
          () =>
            pattern().frame === "objective" && pattern().curve === "sinusoidal",
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
        choice(
          "Rank",
          rarityOptions(ranks),
          () => enemy().rank,
          (value: Rank) => {
            enemy().rank = value;
            renameDefault("enemy", enemy());
          },
        ),
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
        {
          ...choice(
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
          shown: () => enemy().rank !== "regular",
        },
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setEnemy(enemy(), patternById(enemy().pattern), spellOf(enemy()));
    },
  );

  addTab(
    "background",
    () => creations.backgrounds,
    [
      ...cosmeticSection("background"),
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
      refresh();
    });
  }

  function waveRows<T>(
    list: () => Array<Wave<T>>,
    amplitude: (name: string, get: () => T, set: (value: T) => void) => Control,
    blank: () => T,
    visible: () => boolean,
    moved: () => void = () => {},
  ): Array<Control> {
    return [
      ...waveNames.flatMap((name: string, order: number) => {
        const shown: () => boolean = () => visible() && list().length > order;

        return [
          {
            ...amplitude(
              name + " amplitude",
              () => list()[order]?.amplitude ?? blank(),
              (value: T) => {
                list()[order]!.amplitude = value;
                moved();
              },
            ),
            shown: shown,
          },
          {
            ...slider(
              name + " frequency",
              frequencyMin,
              frequencyMax,
              frequencyStep,
              () => list()[order]?.frequency ?? waveFrequency,
              (value: number) => {
                list()[order]!.frequency = value;
                moved();
              },
            ),
            shown: shown,
          },
          {
            ...slider(
              name + " phase",
              -phaseLimit,
              phaseLimit,
              5,
              () => list()[order]?.phase ?? 0,
              (value: number) => {
                list()[order]!.phase = value;
                moved();
              },
            ),
            shown: shown,
          },
          {
            ...slider(
              name + " phase shift",
              -phaseShiftLimit,
              phaseShiftLimit,
              5,
              () => list()[order]?.phaseShift ?? 0,
              (value: number) => {
                list()[order]!.phaseShift = value;
                moved();
              },
            ),
            shown: shown,
          },
        ];
      }),
      {
        ...derivativeActions(list, waveNames, () => ({
          amplitude: blank(),
          frequency: waveFrequency,
          phase: 0,
          phaseShift: 0,
        })),
        shown: visible,
      },
    ];
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
      ...cosmeticSection("spell"),
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

  function hearSound(): void {
    if (soundTimer !== null) {
      window.clearTimeout(soundTimer);
    }

    soundTimer = window.setTimeout(() => {
      soundTimer = null;

      if (tab.name === "sound") {
        playSound(sound());
      }
    }, soundDelay);
  }

  function soundSlider(
    name: string,
    min: number,
    max: number,
    step: number,
    key: "pitch" | "slide" | "attack" | "sustain" | "decay" | "volume",
  ): Control {
    return slider(
      name,
      min,
      max,
      step,
      () => sound()[key],
      (value: number) => {
        sound()[key] = value;
        hearSound();
      },
    );
  }

  function randomSound(): void {
    const value: Sound = sound();
    const pick: (min: number, max: number) => number = (
      min: number,
      max: number,
    ) => min + Math.random() * (max - min);

    value.wave =
      waveOptions[Math.floor(Math.random() * waveOptions.length)]!.value;
    value.pitch = Math.round(pick(pitchMin, pitchMax) / 10) * 10;
    value.slide = Math.round(pick(pitchMin, pitchMax) / 10) * 10;
    value.attack = Math.round(pick(0, 0.1) * 100) / 100;
    value.sustain = Math.round(pick(0, 0.3) * 100) / 100;
    value.decay = Math.round(pick(0.05, 0.8) * 50) / 50;
    value.vibratoDepth =
      Math.random() < 0.5 ? 0 : Math.round(pick(0, 4) * 2) / 2;
    value.vibratoRate = Math.round(pick(2, 20) * 2) / 2;
    changed();
    refresh();
    playSound(value);
  }

  addTab(
    "sound",
    () => creations.sounds,
    [
      ...cosmeticSection("sound"),
      ...section("Sound", [
        choice(
          "Source",
          () => sourceOptions,
          () => sound().source,
          (value: SoundSource) => {
            sound().source = value;
            hearSound();
          },
        ),
        {
          ...actionRow("Play", () => playSound(sound()), "Random", randomSound),
          shown: () => sound().source === "synth",
        },
        {
          ...actionRow(
            "Play",
            () => playSound(sound()),
            "Import",
            () => audioPicker.click(),
          ),
          shown: () => sound().source === "file",
        },
        soundSlider("Volume", 0.05, 1, 0.05, "volume"),
      ]),
      ...section(
        "Tone",
        [
          choice(
            "Wave",
            () => waveOptions,
            () => sound().wave,
            (value: Waveform) => {
              sound().wave = value;
              hearSound();
            },
          ),
          soundSlider("Pitch", pitchMin, pitchMax, 10, "pitch"),
          soundSlider("Slide to", pitchMin, pitchMax, 10, "slide"),
          slider(
            "Vibrato depth",
            0,
            12,
            0.5,
            () => sound().vibratoDepth,
            (value: number) => {
              sound().vibratoDepth = value;
              hearSound();
            },
          ),
          slider(
            "Vibrato rate",
            0,
            30,
            0.5,
            () => sound().vibratoRate,
            (value: number) => {
              sound().vibratoRate = value;
              hearSound();
            },
          ),
        ],
        () => sound().source === "synth",
      ),
      ...section(
        "Envelope",
        [
          soundSlider("Attack", 0, 0.5, 0.01, "attack"),
          soundSlider("Sustain", 0, 1, 0.01, "sustain"),
          soundSlider("Decay", 0.02, 2, 0.02, "decay"),
        ],
        () => sound().source === "synth",
      ),
    ],
    () => {
      const value: Sound = sound();

      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setSpell(null);
      plotSound(value);
      void loadAudio(value.file).then(() => {
        if (tab.name === "sound" && sound() === value) {
          plotSound(value);
        }
      });
    },
  );

  function plotSound(value: Sound): void {
    drawSound(
      soundPlot,
      value,
      soundPlotWidth,
      soundPlotHeight,
      getTheme().ring,
    );
    soundName.text =
      value.source === "file"
        ? (value.fileName || "NO FILE").toUpperCase()
        : "";
  }

  const audioPicker: HTMLInputElement = document.createElement("input");

  audioPicker.type = "file";
  audioPicker.accept = "audio/*";
  audioPicker.addEventListener("change", () => {
    useAudio(audioPicker.files?.[0]);
    audioPicker.value = "";
  });

  async function useAudio(file: File | undefined): Promise<void> {
    if (file === undefined || tab.name !== "sound") {
      return;
    }

    const value: Sound = sound();

    try {
      value.file = await importAudio(file);
      value.fileName = file.name;
      value.source = "file";
      changed();
      refresh();
      cleanup();
      playSound(value);
    } catch {
      window.alert(
        '"' + file.name + '" is not an audio file this browser can play.',
      );
    }
  }

  function promptText(
    label: string,
    value: string,
    limit: number,
    set: (value: string) => void,
  ): void {
    const typed: string | null = window.prompt(label, value);
    const name: string = cleanName(typed ?? "").slice(0, limit);

    if (name === "") {
      return;
    }

    set(name);
    changed();
    refresh();
  }

  function addEmotion(): void {
    const emotions: Array<Emotion> = character().emotions;

    emotions.push(defaultEmotion("Emotion " + (emotions.length + 1)));
    emotionIndex = emotions.length - 1;
    changed();
    refresh();
  }

  function removeEmotion(): void {
    const emotions: Array<Emotion> = character().emotions;
    const gone: Emotion = emotion();

    if (emotions.length <= 1) {
      return;
    }

    emotions.splice(emotionIndex, 1);

    for (const value of creations.cutscenes.flatMap(
      (item: Cutscene) => item.lines,
    )) {
      if (value.emotion === gone.id) {
        value.emotion = emotions[0]!.id;
      }
    }

    emotionIndex = Math.max(emotionIndex - 1, 0);
    changed();
    refresh();
    cleanup();
  }

  function buttonRow(name: string, action: () => void): Control {
    const row: Container = new Container();
    const button: Chip = createChip(name, rowWidth, action);

    button.view.y = (rowHeight - chipHeight) / 2;
    row.addChild(button.view);

    return { view: row, refresh: () => undefined };
  }

  addTab(
    "cutscene",
    () => creations.cutscenes,
    [
      ...cosmeticSection("cutscene"),
      ...section("Scene", [
        choice(
          "Voice",
          () => [
            { value: null, label: "None" },
            ...creations.sounds.map((value: Sound) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => cutscene().voice,
          (value: string | null) => {
            cutscene().voice = value;
          },
        ),
        slider(
          "Text speed",
          lineSpeedMin,
          lineSpeedMax,
          5,
          () => cutscene().speed,
          (value: number) => {
            cutscene().speed = value;
          },
        ),
      ]),
      ...section("Transcript", [
        buttonRow("Edit transcript", () =>
          editTranscript(
            formatTranscript(cutscene(), creations.characters),
            (text: string) => {
              const problem: string | null = applyTranscript(
                cutscene(),
                creations.characters,
                text,
              );

              if (problem === null) {
                changed();
                refresh();
              }

              return problem;
            },
          ),
        ),
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setSpell(null);
      playScene();
    },
  );

  addTab(
    "character",
    () => creations.characters,
    [
      ...cosmeticSection("character"),
      ...section("Character", [
        colors(
          "Name colour",
          brightColors,
          () => character().color,
          (value: string) => {
            character().color = value;
          },
        ),
      ]),
      ...section("Emotions", [
        actionRow("Add emotion", addEmotion, "Remove emotion", removeEmotion),
        choice(
          "Emotion",
          () =>
            character().emotions.map((value: Emotion, index: number) => ({
              value: index,
              label: value.name,
            })),
          () => emotionIndex,
          (value: number) => {
            emotionIndex = value;
          },
        ),
        buttonRow("Rename emotion", () =>
          promptText("Emotion", emotion().name, nameLength, (value: string) => {
            emotion().name = value;
          }),
        ),
        createSpriteRow(
          "Sprite",
          () => getTexture(emotion().sprite),
          () => picker.click(),
          () => {
            emotion().sprite = null;
            changed();
            refresh();
            cleanup();
          },
        ),
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setSpell(null);
      playScene();
    },
  );

  addTab(
    "stage",
    () => creations.stages,
    [
      ...section("Stage", [
        choice(
          "Difficulty",
          rarityOptions(difficulties),
          () => stage().difficulty,
          (value: Difficulty) => {
            stage().difficulty = value;
            renameDefault("stage", stage());
          },
        ),
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
              derivatives: source.derivatives.map((value: Vector) => ({
                ...value,
              })),
              waves: source.waves.map((value: Wave<Vector>) => ({
                ...value,
                amplitude: { ...value.amplitude },
              })),
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
        choice(
          "Mode",
          () => curveOptions,
          () => spawn().curve,
          (value: Curve) => {
            spawn().curve = value;
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
          shown: () =>
            spawn().curve === "polynomial" &&
            spawn().derivatives.length > order,
        })),
        {
          ...derivativeActions(
            () => spawn().derivatives,
            derivativeNames,
            () => ({ x: 0, y: 0 }),
          ),
          shown: () => spawn().curve === "polynomial",
        },
        ...waveRows(
          () => spawn().waves,
          (name: string, get: () => Vector, set: (value: Vector) => void) =>
            vector(
              name,
              -derivativeLimit,
              derivativeLimit,
              derivativeStep,
              get,
              set,
            ),
          () => ({ x: waveAmplitude, y: 0 }),
          () => spawn().curve === "sinusoidal",
          placeMarkers,
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

      if (
        (value.curve === "polynomial" ? value.derivatives : value.waves)
          .length > 0
      ) {
        guides.moveTo(x, y);

        for (let step = 1; step <= trailSteps; step++) {
          const [pointX, pointY] = motion(
            x,
            y,
            value,
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
    (category: Category) => createItem(category),
    (kind: Kind, index: number, action: Action) => {
      if (action === "rename") {
        renameItem(kind, index);
      } else if (action === "delete") {
        deleteItem(kind, index);
      }
    },
    { show: showCard, update: updateCard },
  );

  function showCard(kind: Kind, index: number): Container | null {
    const item: Item | undefined = listOf(kind)[index];

    cardPreview.clear();
    cardPreview.overlay.visible = false;
    cardPreview.setBackground(null);
    cardPreview.setPlayerVisible(false);

    if (item === undefined) {
      return null;
    }

    if (kind === "cutscene") {
      cardScene.play(item as Cutscene, 0);
      return cardScene.view;
    }

    if (kind === "pattern") {
      cardPreview.setPattern(item as Pattern);
    } else if (kind === "enemy") {
      const value: Enemy = item as Enemy;

      cardPreview.setEnemy(value, patternById(value.pattern), spellOf(value));
    } else if (kind === "spell") {
      cardPreview.setSpell(item as Spell);
    } else if (kind === "background") {
      cardPreview.setBackground(item as Background);
      cardPreview.setPattern(null);
    } else if (kind === "stage") {
      const value: Stage = item as Stage;

      cardPreview.setBackground(backgroundById(value.background));
      cardPreview.setPlayerVisible(true);
      cardPreview.setStage(null, resolve);
      cardPreview.setStage(value, resolve);
    } else {
      return null;
    }

    return cardPreview.view;
  }

  function updateCard(delta: number): void {
    if (cardScene.view.parent !== null) {
      cardScene.update(delta);
      return;
    }

    runClock(cardTicks, delta, cardPreview.update);
  }

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

    item.name = (
      kind === "character" ? cleanName(name) || item.name : name.trim()
    ).slice(0, nameLength);
    saveCreations(creations);
    gallery.refresh();
  }

  function deleteItem(kind: Kind, index: number): void {
    const item: Item | undefined = listOf(kind)[index];

    if (item === undefined || !window.confirm('Delete "' + item.name + '"?')) {
      return;
    }

    listOf(kind).splice(index, 1);
    forgetCosmetic(item.id);

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
  const ticks: Clock = createClock();
  let editing: boolean = false;
  let dropShown: boolean = false;

  function createItem(category: Category): void {
    const enemyId: string | null = creations.enemies[0]?.id ?? null;
    const backgroundId: string | null = creations.backgrounds[0]?.id ?? null;
    let index: number;

    if (category === "stage") {
      index = creations.stages.push(defaultStage(enemyId, backgroundId));
    } else if (category === "pattern") {
      index = creations.patterns.push(defaultPattern());
    } else if (category === "enemy") {
      index = creations.enemies.push(
        defaultEnemy(creations.patterns[0]?.id ?? null),
      );
    } else {
      index = creations.backgrounds.push(defaultBackground());
    }

    const kind: Kind = category === "cosmetic" ? "background" : category;
    const item: Item = listOf(kind)[index - 1]!;

    item.name = freshName(kind, item);

    saveCreations(creations);
    openItem(kind, index - 1);
  }

  function showItem(kind: Kind, index: number): void {
    if (playtesting) {
      setPlaytesting(false);
    }

    const next: Tab = tabs.find((value: Tab) => value.name === kind)!;

    next.selected = index;
    tab = next;
    spawnIndex = 0;
    keyIndex = 0;
    ringIndex = 0;
    emotionIndex = 0;
    sectionOpen.clear();
    laidOut = null;
    preview.clear();
    refresh();
  }

  function openItem(kind: Kind, index: number): void {
    editing = true;
    gallery.setActive(false);
    showItem(kind, index);
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
    if (playtesting) {
      setPlaytesting(false);
    }

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
  let playtesting: boolean = false;
  const held: Set<string> = new Set();
  const playtestBar: Container = new Container();
  const hitsText: Text = createText(clockSize, "#ffffff");
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

  function setPlaytesting(value: boolean): void {
    playtesting = value;
    held.clear();
    preview.setPlaytest(value);

    if (value) {
      playing = true;
      patternPlaying = true;
      drawPlayIcon();
    } else {
      tab.show();
    }

    playtestChip.paint();
  }

  function playtest(): void {
    if (tab.name === "sound") {
      playSound(sound());
      return;
    }

    if (scened()) {
      playScene();
      return;
    }

    setPlaytesting(!playtesting);
  }

  function heldAny(keys: Array<string>): boolean {
    return keys.some((key: string) => held.has(key));
  }

  function steer(): void {
    let x: number = (heldAny(rightKeys) ? 1 : 0) - (heldAny(leftKeys) ? 1 : 0);
    let y: number = (heldAny(downKeys) ? 1 : 0) - (heldAny(upKeys) ? 1 : 0);

    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }

    preview.steer(x, y, heldAny(focusKeys));
  }

  function pause(): void {
    playing = false;
    drawPlayIcon();
  }

  const playChip: Chip = createChip("", transportWidth, togglePlaying);
  const patternChip: Chip = createChip("", transportWidth, togglePlaying);
  const playtestChip: Chip = createChip(
    "playtest",
    playtestWidth,
    playtest,
    () => playtesting,
  );

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

  playtestBar.position.set(panelLeft, panelBottom - chipHeight);
  hitsText.anchor.set(1, 0.5);
  hitsText.position.set(rowWidth, chipHeight / 2);
  playtestBar.addChild(playtestChip.view, hitsText);

  playChip.view.addChild(playIcon);
  transport.addChild(playChip.view);
  drawPlayIcon();

  timeline.addChild(track, clock, total, transport);
  drawFrame(hudFrame);
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
  board.addChild(preview.view, soundPlot, scene.view);
  soundPlot.position.set(
    (fieldWidth - soundPlotWidth) / 2,
    (fieldHeight - soundPlotHeight) / 2,
  );
  soundName.anchor.set(0.5, 0);
  soundName.position.set(soundPlotWidth / 2, soundPlotHeight + soundNameGap);
  soundPlot.addChild(soundName);
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
    hudFrame,
    panelBack,
    board,
    controls,
    timeline,
    patternBar,
    playtestBar,
    frameMask,
  );
  gameFrame.mask = frameMask;
  editor.addChild(backdrop.view, gameFrame);
  view.addChild(editor, gallery.view, drop);

  function hasFiles(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes("Files") ?? false;
  }

  function showDrop(value: boolean): void {
    dropShown =
      value &&
      active &&
      editing &&
      (tab.name === "sound" ||
        tab.name === "character" ||
        current().sprite !== undefined);
    dropText.text =
      tab.name === "sound"
        ? "DROP AUDIO FILE FOR SOUND"
        : tab.name === "character"
          ? "DROP IMAGE FOR EMOTION SPRITE"
          : "DROP IMAGE FOR " + tab.name.toUpperCase() + " SPRITE";
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

    if (active && editing && tab.name === "sound") {
      useAudio(event.dataTransfer?.files[0]);
    } else if (active && editing) {
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
    const bottom: number = panelBottom - chipHeight - sectionGap;

    backdrop.layout();
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
      backdrop.update(delta);
      animateRows(delta);
      animateScroll(delta);
    }

    drop.alpha = approach(drop.alpha, dropShown ? 1 : 0, delta / dropFade);
    drop.visible = drop.alpha > 0;

    if (!editing) {
      return;
    }

    preview.overlay.visible = tab.name === "stage" && !playing;

    soundPlot.visible = tab.name === "sound";
    scene.view.visible = scened();

    if (scened()) {
      scene.update(delta);
    }
    hitsText.visible = playtesting;
    hitsText.text = "HITS " + preview.hits();

    if (playtesting) {
      steer();
    }

    if (
      playtesting ||
      (tab.name === "stage"
        ? playing
        : tab.name !== "pattern" || patternPlaying)
    ) {
      runClock(
        ticks,
        Math.min(ticker.deltaMS / 1000, maxDelta),
        preview.update,
      );
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

    if (event.code === "KeyP" && typing === null) {
      playtest();
      event.preventDefault();
      return;
    }

    if (playtesting && movementKeys.includes(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }

    if (tab.name === "sound" && event.code === "Space") {
      playSound(sound());
      event.preventDefault();
      return;
    }

    if (scened() && event.code === "Space") {
      scene.advance();
      event.preventDefault();
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

  window.addEventListener("keyup", (event: KeyboardEvent) => {
    held.delete(event.code);
  });

  window.addEventListener("blur", () => {
    held.clear();
  });

  function setActive(value: boolean): void {
    if (!value && playtesting) {
      setPlaytesting(false);
    }

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

    if (playtesting) {
      setPlaytesting(false);
      return true;
    }

    showSelector();
    return true;
  }

  tab.panel.visible = true;
  refresh();
  Promise.all([
    ...[...usedSprites(creations)].map(loadTexture),
    ...creations.sounds.map((value: Sound) => loadAudio(value.file)),
  ]).then(() => {
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
