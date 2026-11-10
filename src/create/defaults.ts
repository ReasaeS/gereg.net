import type {
  Drops,
  Rank,
  GameSounds,
  Pattern,
  Enemy,
  Bar,
  Background,
  Wallpaper,
  Bullet,
  Vessel,
  Build,
  Palette,
  Ring,
  Sigil,
  Spell,
  Sound,
  Emotion,
  Character,
  Line,
  Cutscene,
  Spawn,
  Keyframe,
  Stage,
  Run,
  Game,
  Ost,
  Difficulty,
  Creations,
  Effect,
  EffectDrop,
  World,
  Modifier,
} from "./types";
import { createPixels, encodePixels, type Pixels } from "../editor/pixels";
import { spriteSize } from "../editor/drawings";
import { drawBulletDefault, drawVesselDefault } from "../editor/default";
import { defaultScore } from "./arrange";
import { defaultAmbience } from "./ambience";
import { buildPixels, defaultBuild, repairBuild } from "./hangar";
import { repairStat } from "./effects";

function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultPattern(): Pattern {
  return {
    id: createId(),
    name: "Ring",
    bullet: null,
    size: 18,
    color: "#ff3b3b",
    count: 16,
    spread: 360,
    heading: 0,
    aim: false,
    frame: "subjective",
    wall: "top",
    gapShift: 0,
    gapPhaseShift: 0,
    cover: 1,
    gapFrequency: 0,
    gapWidth: 0.1,
    angleDerivatives: [30],
    rate: 2,
    speed: 120,
    velocity: { x: 0, y: 120 },
    speedDerivatives: new Array(),
    driftDerivatives: new Array(),
    curve: "polynomial",
    angleWaves: new Array(),
    aimCurve: "polynomial",
    aimWaves: new Array(),
    swayWaves: new Array(),
    fireSound: effectSound("fire"),
  };
}

function defaultEnemy(pattern: string | null): Enemy {
  return {
    id: createId(),
    name: "Fairy",
    vessel: null,
    color: "#7ad8ff",
    size: 28,
    rank: "regular",
    pattern: pattern,
    theme: null,
    defeatSound: effectSound("defeat"),
    drops: rankDrops("regular"),
    effects: new Array(),
    bars: [defaultBar(20)],
  };
}

function rankDrops(rank: Rank): Drops {
  return {
    power: rank === "regular" ? 1 : 4,
    point: rank === "regular" ? 1 : rank === "subboss" ? 4 : 8,
    big: rank === "boss" ? 1 : 0,
    life: 0,
    lifepiece: 0,
    bomb: 0,
    bombpiece: rank === "regular" ? 0 : 1,
  };
}

function defaultBar(health: number): Bar {
  return {
    id: createId(),
    health: health,
    time: 30,
    spell: null,
    attack: null,
    move: null,
    appears: "always",
  };
}

function defaultBackground(): Background {
  return {
    id: createId(),
    name: "Night Sea",
    sprite: null,
    top: "#031448",
    bottom: "#01030a",
    scroll: 60,
    layers: new Array(),
  };
}

function defaultWallpaper(): Wallpaper {
  return {
    id: createId(),
    name: "Midnight",
    motif: "stripes",
    base: "#030c2a",
    ink: "#0a2160",
    size: 4,
    spacing: 10,
    angle: 45,
  };
}

function defaultBullet(): Bullet {
  return {
    id: createId(),
    name: "Spark",
    look: "energy",
    pixels: defaultBulletPixels(),
    shape: "orb",
    glow: "#ff3b3b",
    core: "#ffffff",
    coreSize: 0.5,
    glowSize: 0.4,
    length: 1,
  };
}

const bulletSide: number = 16; // px

function defaultBulletPixels(): string {
  const pixels: Pixels = createPixels(bulletSide);

  drawBulletDefault(pixels);

  return encodePixels(pixels);
}

function repairBullet(bullet: Bullet): void {
  const stale: Bullet & Record<string, unknown> = bullet;

  bullet.look = bullet.look === "sprite" ? "sprite" : "energy";
  bullet.pixels =
    typeof bullet.pixels === "string" ? bullet.pixels : defaultBulletPixels();
  delete stale["spin"];
  delete stale["pulse"];
}

const vesselScales: Array<number> = [1, 2, 4];

function vesselSide(vessel: Vessel): number {
  return spriteSize * vessel.scale;
}

function defaultVesselPixels(): string {
  const pixels: Pixels = createPixels(spriteSize);

  drawVesselDefault(pixels);

  return encodePixels(pixels);
}

function defaultVessel(): Vessel {
  const build: Build = defaultBuild();

  return {
    id: createId(),
    name: "Wasp",
    scale: 1,
    pixels: buildPixels(build, spriteSize),
    look: "built",
    build: build,
  };
}

function repairVessel(vessel: Vessel): void {
  const stale: Vessel & Record<string, unknown> = vessel;

  vessel.scale = vessel.scale ?? 1;
  vessel.look = vessel.look === "built" ? "built" : "drawn";
  vessel.build = repairBuild(vessel.build);

  if (
    !vesselScales.includes(vessel.scale) ||
    typeof vessel.pixels !== "string"
  ) {
    vessel.scale = 1;
    vessel.pixels = defaultVesselPixels();
  }

  for (const key of [
    "model",
    "cells",
    "body",
    "trim",
    "glow",
    "pieces",
    "structure",
    "hull",
    "length",
    "width",
    "cockpit",
    "wings",
    "span",
    "engines",
    "thrust",
    "guns",
    "compartments",
    "mirror",
  ]) {
    delete stale[key];
  }
}

function repairEnemy(enemy: Enemy): void {
  const stale: Enemy & { sprite?: unknown; ship?: string | null } = enemy;

  enemy.vessel = enemy.vessel ?? stale.ship ?? null;
  enemy.effects = (enemy.effects ?? new Array()).map((drop: EffectDrop) => ({
    effect: drop.effect ?? null,
    chance: drop.chance ?? 0,
  }));
  delete stale.sprite;
  delete stale.ship;
}

function defaultEffect(): Effect {
  return {
    id: createId(),
    name: "Effect",
    color: "#7ae38f",
    mode: "timed",
    duration: 10,
    action: "clear",
    hits: 1,
    stacks: 3,
    cleanse: "graze",
    cleanseTime: 0.5,
    ramp: "fade",
    aura: "slow",
    auraRadius: 60,
    auraSlow: 50,
    modifiers: [{ stat: "fireRate", amount: 50 }],
    world: new Array(),
    pickupSound: effectSound("power"),
  };
}

function repairEffect(effect: Effect): void {
  const legacy: { target?: unknown } = effect as { target?: unknown };

  delete legacy.target;
  effect.color = effect.color ?? "#7ae38f";
  effect.duration = effect.duration ?? 10;
  effect.mode = effect.mode ?? "timed";
  effect.action = effect.action ?? "clear";
  effect.hits = effect.hits ?? 1;
  effect.stacks = effect.stacks ?? 3;
  effect.cleanse = effect.cleanse ?? "graze";
  effect.cleanseTime = effect.cleanseTime ?? 0.5;
  effect.ramp = effect.ramp ?? "fade";
  effect.aura = effect.aura ?? "slow";
  effect.auraRadius = effect.auraRadius ?? 60;
  effect.auraSlow = effect.auraSlow ?? 50;
  effect.world = (effect.world ?? new Array()).map((world: World) => ({
    kind: world.kind ?? "freeze",
    strength: world.strength ?? 100,
    angle: world.angle ?? 0,
    color: world.color ?? "#ffffff",
  }));
  effect.modifiers = (effect.modifiers ?? new Array()).map(
    (modifier: Modifier) => ({
      stat: repairStat(modifier.stat),
      amount: modifier.amount ?? 0,
    }),
  );

  if (effect.pickupSound === undefined) {
    effect.pickupSound = effectSound("power");
  }
}

function defaultPalette(): Palette {
  return {
    id: createId(),
    name: "Lighthouse",
    accent: "#ff2a4d",
    highlight: "#ffffff",
    text: "#ffffff",
    label: "#9fd8ff",
  };
}

function defaultRing(): Ring {
  return {
    radius: 150,
    points: 6,
    step: 2,
    ticks: 36,
    orb: 0.07,
    spin: 20,
  };
}

function defaultSigil(): Sigil {
  return {
    id: createId(),
    name: "Seal",
    color: "#ff6fd8",
    opacity: 0.6,
    rings: [
      defaultRing(),
      { radius: 90, points: 8, step: 3, ticks: 24, orb: 0.06, spin: -30 },
    ],
  };
}

function defaultSpell(sigil: string): Spell {
  return {
    id: createId(),
    name: "Spell",
    sigil: sigil,
    background: null,
    pattern: null,
    declareSound: effectSound("declare"),
    survival: false,
  };
}

function limitBars(enemy: Enemy): void {
  if (enemy.rank !== "subboss" || enemy.bars.length <= 1) {
    return;
  }

  enemy.bars = [
    enemy.bars.find((bar: Bar) => bar.spell !== null) ?? enemy.bars[0]!,
  ];
}

function repairSpells(creations: Creations): void {
  const sigils: Set<string> = new Set(
    creations.sigils.map((sigil: Sigil) => sigil.id),
  );

  for (const spell of creations.spells) {
    if (sigils.has(spell.sigil)) {
      continue;
    }

    if (creations.sigils.length === 0) {
      const sigil: Sigil = defaultSigil();

      creations.sigils.push(sigil);
      sigils.add(sigil.id);
    }

    spell.sigil = creations.sigils[0]!.id;
  }
}

function repairPacks(creations: Creations): void {
  const stages: Map<string, Difficulty> = new Map(
    creations.stages.map((stage: Stage) => [stage.id, stage.difficulty]),
  );
  const runs: Map<string, Difficulty> = new Map(
    creations.runs.map((run: Run) => [run.id, run.difficulty]),
  );

  for (const run of creations.runs) {
    run.stages = run.stages.map((id: string | null) =>
      id !== null && stages.get(id) === run.difficulty ? id : null,
    );
  }

  for (const game of creations.games) {
    for (const difficulty of Object.keys(game.runs) as Array<Difficulty>) {
      const id: string | null = game.runs[difficulty];

      game.runs[difficulty] =
        id !== null && runs.get(id) === difficulty ? id : null;
    }
  }
}

function defaultSound(): Sound {
  return {
    id: createId(),
    name: "Chime",
    source: "synth",
    file: null,
    fileName: "",
    wave: "square",
    pitch: 880,
    slide: 440,
    attack: 0.01,
    sustain: 0.05,
    decay: 0.25,
    vibratoDepth: 0,
    vibratoRate: 8,
    volume: 0.5,
    score: defaultScore(),
    ambience: defaultAmbience(),
  };
}

function defaultEmotion(name: string, sprite: string | null = null): Emotion {
  return { id: createId(), name: name, sprite: sprite };
}

const characterColors: Array<string> = ["#7ad8ff", "#ff6fd8"];

function defaultCharacter(
  name: string,
  order: number = 0,
  sprite: string | null = null,
): Character {
  return {
    id: createId(),
    name: name,
    color: characterColors[order % characterColors.length]!,
    emotions: [defaultEmotion("Neutral", sprite)],
  };
}

function repairCharacter(character: Character): void {
  const stale: Character & { mode?: unknown; look?: unknown } = character;

  delete stale.mode;
  delete stale.look;

  for (const emotion of character.emotions) {
    delete (emotion as Emotion & { face?: unknown }).face;
  }
}

function repairWallpaper(wallpaper: Wallpaper): void {
  const stale: Wallpaper & {
    sprite?: unknown;
    stripe?: string;
    stripes?: number;
  } = wallpaper;

  wallpaper.motif = wallpaper.motif ?? "stripes";
  wallpaper.ink = wallpaper.ink ?? stale.stripe ?? wallpaper.base;
  wallpaper.size = wallpaper.size ?? Math.round((stale.stripes ?? 0) * 0.7);
  wallpaper.spacing = wallpaper.spacing ?? 10;
  wallpaper.angle = wallpaper.angle ?? 45;
  delete stale.sprite;
  delete stale.stripe;
  delete stale.stripes;
}

function defaultLine(character: Character, text: string): Line {
  return {
    id: createId(),
    character: character.id,
    emotion: character.emotions[0]!.id,
    text: text,
  };
}

function defaultCutscene(cast: Array<Character>): Cutscene {
  const first: Character | undefined = cast[0];
  const second: Character | undefined = cast[1] ?? first;

  return {
    id: createId(),
    name: "Meeting",
    voice: null,
    background: null,
    speed: 30,
    lines:
      first === undefined || second === undefined
        ? [{ id: createId(), character: "", emotion: "", text: "..." }]
        : [
            defaultLine(first, "Who's out there in this weather?"),
            defaultLine(second, "Only the rain. Turn back while you can."),
          ],
  };
}

const derivativeNames: Array<string> = [
  "velocity",
  "acceleration",
  "jolt",
  "snap",
  "crackle",
  "pop",
];
const defaultSpawnY: number = 0.27;

function defaultSpawn(enemy: string | null, x: number): Spawn {
  return {
    id: createId(),
    enemy: enemy,
    x: x,
    y: defaultSpawnY,
    derivatives: new Array(),
    curve: "polynomial",
    waves: new Array(),
    count: 1,
    gap: 1,
  };
}

function defaultKeyframe(
  time: number,
  spawns: Array<Spawn>,
  cutscene: string | null = null,
): Keyframe {
  return { id: createId(), time: time, spawns: spawns, cutscene: cutscene };
}

function defaultStage(
  enemy: string | null,
  background: string | null,
  wallpaper: string | null = null,
  palette: string | null = null,
): Stage {
  return {
    id: createId(),
    name: "Stage",
    background: background,
    wallpaper: wallpaper,
    palette: palette,
    music: null,
    difficulty: "normal",
    length: 30,
    keyframes: [
      defaultKeyframe(1, [defaultSpawn(enemy, 0.5)]),
      defaultKeyframe(7, [
        {
          ...defaultSpawn(enemy, 0.25),
          y: -0.05,
          derivatives: [{ x: 0, y: 90 }],
          count: 3,
          gap: 0.8,
        },
        {
          ...defaultSpawn(enemy, 0.75),
          y: -0.05,
          derivatives: [{ x: 0, y: 90 }],
          count: 3,
          gap: 0.8,
        },
      ]),
    ],
    titleCard: true,
  };
}

function defaultRun(difficulty: Difficulty, stages: Array<string>): Run {
  return {
    id: createId(),
    name: "Run",
    difficulty: difficulty,
    stages: stages.length === 0 ? [null] : stages,
  };
}

function defaultGame(): Game {
  return {
    id: createId(),
    name: "Game",
    runs: { easy: null, normal: null, hard: null, lunatic: null },
    ost: null,
    sounds: defaultGameSounds(),
    extends: defaultExtends(),
  };
}

function defaultExtends(): Array<number> {
  return [1000000, 2500000, 5000000, 0];
}

function effectSound(name: string): string {
  return "sfx-" + name;
}

function defaultGameSounds(): GameSounds {
  return {
    graze: effectSound("graze"),
    item: effectSound("item"),
    power: effectSound("power"),
    miss: effectSound("miss"),
    capture: effectSound("capture"),
    timeout: effectSound("timeout"),
    cancel: effectSound("cancel"),
    extend: effectSound("extend"),
    bombget: effectSound("bombget"),
  };
}

function emptyCreations(): Creations {
  return {
    stages: new Array(),
    runs: new Array(),
    games: new Array(),
    patterns: new Array(),
    enemies: new Array(),
    backgrounds: new Array(),
    wallpapers: new Array(),
    bullets: new Array(),
    vessels: new Array(),
    palettes: new Array(),
    sigils: new Array(),
    spells: new Array(),
    sounds: new Array(),
    osts: new Array(),
    characters: new Array(),
    cutscenes: new Array(),
    effects: new Array(),
    dice: {},
  };
}

function defaultOst(tracks: Array<string>): Ost {
  return {
    id: createId(),
    name: "OST",
    tracks: (tracks.length === 0 ? [null] : tracks).map(
      (sound: string | null) => ({
        sound: sound,
        background: null,
        wallpaper: null,
      }),
    ),
  };
}

export {
  emptyCreations,
  effectSound,
  defaultGameSounds,
  bulletSide,
  repairBullet,
  vesselScales,
  vesselSide,
  defaultSpawnY,
  createId,
  defaultPattern,
  defaultEnemy,
  defaultBar,
  rankDrops,
  defaultExtends,
  defaultBackground,
  defaultWallpaper,
  defaultBullet,
  defaultVessel,
  repairVessel,
  repairEnemy,
  defaultEffect,
  repairEffect,
  repairWallpaper,
  defaultPalette,
  defaultRing,
  defaultSigil,
  defaultSpell,
  repairSpells,
  repairPacks,
  limitBars,
  defaultSound,
  defaultEmotion,
  defaultCharacter,
  repairCharacter,
  defaultLine,
  defaultCutscene,
  derivativeNames,
  defaultSpawn,
  defaultKeyframe,
  defaultStage,
  defaultRun,
  defaultGame,
  defaultOst,
};
