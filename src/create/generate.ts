import type {
  Background,
  Bar,
  Bullet,
  Creations,
  Enemy,
  Keyframe,
  Motif,
  Palette,
  Pattern,
  Rank,
  Shape,
  Sigil,
  Sound,
  Spawn,
  Spell,
  Stage,
  Vector,
  Vessel,
  Wallpaper,
  Wave,
} from "./types";
import {
  createId,
  defaultBullet,
  legacyGlows,
  defaultEnemy,
  defaultPalette,
  defaultPattern,
  defaultSigil,
  defaultSpell,
  defaultWallpaper,
  rankDrops,
  vesselSide,
} from "./defaults";
import { buildPixels, randomBuild } from "./hangar";
import { randomizeBackground } from "./scenery";
import { isMusic } from "./sound";

type Random = () => number;

type Recipe = "ring" | "fan" | "spiral" | "stream" | "rain";

type Made = {
  creations: Creations;
  random: Random;
  bullets: Array<string>;
  sigil: string | null;
};

const regularCount: number = 3;
const bulletCount: number = 2;
const offTop: number = -0.05;
const offSide: number = 0.05;
const bossHeight: number = 0.24;
const waveStart: number = 2; // s
const bossLead: number = 2; // s
const wavesStop: number = 14; // s
const midbossShare: number = 0.45;
const midbossClear: number = 3; // s
const recipes: Array<Recipe> = ["ring", "fan", "spiral", "stream", "rain"];
const shapes: Array<Shape> = [
  "orb",
  "rice",
  "star",
  "kunai",
  "ring",
  "heart",
  "diamond",
];
const motifs: Array<Motif> = [
  "stripes",
  "checks",
  "dots",
  "grid",
  "diamonds",
  "zigzag",
  "waves",
];
const firstWords: Array<string> = [
  "Crimson",
  "Hollow",
  "Silver",
  "Drifting",
  "Ashen",
  "Velvet",
  "Sunken",
  "Glass",
  "Midnight",
  "Copper",
  "Starlit",
  "Frozen",
];
const secondWords: Array<string> = [
  "Comet",
  "Orchard",
  "Tide",
  "Garden",
  "Harbour",
  "Choir",
  "Moth",
  "Signal",
  "Meadow",
  "Mirror",
  "Spire",
  "Reverie",
];
const foeWords: Array<string> = [
  "Wisp",
  "Shrike",
  "Mote",
  "Gnat",
  "Warden",
  "Sentry",
  "Husk",
  "Kite",
  "Ember",
  "Hornet",
];
const titles: Array<string> = [
  "Keeper",
  "Herald",
  "Witch",
  "Engineer",
  "Oracle",
  "Tyrant",
  "Seraph",
  "Gardener",
];
const spellWords: Array<string> = ["Sign", "Hymn", "Rite", "Omen", "Dream"];
const brights: Array<string> = [
  "#ff3b3b",
  "#ff8a80",
  "#ffb347",
  "#fff27a",
  "#7ae38f",
  "#7ad8ff",
  "#3b82ff",
  "#b48aff",
  "#ff6fd8",
  "#54e0c0",
];
const darks: Array<string> = [
  "#01040f",
  "#030c2a",
  "#0a2160",
  "#1e0a2e",
  "#4a1a5c",
  "#2a0a14",
  "#0a2a1a",
];

function pick<T>(list: Array<T>, random: Random): T {
  return list[Math.floor(random() * list.length)]!;
}

function range(min: number, max: number, random: Random): number {
  return min + random() * (max - min);
}

function whole(min: number, max: number, random: Random): number {
  return Math.floor(range(min, max + 1, random));
}

function sign(random: Random): number {
  return random() < 0.5 ? -1 : 1;
}

function wave<T>(amplitude: T, frequency: number): Wave<T> {
  return {
    amplitude: amplitude,
    frequency: frequency,
    phase: 0,
    phaseShift: 0,
  };
}

function makeBullet(made: Made): string {
  const shape: Shape = pick(shapes, made.random);
  const bullet: Bullet = {
    ...defaultBullet(),
    id: createId(),
    name: shape.charAt(0).toUpperCase() + shape.slice(1) + " Shot",
    look: "energy",
    shape: shape,
    glows: legacyGlows(pick(brights, made.random), "#ffffff", 0.5, 0.4),
    length: shape === "rice" || shape === "kunai" ? 2 : 1,
  };

  made.creations.bullets.push(bullet);

  return bullet.id;
}

function makePattern(made: Made, dense: boolean): string {
  const random: Random = made.random;
  const recipe: Recipe = pick(recipes, random);
  const boost: number = dense ? 1.5 : 1;
  const shapes: Record<Recipe, Partial<Pattern>> = {
    ring: {
      name: "Ring",
      spread: 360,
      count: Math.round(whole(10, 18, random) * boost),
      rate: range(0.5, 1, random) * boost,
      speed: whole(80, 120, random),
      angleDerivatives: [whole(-40, 40, random)],
    },
    fan: {
      name: "Fan",
      aim: true,
      count: Math.round(whole(3, 7, random) * boost),
      spread: whole(20, 60, random),
      rate: range(0.8, 1.5, random) * boost,
      speed: whole(110, 160, random),
      angleDerivatives: new Array(),
    },
    spiral: {
      name: "Spiral",
      spread: 360,
      count: whole(2, 5, random),
      rate: range(4, 8, random) * boost,
      speed: whole(90, 130, random),
      angleDerivatives: [whole(120, 240, random) * sign(random)],
    },
    stream: {
      name: "Stream",
      aim: true,
      count: 1,
      spread: 0,
      rate: range(2, 4, random) * boost,
      speed: whole(150, 200, random),
      angleDerivatives: new Array(),
    },
    rain: {
      name: "Rain",
      frame: "objective",
      wall: "top",
      cover: 1,
      gapFrequency: 1,
      gapWidth: range(0.15, 0.3, random),
      count: Math.round(whole(6, 12, random) * boost),
      rate: range(0.6, 1.2, random) * boost,
      velocity: { x: whole(-20, 20, random), y: whole(90, 140, random) },
      angleDerivatives: new Array(),
    },
  };
  const pattern: Pattern = {
    ...defaultPattern(),
    ...shapes[recipe],
    id: createId(),
    bullet: pick(made.bullets, random),
    color: pick(brights, random),
    size: whole(12, 20, random),
  };

  pattern.rate = Math.round(pattern.rate * 100) / 100;
  made.creations.patterns.push(pattern);

  return pattern.id;
}

function makeVessel(made: Made, name: string, scale: number): string {
  const vessel: Vessel = {
    id: createId(),
    name: name,
    scale: scale,
    pixels: "",
    look: "built",
    build: randomBuild(made.random),
  };

  vessel.pixels = buildPixels(vessel.build, vesselSide(vessel));
  made.creations.vessels.push(vessel);

  return vessel.id;
}

function sigilOf(made: Made, title: string): string {
  if (made.sigil === null) {
    const sigil: Sigil = {
      ...defaultSigil(),
      id: createId(),
      name: title + " Seal",
      color: pick(brights, made.random),
    };

    made.creations.sigils.push(sigil);
    made.sigil = sigil.id;
  }

  return made.sigil;
}

function bar(health: number, time: number, spell: string | null): Bar {
  return {
    id: createId(),
    health: health,
    time: time,
    spell: spell,
    attack: null,
    move: null,
    appears: "always",
  };
}

function makeEnemy(made: Made, rank: Rank, title: string): string {
  const random: Random = made.random;
  const large: boolean = rank !== "regular";
  const name: string = large
    ? "The " + pick(firstWords, random) + " " + pick(titles, random)
    : pick(foeWords, random);
  const vessel: string = makeVessel(
    made,
    name + " Hull",
    large ? (random() < 0.5 ? 2 : 4) : 1,
  );
  const health: number = whole(6, 10, random) * 100;
  const bars: Array<Bar> =
    rank === "regular"
      ? [bar(whole(8, 30, random), 30, null)]
      : rank === "subboss"
        ? [bar(Math.round(health * 0.6), 25, null)]
        : [
            bar(health, whole(30, 36, random), null),
            ...new Array(whole(1, 3, random))
              .fill(0)
              .map((_: number, order: number) => {
                const spell: Spell = {
                  ...defaultSpell(sigilOf(made, title)),
                  id: createId(),
                  name:
                    pick(secondWords, random) + " " + pick(spellWords, random),
                  pattern: makePattern(made, true),
                };

                made.creations.spells.push(spell);

                return bar(
                  health + (order + 1) * 100,
                  whole(36, 46, random),
                  spell.id,
                );
              }),
          ];
  const enemy: Enemy = {
    ...defaultEnemy(makePattern(made, large)),
    id: createId(),
    name: rank === "subboss" ? name + ", Scouting" : name,
    rank: rank,
    vessel: vessel,
    color: pick(brights, random),
    size: large ? 56 : 28,
    drops: rankDrops(rank),
    bars: bars,
  };

  made.creations.enemies.push(enemy);

  return enemy.id;
}

function motion(foe: string, random: Random): Array<Spawn> {
  const count: number = whole(2, 5, random);
  const fromLeft: boolean = random() < 0.5;
  const spawn: (x: number, y: number, settings: Partial<Spawn>) => Spawn = (
    x: number,
    y: number,
    settings: Partial<Spawn>,
  ): Spawn => ({
    id: createId(),
    enemy: foe,
    x: x,
    y: y,
    derivatives: new Array(),
    curve: "polynomial",
    waves: new Array(),
    count: 1,
    gap: 1,
    ...settings,
  });
  const moves: Array<() => Array<Spawn>> = [
    () => [
      spawn(range(0.2, 0.8, random), offTop, {
        derivatives: [{ x: 0, y: whole(80, 120, random) }],
        count: count,
        gap: 0.75,
      }),
    ],
    () => [
      spawn(fromLeft ? -offSide : 1 + offSide, range(0.1, 0.25, random), {
        derivatives: [{ x: fromLeft ? 105 : -105, y: 18 }],
        count: count,
        gap: 0.9,
      }),
    ],
    () =>
      [true, false].map((left: boolean) =>
        spawn(left ? 0.1 : 0.9, offTop, {
          derivatives: [
            { x: left ? 55 : -55, y: 140 },
            { x: left ? 25 : -25, y: -55 },
          ],
          count: Math.max(1, count - 1),
          gap: 0.7,
        }),
      ),
    () => [
      spawn(range(0.3, 0.7, random), offTop, {
        derivatives: [
          { x: 0, y: 95 },
          { x: 0, y: -24 },
        ],
      }),
    ],
    () => [
      spawn(range(0.3, 0.7, random), offTop, {
        curve: "sinusoidal",
        waves: [
          wave<Vector>({ x: whole(50, 90, random), y: 0 }, 0.4),
          wave<Vector>({ x: 0, y: 560 }, 0.04),
        ],
        count: count,
        gap: 0.8,
      }),
    ],
  ];

  return pick(moves, random)();
}

function bossSpawn(foe: string): Spawn {
  return {
    id: createId(),
    enemy: foe,
    x: 0.5,
    y: bossHeight,
    derivatives: new Array(),
    curve: "sinusoidal",
    waves: [
      wave<Vector>({ x: 72, y: 0 }, 0.11),
      wave<Vector>({ x: 0, y: 14 }, 0.23),
    ],
    count: 1,
    gap: 1,
  };
}

function keyframe(time: number, spawns: Array<Spawn>): Keyframe {
  return { id: createId(), time: time, spawns: spawns, cutscene: null };
}

function generateStage(
  creations: Creations,
  random: Random = Math.random,
): Stage {
  const title: string =
    pick(firstWords, random) + " " + pick(secondWords, random);
  const made: Made = {
    creations: creations,
    random: random,
    bullets: new Array(),
    sigil: null,
  };
  const background: Background = {
    id: createId(),
    name: title,
    sprite: null,
    top: "#000000",
    bottom: "#000000",
    scroll: 0,
    layers: new Array(),
  };
  const wallpaper: Wallpaper = {
    ...defaultWallpaper(),
    id: createId(),
    name: title,
    motif: pick(motifs, random),
    base: pick(darks, random),
    ink: pick(darks, random),
    size: whole(2, 8, random),
    spacing: whole(6, 16, random),
    angle: whole(0, 7, random) * 15,
  };
  const palette: Palette = {
    ...defaultPalette(),
    id: createId(),
    name: title,
    accent: pick(brights, random),
    label: pick(brights, random),
  };
  const music: Array<Sound> = creations.sounds.filter(isMusic);

  randomizeBackground(background, random);
  creations.backgrounds.push(background);
  creations.wallpapers.push(wallpaper);
  creations.palettes.push(palette);

  for (let index = 0; index < bulletCount; index++) {
    made.bullets.push(makeBullet(made));
  }

  const cast: Array<string> = new Array(regularCount)
    .fill(0)
    .map(() => makeEnemy(made, "regular", title));
  const midboss: string = makeEnemy(made, "subboss", title);
  const boss: string = makeEnemy(made, "boss", title);
  const length: number = whole(5, 7, random) * 10;
  const midbossTime: number = Math.round(length * midbossShare);
  const keyframes: Array<Keyframe> = new Array();

  for (
    let time = waveStart;
    time <= length - wavesStop;
    time += whole(5, 7, random)
  ) {
    if (Math.abs(time - midbossTime) >= midbossClear) {
      keyframes.push(keyframe(time, motion(pick(cast, random), random)));
    }
  }

  keyframes.push(
    keyframe(midbossTime, [bossSpawn(midboss)]),
    keyframe(length - bossLead, [bossSpawn(boss)]),
  );
  keyframes.sort(
    (first: Keyframe, second: Keyframe) => first.time - second.time,
  );

  const stage: Stage = {
    id: createId(),
    name: title,
    background: background.id,
    wallpaper: wallpaper.id,
    palette: palette.id,
    music: music.length === 0 ? null : pick(music, random).id,
    difficulty: "normal",
    length: length,
    keyframes: keyframes,
    titleCard: true,
  };

  creations.stages.push(stage);

  return stage;
}

export { generateStage };
