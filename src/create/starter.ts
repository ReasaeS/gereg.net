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
  Palette,
  Pattern,
  Run,
  Sigil,
  Sound,
  Spawn,
  Spell,
  Stage,
  Vector,
  Wallpaper,
} from "./types";
import {
  createId,
  defaultBackground,
  defaultCharacter,
  defaultEnemy,
  defaultLine,
  defaultPalette,
  defaultPattern,
  defaultSigil,
  defaultSound,
  defaultSpawn,
  defaultSpell,
  defaultWallpaper,
} from "./defaults";

type Move = {
  x: number;
  y: number;
  velocity?: Vector;
  acceleration?: Vector;
  sway?: Vector;
  frequency?: number;
  count?: number;
  gap?: number;
};

function pattern(name: string, changes: Partial<Pattern>): Pattern {
  return { ...defaultPattern(), name: name, ...changes };
}

function bar(health: number, time: number, spell: Spell | null): Bar {
  return {
    id: createId(),
    health: health,
    time: time,
    spell: spell?.id ?? null,
  };
}

function enemy(
  name: string,
  changes: Partial<Enemy>,
  attack: Pattern | null,
): Enemy {
  return {
    ...defaultEnemy(attack?.id ?? null),
    name: name,
    ...changes,
  };
}

function spawn(foe: Enemy, move: Move): Spawn {
  const derivatives: Array<Vector> = new Array();

  if (move.velocity !== undefined || move.acceleration !== undefined) {
    derivatives.push(move.velocity ?? { x: 0, y: 0 });
  }

  if (move.acceleration !== undefined) {
    derivatives.push(move.acceleration);
  }

  return {
    ...defaultSpawn(foe.id, move.x),
    y: move.y,
    derivatives: derivatives,
    curve: move.sway === undefined ? "polynomial" : "sinusoidal",
    waves:
      move.sway === undefined
        ? new Array()
        : [
            {
              amplitude: move.sway,
              frequency: move.frequency ?? 0.3,
              phase: 0,
              phaseShift: 0,
            },
          ],
    count: move.count ?? 1,
    gap: move.gap ?? 1,
  };
}

function keyframe(time: number, spawns: Array<Spawn>): Keyframe {
  return { id: createId(), time: time, spawns: spawns };
}

function stage(
  name: string,
  difficulty: Difficulty,
  length: number,
  look: [Background, Wallpaper, Palette],
  keyframes: Array<Keyframe>,
): Stage {
  return {
    id: createId(),
    name: name,
    background: look[0].id,
    wallpaper: look[1].id,
    palette: look[2].id,
    music: null,
    difficulty: difficulty,
    length: length,
    keyframes: keyframes,
  };
}

function run(name: string, difficulty: Difficulty, stages: Array<Stage>): Run {
  return {
    id: createId(),
    name: name,
    difficulty: difficulty,
    stages: stages.map((value: Stage) => value.id),
  };
}

function sound(name: string, changes: Partial<Sound>): Sound {
  return { ...defaultSound(), name: name, ...changes };
}

function defaultCreations(): Creations {
  const nightSea: Background = defaultBackground();
  const dawnHaze: Background = {
    ...defaultBackground(),
    name: "Dawn Haze",
    top: "#ff9a6b",
    bottom: "#2a1450",
    scroll: 40,
  };
  const stormFront: Background = {
    ...defaultBackground(),
    name: "Storm Front",
    top: "#1b2a3a",
    bottom: "#050608",
    scroll: 160,
  };
  const voidSky: Background = {
    ...defaultBackground(),
    name: "Void",
    top: "#2a0636",
    bottom: "#000000",
    scroll: 20,
  };
  const midnight: Wallpaper = defaultWallpaper();
  const ember: Wallpaper = {
    ...defaultWallpaper(),
    name: "Ember",
    base: "#2a0a0a",
    stripe: "#5a1414",
    stripes: 8,
  };
  const slate: Wallpaper = {
    ...defaultWallpaper(),
    name: "Slate",
    base: "#10141c",
    stripe: "#10141c",
    stripes: 0,
  };
  const lighthouse: Palette = defaultPalette();
  const sakura: Palette = {
    ...defaultPalette(),
    name: "Sakura",
    accent: "#ff6fd8",
    highlight: "#ffe6f6",
    label: "#ffb3e6",
  };
  const tide: Palette = {
    ...defaultPalette(),
    name: "Tide",
    accent: "#3be8ff",
    highlight: "#d6fbff",
    label: "#7ad8ff",
  };
  const seal: Sigil = defaultSigil();
  const halo: Sigil = {
    ...defaultSigil(),
    name: "Halo",
    color: "#ffe27a",
    opacity: 0.5,
    rings: [
      { radius: 170, points: 12, step: 5, ticks: 48, orb: 0.05, spin: 12 },
      { radius: 120, points: 5, step: 2, ticks: 0, orb: 0.08, spin: -24 },
      { radius: 60, points: 3, step: 1, ticks: 12, orb: 0.1, spin: 60 },
    ],
  };
  const chime: Sound = defaultSound();
  const laser: Sound = sound("Laser", {
    wave: "sawtooth",
    pitch: 1400,
    slide: 300,
    sustain: 0.03,
    decay: 0.18,
    volume: 0.35,
  });
  const thunder: Sound = sound("Thunder", {
    wave: "noise",
    pitch: 140,
    slide: 60,
    sustain: 0.2,
    decay: 0.9,
    volume: 0.6,
  });
  const blip: Sound = sound("Blip", {
    wave: "triangle",
    pitch: 620,
    slide: 620,
    sustain: 0.02,
    decay: 0.05,
    vibratoDepth: 0.5,
    vibratoRate: 12,
    volume: 0.3,
  });

  const ring: Pattern = defaultPattern();
  const aimed: Pattern = pattern("Aimed Burst", {
    color: "#ffb347",
    size: 14,
    count: 5,
    spread: 40,
    aim: true,
    angleDerivatives: new Array(),
    rate: 1.2,
    speed: 170,
  });
  const spiral: Pattern = pattern("Spiral", {
    color: "#7ae38f",
    size: 12,
    count: 4,
    angleDerivatives: [120, 15],
    rate: 8,
    speed: 140,
  });
  const fan: Pattern = pattern("Wave Fan", {
    color: "#7ad8ff",
    size: 14,
    count: 7,
    spread: 90,
    angleDerivatives: new Array(),
    aimCurve: "sinusoidal",
    aimWaves: [{ amplitude: 35, frequency: 0.4, phase: 0, phaseShift: 0 }],
    rate: 3,
    speed: 110,
    speedDerivatives: [40],
  });
  const curtain: Pattern = pattern("Rain Curtain", {
    color: "#9fd8ff",
    size: 10,
    frame: "objective",
    wall: "top",
    count: 14,
    rate: 1.5,
    velocity: { x: 0, y: 130 },
    gapFrequency: 1,
    gapWidth: 0.18,
    gapPhaseShift: 0.12,
    angleDerivatives: new Array(),
  });
  const drizzle: Pattern = pattern("Drizzle", {
    color: "#b48cff",
    size: 9,
    frame: "objective",
    wall: "top",
    count: 6,
    rate: 2,
    velocity: { x: 20, y: 90 },
    curve: "sinusoidal",
    swayWaves: [
      { amplitude: { x: 24, y: 0 }, frequency: 0.8, phase: 0, phaseShift: 0 },
    ],
    angleDerivatives: new Array(),
  });
  const petals: Pattern = pattern("Petal Storm", {
    color: "#ff6fd8",
    size: 16,
    count: 10,
    angleDerivatives: [70, -12],
    rate: 5,
    speed: 120,
    speedDerivatives: [-30, 12],
  });
  const lattice: Pattern = pattern("Lattice", {
    color: "#3be8ff",
    size: 11,
    frame: "objective",
    wall: "left",
    count: 9,
    rate: 1.6,
    velocity: { x: 120, y: 30 },
    gapFrequency: 2,
    gapWidth: 0.12,
    gapPhaseShift: -0.08,
    angleDerivatives: new Array(),
  });
  const finale: Pattern = pattern("Final Halo", {
    color: "#ffe27a",
    size: 18,
    count: 24,
    angleDerivatives: [-25],
    angleWaves: new Array(),
    rate: 2.5,
    speed: 90,
    speedDerivatives: [30],
  });

  const petalSign: Spell = {
    ...defaultSpell(seal.id),
    name: "Bloom Sign: Petal Storm",
    background: dawnHaze.id,
    pattern: petals.id,
  };
  const latticeSign: Spell = {
    ...defaultSpell(seal.id),
    name: "Rain Sign: Lattice",
    background: stormFront.id,
    pattern: lattice.id,
  };
  const haloSign: Spell = {
    ...defaultSpell(halo.id),
    name: "Last Word: Final Halo",
    background: voidSky.id,
    pattern: finale.id,
  };

  const fairy: Enemy = defaultEnemy(ring.id);
  const gunner: Enemy = enemy(
    "Gunner",
    { color: "#ffb347", size: 26, bars: [bar(30, 30, null)] },
    aimed,
  );
  const wisp: Enemy = enemy(
    "Wisp",
    { color: "#7ae38f", size: 20, bars: [bar(12, 30, null)] },
    spiral,
  );
  const raincloud: Enemy = enemy(
    "Raincloud",
    { color: "#b48cff", size: 34, bars: [bar(60, 30, null)] },
    drizzle,
  );
  const thundercloud: Enemy = enemy(
    "Thundercloud",
    { color: "#9fd8ff", size: 38, bars: [bar(90, 30, null)] },
    curtain,
  );
  const warden: Enemy = enemy(
    "Warden",
    {
      color: "#ff6fd8",
      size: 40,
      rank: "subboss",
      bars: [bar(320, 25, petalSign)],
    },
    fan,
  );
  const tempest: Enemy = enemy(
    "Tempest",
    {
      color: "#3be8ff",
      size: 48,
      rank: "boss",
      bars: [
        bar(420, 30, null),
        bar(520, 40, latticeSign),
        bar(700, 50, haloSign),
      ],
    },
    fan,
  );

  const calm: [Background, Wallpaper, Palette] = [
    nightSea,
    midnight,
    lighthouse,
  ];
  const dawn: [Background, Wallpaper, Palette] = [dawnHaze, slate, sakura];
  const storm: [Background, Wallpaper, Palette] = [stormFront, ember, tide];

  const sprinkle: Stage = stage("Sprinkle", "easy", 45, calm, [
    keyframe(1, [spawn(fairy, { x: 0.5, y: 0.2 })]),
    keyframe(8, [
      spawn(fairy, {
        x: 0.2,
        y: -0.05,
        velocity: { x: 0, y: 70 },
        count: 3,
        gap: 1.2,
      }),
      spawn(fairy, {
        x: 0.8,
        y: -0.05,
        velocity: { x: 0, y: 70 },
        count: 3,
        gap: 1.2,
      }),
    ]),
    keyframe(20, [spawn(wisp, { x: 0.5, y: 0.25, sway: { x: 90, y: 20 } })]),
    keyframe(28, [
      spawn(raincloud, {
        x: 0.5,
        y: -0.05,
        velocity: { x: 0, y: 40 },
        acceleration: { x: 0, y: -4 },
      }),
    ]),
    keyframe(36, [
      spawn(gunner, { x: -0.05, y: 0.15, velocity: { x: 60, y: 10 } }),
    ]),
  ]);
  const shoreline: Stage = stage("Shoreline", "normal", 60, dawn, [
    keyframe(1, [
      spawn(fairy, {
        x: 0.15,
        y: -0.05,
        velocity: { x: 40, y: 80 },
        count: 4,
        gap: 0.8,
      }),
    ]),
    keyframe(6, [
      spawn(fairy, {
        x: 0.85,
        y: -0.05,
        velocity: { x: -40, y: 80 },
        count: 4,
        gap: 0.8,
      }),
    ]),
    keyframe(14, [
      spawn(gunner, { x: 0.3, y: 0.2, sway: { x: 50, y: 0 } }),
      spawn(gunner, { x: 0.7, y: 0.2, sway: { x: -50, y: 0 } }),
    ]),
    keyframe(26, [
      spawn(wisp, {
        x: 0.5,
        y: -0.05,
        velocity: { x: 0, y: 120 },
        acceleration: { x: 0, y: -30 },
        count: 6,
        gap: 0.5,
      }),
    ]),
    keyframe(36, [spawn(warden, { x: 0.5, y: 0.22 })]),
  ]);
  const eye: Stage = stage("Eye of the Storm", "normal", 90, storm, [
    keyframe(1, [
      spawn(wisp, { x: 0.25, y: 0.15, sway: { x: 60, y: 30 }, frequency: 0.5 }),
      spawn(wisp, {
        x: 0.75,
        y: 0.15,
        sway: { x: -60, y: 30 },
        frequency: 0.5,
      }),
    ]),
    keyframe(10, [
      spawn(gunner, {
        x: -0.05,
        y: 0.1,
        velocity: { x: 80, y: 20 },
        count: 3,
        gap: 1,
      }),
      spawn(gunner, {
        x: 1.05,
        y: 0.1,
        velocity: { x: -80, y: 20 },
        count: 3,
        gap: 1,
      }),
    ]),
    keyframe(24, [spawn(tempest, { x: 0.5, y: 0.2 })]),
  ]);
  const downpour: Stage = stage("Downpour", "hard", 75, storm, [
    keyframe(1, [
      spawn(gunner, { x: 0.2, y: 0.18, sway: { x: 40, y: 10 } }),
      spawn(gunner, { x: 0.8, y: 0.18, sway: { x: -40, y: 10 } }),
    ]),
    keyframe(12, [
      spawn(wisp, {
        x: 0.1,
        y: -0.05,
        velocity: { x: 50, y: 110 },
        count: 8,
        gap: 0.4,
      }),
      spawn(wisp, {
        x: 0.9,
        y: -0.05,
        velocity: { x: -50, y: 110 },
        count: 8,
        gap: 0.4,
      }),
    ]),
    keyframe(22, [
      spawn(thundercloud, { x: 0.3, y: 0.12, sway: { x: 30, y: 0 } }),
      spawn(raincloud, { x: 0.7, y: 0.12, sway: { x: -30, y: 0 } }),
    ]),
    keyframe(34, [spawn(warden, { x: 0.5, y: 0.2 })]),
    keyframe(52, [spawn(tempest, { x: 0.5, y: 0.2 })]),
  ]);
  const maelstrom: Stage = stage("Maelstrom", "lunatic", 80, storm, [
    keyframe(1, [
      spawn(wisp, {
        x: 0.5,
        y: 0.3,
        sway: { x: 140, y: 60 },
        frequency: 0.6,
        count: 6,
        gap: 0.3,
      }),
    ]),
    keyframe(10, [
      spawn(thundercloud, { x: 0.5, y: 0.05 }),
      spawn(gunner, { x: 0.15, y: 0.12 }),
      spawn(gunner, { x: 0.5, y: 0.08 }),
      spawn(gunner, { x: 0.85, y: 0.12 }),
    ]),
    keyframe(22, [
      spawn(warden, { x: 0.3, y: 0.2 }),
      spawn(warden, { x: 0.7, y: 0.2 }),
    ]),
    keyframe(42, [spawn(tempest, { x: 0.5, y: 0.2 })]),
  ]);

  const easyRun: Run = run("Rainy Day", "easy", [sprinkle]);
  const normalRun: Run = run("Rainy Day", "normal", [shoreline, eye]);
  const hardRun: Run = run("Rainy Day", "hard", [downpour]);
  const lunaticRun: Run = run("Rainy Day", "lunatic", [maelstrom]);
  const rainyDay: Game = {
    id: createId(),
    name: "Rainy Day",
    runs: {
      easy: easyRun.id,
      normal: normalRun.id,
      hard: hardRun.id,
      lunatic: lunaticRun.id,
    },
  };

  const you: Character = defaultCharacter("You", 0, "portraits/you.png");
  const stranger: Character = defaultCharacter(
    "Stranger",
    1,
    "portraits/stranger.png",
  );
  const meeting: Cutscene = {
    id: createId(),
    name: "Meeting",
    voice: blip.id,
    speed: 30,
    lines: [
      defaultLine(you, "Who's out there in this weather?"),
      defaultLine(stranger, "Only the rain. Turn back while you can."),
    ],
  };
  const eyeScene: Cutscene = {
    id: createId(),
    name: "Calm Before",
    voice: blip.id,
    speed: 26,
    lines: [
      defaultLine(stranger, "So you made it to the eye of the storm."),
      defaultLine(you, "It's quiet here. Too quiet."),
      defaultLine(stranger, "Then let me fix that."),
    ],
  };

  return {
    stages: [sprinkle, shoreline, eye, downpour, maelstrom],
    runs: [easyRun, normalRun, hardRun, lunaticRun],
    games: [rainyDay],
    patterns: [
      ring,
      aimed,
      spiral,
      fan,
      curtain,
      drizzle,
      petals,
      lattice,
      finale,
    ],
    enemies: [fairy, gunner, wisp, raincloud, thundercloud, warden, tempest],
    backgrounds: [nightSea, dawnHaze, stormFront, voidSky],
    wallpapers: [midnight, ember, slate],
    palettes: [lighthouse, sakura, tide],
    sigils: [seal, halo],
    spells: [petalSign, latticeSign, haloSign],
    sounds: [chime, laser, thunder, blip],
    characters: [you, stranger],
    cutscenes: [meeting, eyeScene],
  };
}

export { defaultCreations };
