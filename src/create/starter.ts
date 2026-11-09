import type {
  Background,
  Bar,
  Character,
  Creations,
  Cutscene,
  Difficulty,
  Enemy,
  Game,
  Keyframe,
  Line,
  Ost,
  Palette,
  Pattern,
  Run,
  Sigil,
  Spawn,
  Spell,
  Stage,
  Vector,
  Wallpaper,
  Wave,
} from "./types";
import {
  defaultExtends,
  defaultGameSounds,
  defaultPattern,
  effectSound,
  rankDrops,
} from "./defaults";
import { soundIds, starterSounds } from "./startersongs";
import { starterBullets, starterVessels } from "./starterart";

type BarPlan = [number, number, string | null];

type Foe = {
  key: string;
  name: string;
  vessel: string;
  color: string;
  size: number; // units
  rank: Enemy["rank"];
  pattern: string;
  theme: string | null;
  bars: Array<BarPlan>;
};

type Charm = {
  key: string;
  name: string;
  sigil: string;
  background: string;
  pattern: string;
};

type Stagecraft = {
  key: string;
  name: string;
  background: string;
  wallpaper: string;
  palette: string;
  music: string;
  length: number; // s
  waves: (tier: number) => Array<Keyframe>;
  cues: Array<[number, string]>;
};

const wildCount: number = 1.35;
const wildRate: number = 1.15;
const wildSpeed: number = 1.08;
const wildGap: number = 0.85;
const wildHealth: number = 1.25;
const wildTier: number = 2;
const offTop: number = -0.05;
const offSide: number = 0.05;
const bossHeight: number = 0.24;
const tiers: Array<[Difficulty, string]> = [
  ["easy", "Easy"],
  ["normal", "Normal"],
  ["hard", "Hard"],
  ["lunatic", "Lunatic"],
];
const emotions: Array<string> = ["Neutral", "Happy", "Angry", "Surprised"];
const bulletOf: Record<string, string> = {
  orb: "lamp-bullet-orb",
  rice: "lamp-bullet-rice",
  star: "lamp-bullet-star",
  kunai: "lamp-bullet-kunai",
  ring: "lamp-bullet-ring",
  heart: "lamp-bullet-heart",
  diamond: "lamp-bullet-diamond",
  drop: "lamp-bullet-drop",
  flame: "lamp-bullet-flame",
};
const gull: string = "lamp-vessel-gull";
const buoy: string = "lamp-vessel-buoy";
const skiff: string = "lamp-vessel-skiff";
const lantern: string = "lamp-vessel-lantern";
let serial: number = 0;

function nextId(kind: string): string {
  serial++;

  return "lamp-" + kind + "-" + serial;
}

function wave<T>(
  amplitude: T,
  frequency: number,
  phase: number = 0,
  phaseShift: number = 0,
): Wave<T> {
  return {
    amplitude: amplitude,
    frequency: frequency,
    phase: phase,
    phaseShift: phaseShift,
  };
}

function aimed(
  key: string,
  name: string,
  bullet: string,
  color: string,
  size: number,
  settings: Partial<Pattern>,
): Pattern {
  return {
    ...defaultPattern(),
    id: "lamp-pattern-" + key,
    name: name,
    bullet: bulletOf[bullet]!,
    color: color,
    size: size,
    angleDerivatives: new Array(),
    ...settings,
  };
}

function walled(
  key: string,
  name: string,
  bullet: string,
  color: string,
  size: number,
  settings: Partial<Pattern>,
): Pattern {
  return aimed(key, name, bullet, color, size, {
    frame: "objective",
    gapFrequency: 1,
    ...settings,
  });
}

function basePatterns(): Array<Pattern> {
  return [
    aimed("spit", "Gull Spit", "rice", "#7ad8ff", 14, {
      aim: true,
      count: 3,
      spread: 30,
      rate: 0.9,
      speed: 130,
    }),
    aimed("dart", "Beak Dart", "kunai", "#ff6b5b", 15, {
      aim: true,
      count: 1,
      spread: 0,
      rate: 2.2,
      speed: 170,
    }),
    aimed("ring", "Buoy Ring", "orb", "#3bb8ff", 16, {
      count: 14,
      rate: 0.7,
      speed: 95,
      angleDerivatives: [24],
    }),
    aimed("fan", "Hull Fan", "diamond", "#b79cff", 16, {
      count: 7,
      spread: 70,
      rate: 1.1,
      speed: 120,
    }),
    aimed("spiral", "Wisp Spiral", "star", "#ffd166", 15, {
      count: 4,
      rate: 5,
      speed: 105,
      angleDerivatives: [75],
    }),
    aimed("surge", "Surge", "ring", "#54e0c0", 17, {
      count: 10,
      rate: 0.8,
      speed: 55,
      speedDerivatives: [45],
    }),
    aimed("eddy", "Eddy", "rice", "#9fd8ff", 14, {
      count: 6,
      rate: 1,
      speed: 95,
      curve: "sinusoidal",
      angleWaves: [wave(35, 0.5)],
    }),
    aimed("swell", "Swell", "orb", "#2ec8ff", 16, {
      count: 8,
      rate: 1.1,
      speed: 90,
      swayWaves: [wave<Vector>({ x: 22, y: 0 }, 0.8)],
    }),
    walled("curtain", "Rain Curtain", "drop", "#7ad8ff", 16, {
      velocity: { x: 0, y: 125 },
      count: 16,
      gapWidth: 0.22,
      gapPhaseShift: 0.09,
      rate: 1.1,
    }),
    walled("crosswind", "Crosswind", "rice", "#c9eaff", 14, {
      wall: "left",
      velocity: { x: 115, y: 35 },
      count: 9,
      gapFrequency: 2,
      gapWidth: 0.16,
      gapShift: 0.2,
      rate: 0.8,
    }),
    walled("tide", "Rising Tide", "orb", "#1f9bd6", 17, {
      wall: "bottom",
      velocity: { x: 0, y: -85 },
      driftDerivatives: [{ x: 0, y: -12 }],
      count: 12,
      gapWidth: 0.25,
      gapPhaseShift: -0.07,
      rate: 0.6,
    }),
    aimed("brim", "Brim Shadow", "heart", "#ff6fd8", 18, {
      count: 20,
      rate: 0.9,
      speed: 85,
      angleDerivatives: [18],
    }),
    aimed("undertow", "Undertow", "rice", "#54e0c0", 15, {
      count: 10,
      rate: 1.1,
      speed: 40,
      speedDerivatives: [55],
      angleDerivatives: [-40],
    }),
    walled("net", "Drift Net", "diamond", "#54e0c0", 15, {
      velocity: { x: 0, y: 95 },
      count: 14,
      gapWidth: 0.24,
      gapPhaseShift: 0.05,
      rate: 0.7,
      swayWaves: [wave<Vector>({ x: 30, y: 0 }, 0.45)],
    }),
    aimed("splinter", "Splinter Hull", "kunai", "#ffb35c", 16, {
      aim: true,
      count: 9,
      spread: 90,
      rate: 0.9,
      speed: 125,
    }),
    aimed("toll", "Toll", "ring", "#ffc857", 24, {
      count: 24,
      rate: 0.55,
      speed: 100,
    }),
    walled("peal", "Sunken Peal", "ring", "#ffe27a", 20, {
      wall: "bottom",
      velocity: { x: 0, y: -100 },
      count: 11,
      gapWidth: 0.26,
      gapPhaseShift: 0.11,
      rate: 0.65,
      swayWaves: [wave<Vector>({ x: 18, y: 0 }, 0.6, 0, 40)],
    }),
    aimed("knell", "Knell", "star", "#ffd166", 15, {
      count: 3,
      rate: 6,
      speed: 95,
      angleDerivatives: [-55, 10],
    }),
    aimed("oil", "Lamp Oil", "flame", "#ff9e4f", 16, {
      count: 5,
      rate: 6,
      speed: 110,
      angleDerivatives: [60, 12],
    }),
    aimed("wick", "Trimmed Wick", "kunai", "#ffc857", 15, {
      aim: true,
      count: 9,
      spread: 60,
      rate: 1.3,
      speed: 135,
      aimCurve: "sinusoidal",
      aimWaves: [wave(40, 0.25)],
    }),
    walled("dark", "Dark Water", "drop", "#6d3bd1", 16, {
      wall: "right",
      velocity: { x: -110, y: 25 },
      count: 11,
      gapWidth: 0.28,
      gapPhaseShift: -0.08,
      rate: 0.8,
    }),
    aimed("vespers", "Vespers", "star", "#b79cff", 16, {
      count: 24,
      rate: 0.8,
      speed: 65,
      speedDerivatives: [30, 8],
      curve: "sinusoidal",
      angleWaves: [wave(25, 0.3)],
    }),
    aimed("last", "Last Light", "flame", "#fff1c9", 18, {
      count: 32,
      rate: 0.7,
      speed: 90,
      angleDerivatives: [33],
    }),
  ];
}

function wildPattern(pattern: Pattern): Pattern {
  return {
    ...pattern,
    id: pattern.id + "-wild",
    name: pattern.name + " +",
    count: Math.round(pattern.count * wildCount),
    rate: pattern.rate * wildRate,
    speed: pattern.speed * wildSpeed,
    velocity: {
      x: pattern.velocity.x * wildSpeed,
      y: pattern.velocity.y * wildSpeed,
    },
    gapWidth: pattern.gapWidth * wildGap,
  };
}

function starterPatterns(): Array<Pattern> {
  const base: Array<Pattern> = basePatterns();

  return [...base, ...base.map(wildPattern)];
}

function starterBackgrounds(): Array<Background> {
  return [
    {
      id: "lamp-sky-harbour",
      name: "Harbour Dusk",
      sprite: "art/rain-streaks.png",
      top: "#16284f",
      bottom: "#050a1c",
      scroll: 170,
      layers: new Array(),
    },
    {
      id: "lamp-sky-breakwater",
      name: "Open Swell",
      sprite: "art/rain-streaks.png",
      top: "#0f3d57",
      bottom: "#03121d",
      scroll: 240,
      layers: new Array(),
    },
    {
      id: "lamp-sky-stair",
      name: "Under the Tide",
      sprite: null,
      top: "#04303f",
      bottom: "#010a12",
      scroll: 30,
      layers: new Array(),
    },
    {
      id: "lamp-sky-lamp",
      name: "Lamp Room",
      sprite: "art/lamp-motes.png",
      top: "#2b1b4d",
      bottom: "#120818",
      scroll: -35,
      layers: new Array(),
    },
    {
      id: "lamp-sky-spell",
      name: "Glass Storm",
      sprite: "art/lamp-motes.png",
      top: "#4a1d2e",
      bottom: "#10060f",
      scroll: 90,
      layers: new Array(),
    },
  ];
}

function starterWallpapers(): Array<Wallpaper> {
  return [
    {
      id: "lamp-wall-harbour",
      name: "Oilskin",
      motif: "stripes",
      base: "#0b1a33",
      ink: "#14305a",
      size: 4,
      spacing: 10,
      angle: 45,
    },
    {
      id: "lamp-wall-breakwater",
      name: "Sea Wall",
      motif: "checks",
      base: "#07202c",
      ink: "#0d3344",
      size: 18,
      spacing: 18,
      angle: 0,
    },
    {
      id: "lamp-wall-stair",
      name: "Deep Swell",
      motif: "waves",
      base: "#031a22",
      ink: "#0a3a48",
      size: 4,
      spacing: 18,
      angle: 0,
    },
    {
      id: "lamp-wall-lamp",
      name: "Lens Cuts",
      motif: "diamonds",
      base: "#1a0f2e",
      ink: "#34205c",
      size: 12,
      spacing: 22,
      angle: 0,
    },
    {
      id: "lamp-wall-dots",
      name: "Sea Spray",
      motif: "dots",
      base: "#0c2230",
      ink: "#1e4a60",
      size: 4,
      spacing: 14,
      angle: 20,
    },
    {
      id: "lamp-wall-grid",
      name: "Chart Room",
      motif: "grid",
      base: "#10202c",
      ink: "#22405a",
      size: 1,
      spacing: 20,
      angle: 0,
    },
    {
      id: "lamp-wall-zigzag",
      name: "Storm Signal",
      motif: "zigzag",
      base: "#28121c",
      ink: "#54233a",
      size: 4,
      spacing: 16,
      angle: 0,
    },
  ];
}

function starterPalettes(): Array<Palette> {
  return [
    {
      id: "lamp-palette-harbour",
      name: "Harbour Lamp",
      accent: "#ffc857",
      highlight: "#fff4cf",
      text: "#ffffff",
      label: "#9fd8ff",
    },
    {
      id: "lamp-palette-breakwater",
      name: "Green Water",
      accent: "#54e0c0",
      highlight: "#d6fff4",
      text: "#ffffff",
      label: "#8fe3d0",
    },
    {
      id: "lamp-palette-stair",
      name: "Drowned Brass",
      accent: "#ff9e4f",
      highlight: "#ffe0bd",
      text: "#f2f7f7",
      label: "#7fb7c9",
    },
    {
      id: "lamp-palette-lamp",
      name: "Vesper Violet",
      accent: "#b79cff",
      highlight: "#fff1c9",
      text: "#ffffff",
      label: "#ff9e4f",
    },
  ];
}

function starterSigils(): Array<Sigil> {
  return [
    {
      id: "lamp-sigil-tide",
      name: "Tide Knot",
      color: "#54e0c0",
      opacity: 0.55,
      rings: [
        { radius: 150, points: 7, step: 2, ticks: 42, orb: 0.06, spin: 18 },
        { radius: 92, points: 5, step: 2, ticks: 20, orb: 0.08, spin: -32 },
      ],
    },
    {
      id: "lamp-sigil-bell",
      name: "Bell Mouth",
      color: "#ffc857",
      opacity: 0.5,
      rings: [
        { radius: 165, points: 12, step: 5, ticks: 60, orb: 0.04, spin: -10 },
        { radius: 110, points: 8, step: 3, ticks: 32, orb: 0.06, spin: 22 },
        { radius: 60, points: 3, step: 1, ticks: 12, orb: 0.12, spin: -60 },
      ],
    },
    {
      id: "lamp-sigil-lens",
      name: "Fresnel Lens",
      color: "#ff9e4f",
      opacity: 0.6,
      rings: [
        { radius: 175, points: 16, step: 7, ticks: 72, orb: 0.03, spin: 14 },
        { radius: 125, points: 9, step: 4, ticks: 36, orb: 0.05, spin: -24 },
        { radius: 75, points: 6, step: 2, ticks: 24, orb: 0.09, spin: 48 },
      ],
    },
  ];
}

function charms(): Array<Charm> {
  return [
    {
      key: "brim",
      name: "Tide Sign: Brim Shadow",
      sigil: "lamp-sigil-tide",
      background: "lamp-sky-breakwater",
      pattern: "brim",
    },
    {
      key: "undertow",
      name: "Tide Sign: Undertow",
      sigil: "lamp-sigil-tide",
      background: "lamp-sky-stair",
      pattern: "undertow",
    },
    {
      key: "net",
      name: "Tide Sign: Drift Net",
      sigil: "lamp-sigil-tide",
      background: "lamp-sky-breakwater",
      pattern: "net",
    },
    {
      key: "splinter",
      name: "Wreck Sign: Splinter Hull",
      sigil: "lamp-sigil-tide",
      background: "lamp-sky-spell",
      pattern: "splinter",
    },
    {
      key: "toll",
      name: "Bell Sign: First Toll",
      sigil: "lamp-sigil-bell",
      background: "lamp-sky-stair",
      pattern: "toll",
    },
    {
      key: "peal",
      name: "Bell Sign: Sunken Peal",
      sigil: "lamp-sigil-bell",
      background: "lamp-sky-stair",
      pattern: "peal",
    },
    {
      key: "knell",
      name: "Bell Sign: Long Knell",
      sigil: "lamp-sigil-bell",
      background: "lamp-sky-spell",
      pattern: "knell",
    },
    {
      key: "oil",
      name: "Lamp Sign: Burning Oil",
      sigil: "lamp-sigil-lens",
      background: "lamp-sky-lamp",
      pattern: "oil",
    },
    {
      key: "wick",
      name: "Lamp Sign: Trimmed Wick",
      sigil: "lamp-sigil-lens",
      background: "lamp-sky-lamp",
      pattern: "wick",
    },
    {
      key: "dark",
      name: "Lamp Sign: Dark Water",
      sigil: "lamp-sigil-lens",
      background: "lamp-sky-stair",
      pattern: "dark",
    },
    {
      key: "vespers",
      name: "Lamp Sign: Vespers",
      sigil: "lamp-sigil-lens",
      background: "lamp-sky-spell",
      pattern: "vespers",
    },
    {
      key: "last",
      name: "Last Sign: The Last Lamp",
      sigil: "lamp-sigil-lens",
      background: "lamp-sky-spell",
      pattern: "last",
    },
  ];
}

function starterSpells(): Array<Spell> {
  return charms().flatMap((charm: Charm) =>
    ["", "-wild"].map((suffix: string) => ({
      id: "lamp-spell-" + charm.key + suffix,
      name: charm.name + (suffix === "" ? "" : " +"),
      sigil: charm.sigil,
      background: charm.background,
      pattern: "lamp-pattern-" + charm.pattern + suffix,
      declareSound: effectSound("declare"),
      survival: false,
    })),
  );
}

function foes(): Array<Foe> {
  return [
    {
      key: "gull",
      name: "Storm Gull",
      vessel: gull,
      color: "#e6eef2",
      size: 28,
      rank: "regular",
      pattern: "spit",
      theme: null,
      bars: [[14, 0, null]],
    },
    {
      key: "shrike",
      name: "Shrike",
      vessel: gull,
      color: "#ff6b5b",
      size: 28,
      rank: "regular",
      pattern: "dart",
      theme: null,
      bars: [[18, 0, null]],
    },
    {
      key: "buoy",
      name: "Bell Buoy",
      vessel: buoy,
      color: "#d6453d",
      size: 30,
      rank: "regular",
      pattern: "ring",
      theme: null,
      bars: [[34, 0, null]],
    },
    {
      key: "squall",
      name: "Squall Buoy",
      vessel: buoy,
      color: "#7ad8ff",
      size: 30,
      rank: "regular",
      pattern: "curtain",
      theme: null,
      bars: [[60, 0, null]],
    },
    {
      key: "tidebuoy",
      name: "Tide Buoy",
      vessel: buoy,
      color: "#1f9bd6",
      size: 30,
      rank: "regular",
      pattern: "tide",
      theme: null,
      bars: [[60, 0, null]],
    },
    {
      key: "windgull",
      name: "Wind Gull",
      vessel: gull,
      color: "#c9eaff",
      size: 28,
      rank: "regular",
      pattern: "crosswind",
      theme: null,
      bars: [[30, 0, null]],
    },
    {
      key: "wisp",
      name: "Lamp Wisp",
      vessel: gull,
      color: "#ffd166",
      size: 26,
      rank: "regular",
      pattern: "spiral",
      theme: null,
      bars: [[40, 0, null]],
    },
    {
      key: "drifter",
      name: "Drifter",
      vessel: buoy,
      color: "#2ec8ff",
      size: 30,
      rank: "regular",
      pattern: "swell",
      theme: null,
      bars: [[30, 0, null]],
    },
    {
      key: "eddy",
      name: "Eddy Gull",
      vessel: gull,
      color: "#9fd8ff",
      size: 26,
      rank: "regular",
      pattern: "eddy",
      theme: null,
      bars: [[24, 0, null]],
    },
    {
      key: "hauler",
      name: "Hauler",
      vessel: buoy,
      color: "#54e0c0",
      size: 30,
      rank: "regular",
      pattern: "surge",
      theme: null,
      bars: [[40, 0, null]],
    },
    {
      key: "skiff",
      name: "Skiff",
      vessel: skiff,
      color: "#6b4a34",
      size: 54,
      rank: "regular",
      pattern: "fan",
      theme: null,
      bars: [[90, 0, null]],
    },
    {
      key: "wreck",
      name: "Wreck Skiff",
      vessel: skiff,
      color: "#ffb35c",
      size: 54,
      rank: "subboss",
      pattern: "fan",
      theme: null,
      bars: [[550, 26, "splinter"]],
    },
    {
      key: "scout",
      name: "Mirel, Scouting",
      vessel: skiff,
      color: "#54e0c0",
      size: 54,
      rank: "subboss",
      pattern: "swell",
      theme: soundIds["brim"]!,
      bars: [[500, 28, "brim"]],
    },
    {
      key: "mirel",
      name: "Mirel of the Tide",
      vessel: skiff,
      color: "#54e0c0",
      size: 54,
      rank: "boss",
      pattern: "swell",
      theme: soundIds["brim"]!,
      bars: [
        [650, 34, null],
        [750, 38, "undertow"],
        [850, 42, "net"],
      ],
    },
    {
      key: "bell",
      name: "The Drowned Bell",
      vessel: lantern,
      color: "#ffc857",
      size: 104,
      rank: "boss",
      pattern: "surge",
      theme: soundIds["drowned"]!,
      bars: [
        [800, 36, "toll"],
        [850, 40, "peal"],
        [1000, 46, "knell"],
      ],
    },
    {
      key: "vesper",
      name: "Vesper, Lamp Keeper",
      vessel: lantern,
      color: "#ff9e4f",
      size: 104,
      rank: "boss",
      pattern: "eddy",
      theme: soundIds["vesper"]!,
      bars: [
        [800, 34, null],
        [900, 38, "oil"],
        [950, 42, "wick"],
        [1000, 44, "dark"],
        [1100, 48, "vespers"],
        [1400, 60, "last"],
      ],
    },
  ];
}

function foeCard(foe: Foe, wild: boolean): Enemy {
  const suffix: string = wild ? "-wild" : "";
  const scale: number = wild ? wildHealth : 1;

  return {
    id: "lamp-enemy-" + foe.key + suffix,
    name: foe.name + (wild ? " +" : ""),
    vessel: foe.vessel,
    color: foe.color,
    size: foe.size,
    rank: foe.rank,
    pattern: "lamp-pattern-" + foe.pattern + suffix,
    theme: foe.theme,
    defeatSound: effectSound("defeat"),
    drops: rankDrops(foe.rank),
    bars: foe.bars.map(
      ([health, time, spell]: BarPlan, index: number): Bar => ({
        id: "lamp-bar-" + foe.key + suffix + "-" + index,
        health: Math.round(health * scale),
        time: time,
        spell: spell === null ? null : "lamp-spell-" + spell + suffix,
        attack: null,
        move: null,
        appears: "always",
      }),
    ),
  };
}

function starterEnemies(): Array<Enemy> {
  return foes().flatMap((foe: Foe) => [
    foeCard(foe, false),
    foeCard(foe, true),
  ]);
}

function foeId(key: string, tier: number): string {
  return "lamp-enemy-" + key + (tier >= wildTier ? "-wild" : "");
}

function spawn(
  key: string,
  tier: number,
  x: number,
  y: number,
  settings: Partial<Spawn>,
): Spawn {
  return {
    id: nextId("spawn"),
    enemy: foeId(key, tier),
    x: x,
    y: y,
    derivatives: new Array(),
    curve: "polynomial",
    waves: new Array(),
    count: 1,
    gap: 1,
    ...settings,
  };
}

function dive(
  key: string,
  tier: number,
  x: number,
  count: number,
  speed: number = 95,
): Spawn {
  return spawn(key, tier, x, offTop, {
    derivatives: [{ x: 0, y: speed }],
    count: count,
    gap: 0.75,
  });
}

function cross(
  key: string,
  tier: number,
  fromLeft: boolean,
  y: number,
  count: number,
): Spawn {
  return spawn(key, tier, fromLeft ? -offSide : 1 + offSide, y, {
    derivatives: [{ x: fromLeft ? 105 : -105, y: 18 }],
    count: count,
    gap: 0.9,
  });
}

function swoop(
  key: string,
  tier: number,
  fromLeft: boolean,
  count: number,
): Spawn {
  return spawn(key, tier, fromLeft ? 0.1 : 0.9, offTop, {
    derivatives: [
      { x: fromLeft ? 55 : -55, y: 140 },
      { x: fromLeft ? 25 : -25, y: -55 },
    ],
    count: count,
    gap: 0.7,
  });
}

function hover(key: string, tier: number, x: number): Spawn {
  return spawn(key, tier, x, offTop, {
    derivatives: [
      { x: 0, y: 95 },
      { x: 0, y: -24 },
    ],
  });
}

function weave(key: string, tier: number, x: number, count: number): Spawn {
  return spawn(key, tier, x, offTop, {
    curve: "sinusoidal",
    waves: [
      wave<Vector>({ x: 70, y: 0 }, 0.4),
      wave<Vector>({ x: 0, y: 560 }, 0.04),
    ],
    count: count,
    gap: 0.8,
  });
}

function boss(key: string, tier: number): Spawn {
  return spawn(key, tier, 0.5, bossHeight, {
    curve: "sinusoidal",
    waves: [
      wave<Vector>({ x: 72, y: 0 }, 0.11),
      wave<Vector>({ x: 0, y: 14 }, 0.23),
    ],
  });
}

function at(time: number, spawns: Array<Spawn>): Keyframe {
  return { id: nextId("key"), time: time, spawns: spawns, cutscene: null };
}

function harbourWaves(tier: number): Array<Keyframe> {
  const more: number = tier;

  return [
    at(2, [dive("gull", tier, 0.25, 3 + more)]),
    at(8, [dive("gull", tier, 0.75, 3 + more)]),
    at(14, [cross("gull", tier, true, 0.16, 3 + more)]),
    at(20, [hover("buoy", tier, 0.5)]),
    at(26, [
      swoop("shrike", tier, true, 2 + more),
      swoop("shrike", tier, false, 2 + more),
    ]),
    at(33, [hover("squall", tier, 0.5)]),
    at(39, [cross("eddy", tier, false, 0.14, 3 + more)]),
    ...(tier >= 1
      ? [at(44, [hover("buoy", tier, 0.25), hover("buoy", tier, 0.75)])]
      : []),
    ...(tier >= 3 ? [at(47, [weave("drifter", tier, 0.5, 3)])] : []),
    at(52, [boss("scout", tier)]),
  ];
}

function breakwaterWaves(tier: number): Array<Keyframe> {
  const more: number = tier;

  return [
    at(2, [
      swoop("gull", tier, true, 3 + more),
      swoop("gull", tier, false, 3 + more),
    ]),
    at(9, [weave("drifter", tier, 0.3, 2 + Math.ceil(more / 2))]),
    at(15, [hover("skiff", tier, 0.5)]),
    at(22, [cross("windgull", tier, true, 0.12, 2 + more)]),
    at(30, [boss("wreck", tier)]),
    at(44, [
      dive("shrike", tier, 0.2, 3 + more),
      dive("shrike", tier, 0.8, 3 + more),
    ]),
    ...(tier >= 1
      ? [at(50, [hover("hauler", tier, 0.35), hover("hauler", tier, 0.65)])]
      : []),
    ...(tier >= 3 ? [at(54, [weave("eddy", tier, 0.5, 4)])] : []),
    at(60, [boss("mirel", tier)]),
  ];
}

function stairWaves(tier: number): Array<Keyframe> {
  const more: number = tier;

  return [
    at(2, [hover("tidebuoy", tier, 0.5)]),
    at(9, [
      weave("eddy", tier, 0.25, 3 + more),
      weave("eddy", tier, 0.75, 3 + more),
    ]),
    at(17, [hover("wisp", tier, 0.5)]),
    at(25, [cross("hauler", tier, true, 0.15, 2 + more)]),
    at(33, [hover("squall", tier, 0.25), hover("tidebuoy", tier, 0.75)]),
    at(41, [
      hover("skiff", tier, 0.3),
      ...(tier >= 2 ? [hover("skiff", tier, 0.7)] : []),
    ]),
    at(50, [
      swoop("shrike", tier, true, 3 + more),
      swoop("shrike", tier, false, 3 + more),
    ]),
    ...(tier >= 1
      ? [at(56, [hover("wisp", tier, 0.25), hover("wisp", tier, 0.75)])]
      : []),
    at(64, [boss("bell", tier)]),
  ];
}

function lampWaves(tier: number): Array<Keyframe> {
  const more: number = tier;

  return [
    at(2, [weave("wisp", tier, 0.5, 2 + Math.ceil(more / 2))]),
    at(10, [hover("skiff", tier, 0.25), hover("skiff", tier, 0.75)]),
    at(18, [
      cross("windgull", tier, false, 0.1, 2 + more),
      hover("hauler", tier, 0.5),
    ]),
    at(26, [boss("scout", tier)]),
    at(40, [
      swoop("shrike", tier, true, 4 + more),
      swoop("shrike", tier, false, 4 + more),
    ]),
    at(47, [
      hover("squall", tier, 0.5),
      ...(tier >= 1
        ? [hover("wisp", tier, 0.2), hover("wisp", tier, 0.8)]
        : []),
    ]),
    ...(tier >= 3 ? [at(54, [hover("tidebuoy", tier, 0.5)])] : []),
    at(62, [boss("vesper", tier)]),
  ];
}

function stagecraft(): Array<Stagecraft> {
  return [
    {
      key: "harbour",
      name: "Harbour Mouth",
      background: "lamp-sky-harbour",
      wallpaper: "lamp-wall-harbour",
      palette: "lamp-palette-harbour",
      music: soundIds["harbour"]!,
      length: 54,
      waves: harbourWaves,
      cues: [[0, "lamp-scene-opening"]],
    },
    {
      key: "breakwater",
      name: "The Breakwater",
      background: "lamp-sky-breakwater",
      wallpaper: "lamp-wall-breakwater",
      palette: "lamp-palette-breakwater",
      music: soundIds["breakwater"]!,
      length: 62,
      waves: breakwaterWaves,
      cues: [[60, "lamp-scene-mirel"]],
    },
    {
      key: "stair",
      name: "The Drowned Stair",
      background: "lamp-sky-stair",
      wallpaper: "lamp-wall-stair",
      palette: "lamp-palette-stair",
      music: soundIds["stair"]!,
      length: 66,
      waves: stairWaves,
      cues: [[64, "lamp-scene-bell"]],
    },
    {
      key: "lamp",
      name: "The Lamp Room",
      background: "lamp-sky-lamp",
      wallpaper: "lamp-wall-lamp",
      palette: "lamp-palette-lamp",
      music: soundIds["lampRoom"]!,
      length: 64,
      waves: lampWaves,
      cues: [
        [62, "lamp-scene-vesper"],
        [64, "lamp-scene-ending"],
      ],
    },
  ];
}

function starterStages(): Array<Stage> {
  return tiers.flatMap(
    ([difficulty, label]: [Difficulty, string], tier: number) =>
      stagecraft().map((craft: Stagecraft) => ({
        id: "lamp-stage-" + craft.key + "-" + difficulty,
        name: craft.name + " (" + label + ")",
        background: craft.background,
        wallpaper: craft.wallpaper,
        palette: craft.palette,
        music: craft.music,
        difficulty: difficulty,
        length: craft.length,
        keyframes: [
          ...craft.waves(tier),
          ...craft.cues.map(([time, cutscene]: [number, string]) =>
            cue("lamp-stage-" + craft.key + "-" + difficulty, time, cutscene),
          ),
        ],
        titleCard: true,
      })),
  );
}

function cue(stage: string, time: number, cutscene: string): Keyframe {
  const id: string = stage + "-cue-" + cutscene;

  return {
    id: id,
    time: time,
    spawns: [
      {
        id: id + "-spawn",
        enemy: null,
        x: 0.5,
        y: 0.2,
        derivatives: new Array(),
        curve: "polynomial",
        waves: new Array(),
        count: 1,
        gap: 1,
      },
    ],
    cutscene: cutscene,
  };
}

function starterRuns(): Array<Run> {
  return tiers.map(([difficulty, label]: [Difficulty, string]) => ({
    id: "lamp-run-" + difficulty,
    name: "The Last Lamp: " + label,
    difficulty: difficulty,
    stages: stagecraft().map(
      (craft: Stagecraft) => "lamp-stage-" + craft.key + "-" + difficulty,
    ),
  }));
}

function starterGame(): Game {
  return {
    id: "lamp-game",
    name: "The Last Lamp",
    runs: {
      easy: "lamp-run-easy",
      normal: "lamp-run-normal",
      hard: "lamp-run-hard",
      lunatic: "lamp-run-lunatic",
    },
    ost: "lamp-ost",
    sounds: defaultGameSounds(),
    extends: defaultExtends(),
  };
}

function starterOst(): Ost {
  const tracks: Array<[string, string, string]> = [
    ["title", "lamp-sky-harbour", "lamp-wall-dots"],
    ["harbour", "lamp-sky-harbour", "lamp-wall-harbour"],
    ["breakwater", "lamp-sky-breakwater", "lamp-wall-breakwater"],
    ["brim", "lamp-sky-breakwater", "lamp-wall-grid"],
    ["stair", "lamp-sky-stair", "lamp-wall-stair"],
    ["drowned", "lamp-sky-stair", "lamp-wall-zigzag"],
    ["lampRoom", "lamp-sky-lamp", "lamp-wall-lamp"],
    ["vesper", "lamp-sky-spell", "lamp-wall-lamp"],
    ["surf", "lamp-sky-harbour", "lamp-wall-dots"],
  ];

  return {
    id: "lamp-ost",
    name: "The Last Lamp: Log Book",
    tracks: tracks.map(([sound, background, wallpaper]) => ({
      sound: soundIds[sound]!,
      background: background,
      wallpaper: wallpaper,
    })),
  };
}

function cast(key: string, name: string, color: string): Character {
  return {
    id: "lamp-character-" + key,
    name: name,
    color: color,
    emotions: emotions.map((emotion: string) => ({
      id: "lamp-" + key + "-" + emotion.toLowerCase(),
      name: emotion,
      sprite: "portraits/" + key + "-" + emotion.toLowerCase() + ".png",
    })),
  };
}

function starterCharacters(): Array<Character> {
  return [
    cast("wren", "Wren", "#ffc857"),
    cast("mirel", "Mirel", "#54e0c0"),
    cast("vesper", "Vesper", "#ff9e4f"),
  ];
}

function say(
  key: string,
  emotion: string,
  text: string,
  extra: Partial<Line> = {},
): Line {
  return {
    id: nextId("line"),
    character: "lamp-character-" + key,
    emotion: "lamp-" + key + "-" + emotion,
    text: text,
    ...extra,
  };
}

function drawl(text: string, part: string, speed: number): Partial<Line> {
  const from: number = text.indexOf(part);

  return { paces: [{ from: from, to: from + part.length, speed: speed }] };
}

function starterCutscenes(): Array<Cutscene> {
  const opening: string = "The lamp at Sallow Point went out three nights ago.";
  const trailing: string = "Nobody relights a drowned lamp. Nobody... but you?";
  const closing: string =
    "It was never the lamp that kept the ships safe... it was someone staying up to tend it.";

  return [
    {
      id: "lamp-scene-opening",
      name: "Three Nights Dark",
      voice: soundIds["voice"]!,
      background: "lamp-sky-harbour",
      speed: 32,
      lines: [
        say("wren", "neutral", opening, {
          focus: true,
          sound: soundIds["thunder"]!,
        }),
        say(
          "wren",
          "neutral",
          "No ships in, no ships out. The whole harbour is waiting on one light.",
        ),
        say(
          "wren",
          "angry",
          "Fine. If nobody else will climb those stairs, I'll fly.",
        ),
        say(
          "wren",
          "happy",
          "Fuel's full. Gulls are angry. Good weather for it.",
          { sound: soundIds["gull"]! },
        ),
      ],
    },
    {
      id: "lamp-scene-mirel",
      name: "The Wide Brim",
      voice: soundIds["voiceLow"]!,
      background: "lamp-sky-breakwater",
      speed: 28,
      lines: [
        say(
          "mirel",
          "neutral",
          "A keeper's coat, out past the breakwater. How quaint.",
        ),
        say(
          "wren",
          "surprised",
          "Who's flying in this? Turn around, the sea wall's gone!",
        ),
        say(
          "mirel",
          "happy",
          trailing,
          drawl(trailing, "Nobody... but you?", 9),
        ),
        say("wren", "angry", "Move your boat, or I'll move it for you.", {
          sound: soundIds["knock"]!,
        }),
        say("mirel", "angry", "Then let the tide decide who gets to pass."),
      ],
    },
    {
      id: "lamp-scene-bell",
      name: "What Rang Below",
      voice: soundIds["voice"]!,
      background: "lamp-sky-stair",
      speed: 30,
      lines: [
        say(
          "mirel",
          "surprised",
          "You actually beat me. Then listen: the stair runs under the water now.",
        ),
        say(
          "mirel",
          "neutral",
          "Something down there still rings. Don't answer it.",
        ),
        say("wren", "neutral", "A bell, this far under?", {
          sound: soundIds["bell"]!,
        }),
        say(
          "wren",
          "surprised",
          "That isn't a bell. It's the old lantern housing, and it's moving!",
          { focus: true },
        ),
      ],
    },
    {
      id: "lamp-scene-vesper",
      name: "The Keeper Before",
      voice: soundIds["voiceLow"]!,
      background: "lamp-sky-lamp",
      speed: 26,
      lines: [
        say(
          "vesper",
          "neutral",
          "You climbed all this way. Nobody climbs anymore.",
        ),
        say(
          "wren",
          "surprised",
          "You're Vesper. You kept this lamp before my mother did. You died.",
        ),
        say(
          "vesper",
          "happy",
          "I went on keeping it. The dark is so much easier to tend.",
        ),
        say("wren", "angry", "Ships are drowning out there!"),
        say(
          "vesper",
          "angry",
          "Then come and take the light from me, little keeper.",
          { sound: soundIds["thunder"]! },
        ),
      ],
    },
    {
      id: "lamp-scene-ending",
      name: "First Light",
      voice: soundIds["voice"]!,
      background: "lamp-sky-spell",
      speed: 26,
      lines: [
        say("vesper", "surprised", "Oh. It's brighter than I remembered."),
        say("wren", "neutral", closing, {
          ...drawl(closing, "it was someone staying up to tend it.", 14),
          focus: true,
        }),
        say("vesper", "happy", "Then stay up, little keeper. I'm tired."),
        say(
          "mirel",
          "happy",
          "Boats are moving in the harbour. You owe me a hat, by the way.",
        ),
        say(
          "wren",
          "happy",
          "Come up and collect it. There's tea in the lamp room.",
          { sound: soundIds["spark"]! },
        ),
      ],
    },
  ];
}

function defaultCreations(): Creations {
  serial = 0;

  return {
    stages: starterStages(),
    runs: starterRuns(),
    games: [starterGame()],
    patterns: starterPatterns(),
    enemies: starterEnemies(),
    backgrounds: starterBackgrounds(),
    wallpapers: starterWallpapers(),
    bullets: starterBullets(),
    vessels: starterVessels(),
    palettes: starterPalettes(),
    sigils: starterSigils(),
    spells: starterSpells(),
    sounds: starterSounds(),
    osts: [starterOst()],
    characters: starterCharacters(),
    cutscenes: starterCutscenes(),
  };
}

export { defaultCreations };
