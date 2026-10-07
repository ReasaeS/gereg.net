type Vector = {
  x: number;
  y: number;
};

type Pattern = {
  id: string;
  name: string;
  sprite: string | null;
  size: number; // units
  color: string;
  count: number;
  spread: number; // deg
  heading: number; // deg from straight down
  aim: boolean;
  angleDerivatives: Array<number>; // deg/s^n
  rate: number; // shots/s
  speed: number; // units/s
  speedDerivatives: Array<number>; // units/s^(n+1)
};

type Enemy = {
  id: string;
  name: string;
  sprite: string | null;
  color: string;
  size: number; // units
  health: number;
  pattern: string | null;
  spell: string | null;
};

type Ring = {
  radius: number; // units
  points: number;
  step: number;
  ticks: number;
  orb: number; // of radius
  spin: number; // deg/s
};

type Spell = {
  id: string;
  name: string;
  color: string;
  opacity: number;
  rings: Array<Ring>;
};

type Background = {
  id: string;
  name: string;
  sprite: string | null;
  top: string;
  bottom: string;
  scroll: number; // units/s
};

type Spawn = {
  id: string;
  enemy: string | null;
  x: number; // of field width
  y: number; // of field height
  derivatives: Array<Vector>; // units/s^n
  count: number;
  gap: number; // s
};

type Keyframe = {
  id: string;
  time: number; // s
  spawns: Array<Spawn>;
};

type Stage = {
  id: string;
  name: string;
  background: string | null;
  length: number; // s
  keyframes: Array<Keyframe>;
};

type Creations = {
  stages: Array<Stage>;
  patterns: Array<Pattern>;
  enemies: Array<Enemy>;
  backgrounds: Array<Background>;
  spells: Array<Spell>;
};

const storageKey: string = "geregnet.creations";

function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultPattern(): Pattern {
  return {
    id: createId(),
    name: "Ring",
    sprite: null,
    size: 18,
    color: "#ff3b3b",
    count: 16,
    spread: 360,
    heading: 0,
    aim: false,
    angleDerivatives: [30],
    rate: 2,
    speed: 120,
    speedDerivatives: new Array(),
  };
}

function defaultEnemy(pattern: string | null): Enemy {
  return {
    id: createId(),
    name: "Fairy",
    sprite: null,
    color: "#7ad8ff",
    size: 28,
    health: 20,
    pattern: pattern,
    spell: null,
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

function defaultSpell(): Spell {
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
    count: 1,
    gap: 1,
  };
}

function defaultKeyframe(time: number, spawns: Array<Spawn>): Keyframe {
  return { id: createId(), time: time, spawns: spawns };
}

function defaultStage(enemy: string | null, background: string | null): Stage {
  return {
    id: createId(),
    name: "Stage",
    background: background,
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
  };
}

function defaultCreations(): Creations {
  const pattern: Pattern = defaultPattern();
  const enemy: Enemy = defaultEnemy(pattern.id);
  const background: Background = defaultBackground();

  return {
    stages: [defaultStage(enemy.id, background.id)],
    patterns: [pattern],
    enemies: [enemy],
    backgrounds: [background],
    spells: [defaultSpell()],
  };
}

function loadCreations(): Creations {
  try {
    const saved: string | null = localStorage.getItem(storageKey);

    if (saved === null) {
      return defaultCreations();
    }

    const parsed: Creations = JSON.parse(saved) as Creations;
    const fallback: Creations = defaultCreations();
    const creations: Creations = {
      stages: parsed.stages ?? new Array(),
      patterns: parsed.patterns ?? fallback.patterns,
      enemies: parsed.enemies ?? fallback.enemies,
      backgrounds: parsed.backgrounds ?? fallback.backgrounds,
      spells: parsed.spells ?? fallback.spells,
    };

    for (const enemy of creations.enemies) {
      enemy.spell = enemy.spell ?? null;
    }

    for (const item of [
      ...creations.patterns,
      ...creations.enemies,
      ...creations.backgrounds,
    ]) {
      item.sprite = item.sprite ?? null;
    }

    for (const pattern of creations.patterns as Array<
      Pattern & { spin?: number; accel?: number; angle?: number }
    >) {
      pattern.size = pattern.size ?? 18;
      pattern.heading =
        pattern.heading ?? (((pattern.angle ?? 90) - 90 + 540) % 360) - 180;
      delete pattern.angle;
      pattern.angleDerivatives =
        pattern.angleDerivatives ??
        (pattern.spin !== undefined && pattern.spin !== 0
          ? [pattern.spin]
          : []);
      pattern.speedDerivatives =
        pattern.speedDerivatives ??
        (pattern.accel !== undefined && pattern.accel !== 0
          ? [pattern.accel]
          : []);
      delete pattern.spin;
      delete pattern.accel;
    }

    for (const stage of creations.stages) {
      upgradeStage(stage);
    }

    if (parsed.stages === undefined) {
      creations.stages.push(
        defaultStage(
          creations.enemies[0]?.id ?? null,
          creations.backgrounds[0]?.id ?? null,
        ),
      );
    }

    return creations;
  } catch {
    return defaultCreations();
  }
}

type OldSpawn = Spawn & { time?: number };

function upgradeStage(stage: Stage & { spawns?: Array<OldSpawn> }): void {
  if (stage.keyframes === undefined) {
    const keyframes: Map<number, Keyframe> = new Map();

    for (const spawn of stage.spawns ?? []) {
      const time: number = spawn.time ?? 0;
      let keyframe: Keyframe | undefined = keyframes.get(time);

      if (keyframe === undefined) {
        keyframe = defaultKeyframe(time, new Array());
        keyframes.set(time, keyframe);
      }

      keyframe.spawns.push({
        id: spawn.id,
        enemy: spawn.enemy,
        x: spawn.x,
        y: spawn.y ?? defaultSpawnY,
        derivatives: new Array(),
        count: spawn.count,
        gap: spawn.gap,
      });
    }

    stage.keyframes = [...keyframes.values()].sort(
      (first: Keyframe, second: Keyframe) => first.time - second.time,
    );
    delete stage.spawns;
  }

  if (stage.keyframes.length === 0) {
    stage.keyframes.push(defaultKeyframe(0, [defaultSpawn(null, 0.5)]));
  }

  for (const keyframe of stage.keyframes) {
    if (keyframe.spawns.length === 0) {
      keyframe.spawns.push(defaultSpawn(null, 0.5));
    }

    for (const spawn of keyframe.spawns) {
      spawn.derivatives = spawn.derivatives ?? new Array();
    }
  }
}

function usedSprites(creations: Creations): Set<string> {
  const used: Set<string> = new Set();

  for (const item of [
    ...creations.patterns,
    ...creations.enemies,
    ...creations.backgrounds,
  ]) {
    if (item.sprite !== null) {
      used.add(item.sprite);
    }
  }

  return used;
}

function saveCreations(creations: Creations): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(creations));
  } catch {
    console.warn("Could not save the creations");
  }
}

export {
  derivativeNames,
  createId,
  defaultPattern,
  defaultEnemy,
  defaultBackground,
  defaultRing,
  defaultSpell,
  defaultSpawn,
  defaultKeyframe,
  defaultStage,
  loadCreations,
  saveCreations,
  usedSprites,
};
export type {
  Vector,
  Pattern,
  Enemy,
  Background,
  Ring,
  Spell,
  Spawn,
  Keyframe,
  Stage,
  Creations,
};
