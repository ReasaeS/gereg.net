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
  rank: Rank;
  pattern: string | null;
  bars: Array<Bar>;
};

type Bar = {
  id: string;
  health: number;
  time: number; // s
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

type Sigil = {
  id: string;
  name: string;
  color: string;
  opacity: number;
  rings: Array<Ring>;
};

type Spell = {
  id: string;
  name: string;
  sigil: string;
  background: string | null;
  pattern: string | null;
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

type Wallpaper = {
  id: string;
  name: string;
  sprite: string | null;
  base: string;
  stripe: string;
  stripes: number; // units
};

type Palette = {
  id: string;
  name: string;
  accent: string;
  highlight: string;
  text: string;
  label: string;
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
  wallpaper: string | null;
  palette: string | null;
  music: string | null;
  difficulty: Difficulty;
  length: number; // s
  keyframes: Array<Keyframe>;
};

type Run = {
  id: string;
  name: string;
  difficulty: Difficulty;
  stages: Array<string | null>;
};

type Game = {
  id: string;
  name: string;
  runs: Record<Difficulty, string | null>;
};

type Creations = {
  stages: Array<Stage>;
  runs: Array<Run>;
  games: Array<Game>;
  patterns: Array<Pattern>;
  enemies: Array<Enemy>;
  backgrounds: Array<Background>;
  wallpapers: Array<Wallpaper>;
  palettes: Array<Palette>;
  sigils: Array<Sigil>;
  spells: Array<Spell>;
  sounds: Array<Sound>;
  characters: Array<Character>;
  cutscenes: Array<Cutscene>;
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
  Bar,
  Background,
  Wallpaper,
  Palette,
  Ring,
  Sigil,
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
  Run,
  Game,
  Creations,
  Side,
};
