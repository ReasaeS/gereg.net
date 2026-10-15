import type {
  Pattern,
  Enemy,
  Bar,
  Background,
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
  Creations,
} from "./types";

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
  };
}

function defaultEnemy(pattern: string | null): Enemy {
  return {
    id: createId(),
    name: "Fairy",
    sprite: null,
    color: "#7ad8ff",
    size: 28,
    rank: "regular",
    pattern: pattern,
    bars: [defaultBar(20)],
  };
}

function defaultBar(health: number): Bar {
  return {
    id: createId(),
    health: health,
    time: 30,
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
  const sigil: Sigil = defaultSigil();
  const characters: Array<Character> = defaultCharacters();

  return {
    stages: [defaultStage(enemy.id, background.id)],
    patterns: [pattern],
    enemies: [enemy],
    backgrounds: [background],
    sigils: [sigil],
    spells: [{ ...defaultSpell(sigil.id), name: "Spell 1" }],
    sounds: [defaultSound()],
    characters: characters,
    cutscenes: [defaultCutscene(characters)],
  };
}

export {
  defaultSpawnY,
  createId,
  defaultPattern,
  defaultEnemy,
  defaultBar,
  defaultBackground,
  defaultRing,
  defaultSigil,
  defaultSpell,
  repairSpells,
  limitBars,
  defaultSound,
  defaultEmotion,
  defaultCharacter,
  defaultLine,
  defaultCutscene,
  derivativeNames,
  defaultSpawn,
  defaultKeyframe,
  defaultStage,
  defaultCreations,
};
