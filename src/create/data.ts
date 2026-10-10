type Vector = {
  x: number;
  y: number;
};

type Frame = "subjective" | "objective";

type Wall = "top" | "right" | "bottom" | "left";

type Curve = "polynomial" | "sinusoidal";

type Wave<T> = {
  amplitude: T;
  frequency: number; // Hz
  phase: number; // deg
  phaseShift: number; // deg/s
};

type Rank = "regular" | "subboss" | "boss";

type Difficulty = "easy" | "normal" | "hard" | "lunatic";

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
  frame: Frame;
  wall: Wall;
  gapShift: number; // of wall
  gapPhaseShift: number; // of wall/s
  cover: number; // of wall
  gapFrequency: number; // per wall
  gapWidth: number; // of wall
  angleDerivatives: Array<number>; // deg/s^n
  rate: number; // shots/s
  speed: number; // units/s
  velocity: Vector; // units/s
  speedDerivatives: Array<number>; // units/s^(n+1)
  driftDerivatives: Array<Vector>; // units/s^(n+1)
  curve: Curve;
  angleWaves: Array<Wave<number>>; // deg
  aimCurve: Curve;
  aimWaves: Array<Wave<number>>; // deg
  swayWaves: Array<Wave<Vector>>; // units
};

type Enemy = {
  id: string;
  name: string;
  sprite: string | null;
  color: string;
  size: number; // units
  health: number;
  rank: Rank;
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

type Waveform = "square" | "sine" | "sawtooth" | "triangle" | "noise";

type SoundSource = "synth" | "file";

type Sound = {
  id: string;
  name: string;
  source: SoundSource;
  file: string | null;
  fileName: string;
  wave: Waveform;
  pitch: number; // Hz
  slide: number; // Hz
  attack: number; // s
  sustain: number; // s
  decay: number; // s
  vibratoDepth: number; // semitones
  vibratoRate: number; // Hz
  volume: number;
};

type Side = "left" | "right";

type Emotion = {
  id: string;
  name: string;
  sprite: string | null;
};

type Character = {
  id: string;
  name: string;
  color: string;
  emotions: Array<Emotion>;
};

type Line = {
  id: string;
  character: string;
  emotion: string;
  text: string;
};

type Cutscene = {
  id: string;
  name: string;
  voice: string | null;
  speed: number; // chars/s
  lines: Array<Line>;
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
  curve: Curve;
  waves: Array<Wave<Vector>>; // units
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
  difficulty: Difficulty;
  length: number; // s
  keyframes: Array<Keyframe>;
};

type Creations = {
  stages: Array<Stage>;
  patterns: Array<Pattern>;
  enemies: Array<Enemy>;
  backgrounds: Array<Background>;
  spells: Array<Spell>;
  sounds: Array<Sound>;
  characters: Array<Character>;
  cutscenes: Array<Cutscene>;
};

const storageKey: string = "geregnet.creations";

function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function solidSpans(
  pattern: Pattern,
  time: number = 0,
): Array<[number, number]> {
  if (pattern.gapFrequency <= 0 || pattern.gapWidth <= 0) {
    return [[0, 1]];
  }

  const period: number = 1 / pattern.gapFrequency;
  const width: number = Math.min(pattern.gapWidth, period);
  const offset: number = pattern.gapShift + pattern.gapPhaseShift * time;
  const shift: number = offset - Math.floor(offset / period) * period;
  const spans: Array<[number, number]> = new Array();
  let cursor: number = 0;

  for (
    let index = Math.floor(-pattern.gapFrequency) - 1;
    index <= Math.ceil(pattern.gapFrequency * 2) + 1;
    index++
  ) {
    const center: number = (index + 0.5) * period + shift;
    const start: number = Math.min(Math.max(center - width / 2, 0), 1);
    const end: number = Math.min(Math.max(center + width / 2, 0), 1);

    if (start > cursor) {
      spans.push([cursor, start]);
    }

    cursor = Math.max(cursor, end);
  }

  if (cursor < 1) {
    spans.push([cursor, 1]);
  }

  return spans;
}

function placeAlong(
  spans: Array<[number, number]>,
  fraction: number,
): number | null {
  const total: number = spans.reduce(
    (sum: number, span: [number, number]) => sum + span[1] - span[0],
    0,
  );
  let remaining: number = fraction * total;

  if (total <= 0) {
    return null;
  }

  for (const [start, end] of spans) {
    if (remaining <= end - start) {
      return start + remaining;
    }

    remaining -= end - start;
  }

  return spans[spans.length - 1]![1];
}

function wallAngle(wall: Wall): number {
  return wall === "top"
    ? Math.PI / 2
    : wall === "bottom"
      ? -Math.PI / 2
      : wall === "left"
        ? 0
        : Math.PI;
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
    frame: "objective",
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
    rank: "regular",
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
  };
}

function defaultEmotion(name: string): Emotion {
  return { id: createId(), name: name, sprite: null };
}

const characterColors: Array<string> = ["#7ad8ff", "#ff6fd8"];

function defaultCharacter(name: string, order: number = 0): Character {
  return {
    id: createId(),
    name: name,
    color: characterColors[order % characterColors.length]!,
    emotions: [defaultEmotion("Neutral")],
  };
}

function defaultLine(character: Character, text: string): Line {
  return {
    id: createId(),
    character: character.id,
    emotion: character.emotions[0]!.id,
    text: text,
  };
}

function defaultCharacters(): Array<Character> {
  return [defaultCharacter("You", 0), defaultCharacter("Stranger", 1)];
}

function defaultCutscene(cast: Array<Character>): Cutscene {
  const first: Character | undefined = cast[0];
  const second: Character | undefined = cast[1] ?? first;

  return {
    id: createId(),
    name: "Meeting",
    voice: null,
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

type OldLine = {
  id: string;
  speaker: string;
  text: string;
  side: Side;
  color: string;
  portrait: string | null;
};

type OldCutscene = Cutscene & {
  background?: unknown;
  characters?: Array<Character>;
};

function embedCharacters(cutscene: OldCutscene): Array<Character> {
  const cast: Map<string, Character> = new Map();
  const characters: Array<Character> = new Array();

  cutscene.lines = (cutscene.lines as unknown as Array<OldLine>).map(
    (old: OldLine) => {
      const key: string = old.side + " " + old.speaker;
      let character: Character | undefined = cast.get(key);

      if (character === undefined) {
        character = {
          ...defaultCharacter(old.speaker),
          color: old.color,
          emotions: new Array(),
        };
        cast.set(key, character);
        characters.push(character);
      }

      let emotion: Emotion | undefined = character.emotions.find(
        (value: Emotion) => value.sprite === old.portrait,
      );

      if (emotion === undefined) {
        emotion = {
          ...defaultEmotion(
            character.emotions.length === 0
              ? "Neutral"
              : "Emotion " + (character.emotions.length + 1),
          ),
          sprite: old.portrait,
        };
        character.emotions.push(emotion);
      }

      return {
        id: old.id,
        character: character.id,
        emotion: emotion.id,
        text: old.text,
      };
    },
  );

  return characters;
}

function sameName(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

function upgradeCutscene(cutscene: OldCutscene, cast: Array<Character>): void {
  const embedded: Array<Character> =
    cutscene.lines.length > 0 && "speaker" in cutscene.lines[0]!
      ? embedCharacters(cutscene)
      : (cutscene.characters ?? new Array());
  const renamed: Map<string, string> = new Map();

  delete cutscene.background;
  delete cutscene.characters;

  for (const character of embedded) {
    const match: Character | undefined = cast.find((value: Character) =>
      sameName(value.name, character.name),
    );

    if (match === undefined) {
      cast.push(character);
      continue;
    }

    renamed.set(character.id, match.id);

    for (const emotion of character.emotions) {
      const twin: Emotion | undefined = match.emotions.find((value: Emotion) =>
        sameName(value.name, emotion.name),
      );

      if (twin === undefined) {
        match.emotions.push(emotion);
      } else {
        renamed.set(emotion.id, twin.id);
      }
    }
  }

  for (const line of cutscene.lines) {
    line.character = renamed.get(line.character) ?? line.character;
    line.emotion = renamed.get(line.emotion) ?? line.emotion;
  }

  if (cutscene.lines.length === 0) {
    cutscene.lines = defaultCutscene(cast).lines;
  }
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

function defaultKeyframe(time: number, spawns: Array<Spawn>): Keyframe {
  return { id: createId(), time: time, spawns: spawns };
}

function defaultStage(enemy: string | null, background: string | null): Stage {
  return {
    id: createId(),
    name: "Stage",
    background: background,
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
  };
}

function defaultCreations(): Creations {
  const pattern: Pattern = defaultPattern();
  const enemy: Enemy = defaultEnemy(pattern.id);
  const background: Background = defaultBackground();
  const characters: Array<Character> = defaultCharacters();

  return {
    stages: [defaultStage(enemy.id, background.id)],
    patterns: [pattern],
    enemies: [enemy],
    backgrounds: [background],
    spells: [defaultSpell()],
    sounds: [defaultSound()],
    characters: characters,
    cutscenes: [defaultCutscene(characters)],
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
      sounds: parsed.sounds ?? fallback.sounds,
      characters:
        parsed.characters ??
        (parsed.cutscenes === undefined ? fallback.characters : new Array()),
      cutscenes: parsed.cutscenes ?? fallback.cutscenes,
    };

    for (const sound of creations.sounds) {
      sound.source = sound.source ?? "synth";
      sound.file = sound.file ?? null;
      sound.fileName = sound.fileName ?? "";
    }

    for (const cutscene of creations.cutscenes) {
      upgradeCutscene(cutscene, creations.characters);
    }

    for (const character of creations.characters as Array<
      Character & { side?: unknown }
    >) {
      delete character.side;
    }

    for (const enemy of creations.enemies) {
      enemy.spell = enemy.spell ?? null;
      enemy.rank = enemy.rank ?? "regular";
    }

    for (const item of [
      ...creations.patterns,
      ...creations.enemies,
      ...creations.backgrounds,
    ]) {
      item.sprite = item.sprite ?? null;
    }

    for (const pattern of creations.patterns as Array<
      Pattern & {
        spin?: number;
        accel?: number;
        angle?: number;
        gapOffset?: number;
        speedWaves?: unknown;
        driftWaves?: unknown;
      }
    >) {
      pattern.size = pattern.size ?? 18;
      pattern.frame = pattern.frame ?? "objective";
      pattern.wall = pattern.wall ?? "top";
      pattern.gapShift = pattern.gapShift ?? 0;
      pattern.gapPhaseShift = pattern.gapPhaseShift ?? 0;
      pattern.cover = pattern.cover ?? 1;
      delete pattern.gapOffset;
      pattern.gapFrequency = pattern.gapFrequency ?? 0;
      pattern.gapWidth = pattern.gapWidth ?? 0.1;
      pattern.driftDerivatives = pattern.driftDerivatives ?? new Array();
      pattern.curve = pattern.curve ?? "polynomial";
      pattern.angleWaves = pattern.angleWaves ?? new Array();
      pattern.aimCurve = pattern.aimCurve ?? "polynomial";
      pattern.aimWaves = pattern.aimWaves ?? new Array();
      pattern.swayWaves = pattern.swayWaves ?? new Array();
      shiftWaves(pattern.angleWaves);
      shiftWaves(pattern.aimWaves);
      shiftWaves(pattern.swayWaves);
      delete pattern.speedWaves;
      delete pattern.driftWaves;
      pattern.velocity = pattern.velocity ?? {
        x: Math.round(Math.cos(wallAngle(pattern.wall)) * pattern.speed),
        y: Math.round(Math.sin(wallAngle(pattern.wall)) * pattern.speed),
      };
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
  stage.difficulty = stage.difficulty ?? "normal";

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
        curve: "polynomial",
        waves: new Array(),
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
      spawn.curve = spawn.curve ?? "polynomial";
      spawn.waves = spawn.waves ?? new Array();
      shiftWaves(spawn.waves);
    }
  }
}

function shiftWaves(waves: Array<Wave<unknown>>): void {
  for (const wave of waves) {
    wave.phaseShift = wave.phaseShift ?? 0;
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

  for (const character of creations.characters) {
    for (const emotion of character.emotions) {
      if (emotion.sprite !== null) {
        used.add(emotion.sprite);
      }
    }
  }

  return used;
}

function usedFiles(creations: Creations): Set<string> {
  const used: Set<string> = usedSprites(creations);

  for (const sound of creations.sounds) {
    if (sound.file !== null) {
      used.add(sound.file);
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
  wallAngle,
  solidSpans,
  placeAlong,
  defaultPattern,
  defaultEnemy,
  defaultBackground,
  defaultRing,
  defaultSpell,
  defaultSound,
  defaultEmotion,
  defaultCharacter,
  defaultLine,
  defaultCutscene,
  defaultSpawn,
  defaultKeyframe,
  defaultStage,
  loadCreations,
  saveCreations,
  usedSprites,
  usedFiles,
};
export type {
  Frame,
  Wall,
  Curve,
  Wave,
  Rank,
  Difficulty,
  Vector,
  Pattern,
  Enemy,
  Background,
  Ring,
  Spell,
  Waveform,
  SoundSource,
  Sound,
  Emotion,
  Character,
  Line,
  Cutscene,
  Spawn,
  Keyframe,
  Stage,
  Creations,
};
