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
  bullet: string | null;
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

type Look = "energy" | "sprite";

type Shape = "orb" | "rice" | "star" | "kunai" | "ring" | "heart" | "diamond";

type Bullet = {
  id: string;
  name: string;
  look: Look;
  pixels: string;
  shape: Shape;
  glow: string;
  core: string;
  coreSize: number; // of body
  glowSize: number; // of body
  length: number; // of width
};

type Vessel = {
  id: string;
  name: string;
  scale: number;
  pixels: string;
};

type Enemy = {
  id: string;
  name: string;
  vessel: string | null;
  color: string;
  size: number; // units
  rank: Rank;
  pattern: string | null;
  theme: string | null;
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

type SoundSource = "synth" | "file" | "song";

type Bassline = "sub" | "reese";

type Singer = "lead" | "choir" | "bank" | "ritsu";

type Score = {
  tempo: number; // bpm
  key: number; // semitones
  bars: number;
  swing: number;
  grit: number;
  space: number;
  bass: Bassline;
  drums: Array<Array<number>>;
  bassline: Array<number>;
  pads: Array<number>;
  kits: Array<number>;
  mutes: Array<number>;
  vocals: Array<number>;
  vowels: Array<number>;
  voice: number;
  singer: Singer;
  voicebank: Array<string | null>;
};

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
  score: Score;
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

type Pace = {
  from: number; // chars
  to: number; // chars
  speed: number; // chars/s
};

type Line = {
  id: string;
  character: string;
  emotion: string;
  text: string;
  focus?: boolean;
  sound?: string;
  paces?: Array<Pace>;
};

type Cutscene = {
  id: string;
  name: string;
  voice: string | null;
  background: string | null;
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

type Motif =
  "stripes" | "checks" | "dots" | "grid" | "diamonds" | "zigzag" | "waves";

type Wallpaper = {
  id: string;
  name: string;
  motif: Motif;
  base: string;
  ink: string;
  size: number; // units
  spacing: number; // units
  angle: number; // deg
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
  ost: string | null;
};

type OstTrack = {
  sound: string | null;
  background: string | null;
  wallpaper: string | null;
};

type Ost = {
  id: string;
  name: string;
  tracks: Array<OstTrack>;
};

type Creations = {
  stages: Array<Stage>;
  runs: Array<Run>;
  games: Array<Game>;
  patterns: Array<Pattern>;
  enemies: Array<Enemy>;
  backgrounds: Array<Background>;
  wallpapers: Array<Wallpaper>;
  bullets: Array<Bullet>;
  vessels: Array<Vessel>;
  palettes: Array<Palette>;
  sigils: Array<Sigil>;
  spells: Array<Spell>;
  sounds: Array<Sound>;
  osts: Array<Ost>;
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
  Look,
  Shape,
  Bullet,
  Vessel,
  Enemy,
  Bar,
  Background,
  Motif,
  Wallpaper,
  Palette,
  Ring,
  Sigil,
  Spell,
  Waveform,
  SoundSource,
  Bassline,
  Singer,
  Score,
  Sound,
  Emotion,
  Character,
  Pace,
  Line,
  Cutscene,
  Spawn,
  Keyframe,
  Stage,
  Run,
  Game,
  Ost,
  OstTrack,
  Creations,
  Side,
};
