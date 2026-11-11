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

type Appearance = "always" | "nomiss" | "nobomb" | "perfect";

type Drop =
  "power" | "point" | "big" | "life" | "lifepiece" | "bomb" | "bombpiece";

type Drops = Record<Drop, number>;

type Difficulty = "easy" | "normal" | "hard" | "lunatic";

type EffectGroup = "lasting" | "special" | "instant";

type Stat = "fireRate" | "bulletSpeed" | "moveSpeed" | "damage";

type ModifierTarget = "player" | "enemies";

type Modifier = {
  stat: Stat;
  amount: number; // %
};

type EffectMode =
  | "timed"
  | "instant"
  | "shield"
  | "stacking"
  | "curse"
  | "aura"
  | "ramp"
  | "focus";

type InstantAction = "clear" | "score" | "bomb" | "life" | "shield";

type Cleanse = "graze" | "defeat";

type RampShape = "rise" | "fade";

type AuraKind = "slow" | "erase";

type WorldKind =
  "freeze" | "mirror" | "fog" | "windBullets" | "windPlayer" | "recolor";

type World = {
  kind: WorldKind;
  strength: number; // % or units/s
  angle: number; // deg from straight down
  color: string;
};

type Effect = {
  id: string;
  name: string;
  mode: EffectMode;
  color: string;
  duration: number; // s
  action: InstantAction;
  hits: number;
  stacks: number;
  cleanse: Cleanse;
  cleanseTime: number; // s
  ramp: RampShape;
  aura: AuraKind;
  auraRadius: number; // units
  auraSlow: number; // %
  modifiers: Array<Modifier>;
  world: Array<World>;
  pickupSound: string | null;
};

type EffectDrop = {
  effect: string | null;
  chance: number; // %
};

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
  fireSound: string | null;
};

type Look = "energy" | "sprite";

type Shape = "orb" | "rice" | "star" | "kunai" | "ring" | "heart" | "diamond";

type Blend = "normal" | "light";

type Glow = {
  color: string;
  size: number; // of body
  opacity: number; // %
  softness: number; // of body
  blend: Blend;
};

type Bullet = {
  id: string;
  name: string;
  look: Look;
  pixels: string;
  shape: Shape;
  glows: Array<Glow>;
  length: number; // of width
};

type VesselLook = "built" | "drawn";

type Hull = "dart" | "pod" | "block" | "manta" | "needle" | "orb";

type Wings =
  "none" | "swept" | "delta" | "straight" | "twin" | "ring" | "blade";

type Engines = "none" | "nozzle" | "nacelle" | "booster";

type Guns = "none" | "cannons" | "spike" | "prongs" | "array";

type Fins = "none" | "tail" | "spines" | "horns" | "ridge";

type Core = "none" | "eye" | "slit" | "cross" | "twin";

type Livery = "plain" | "stripe" | "bands" | "panels" | "twotone";

type Build = {
  hull: Hull;
  length: number; // %
  width: number; // %
  wings: Wings;
  span: number; // %
  sweep: number; // %
  wingSpot: number; // %
  engines: Engines;
  engineCount: number;
  engineSize: number; // %
  guns: Guns;
  gunLength: number; // %
  fins: Fins;
  core: Core;
  coreSpot: number; // %
  livery: Livery;
  hullColor: string;
  trimColor: string;
  metalColor: string;
  glowColor: string;
};

type Vessel = {
  id: string;
  name: string;
  scale: number;
  pixels: string;
  look: VesselLook;
  build: Build;
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
  defeatSound: string | null;
  drops: Drops;
  effects: Array<EffectDrop>;
  bars: Array<Bar>;
};

type Bar = {
  id: string;
  health: number;
  time: number; // s
  spell: string | null;
  attack: string | null;
  move: Vector | null; // of field
  appears: Appearance;
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
  declareSound: string | null;
  survival: boolean;
};

type Waveform = "square" | "sine" | "sawtooth" | "triangle" | "noise";

type SoundSource = "synth" | "file" | "song" | "ambient";

type Bassline = "sub" | "reese";

type Singer = "lead" | "choir" | "bank" | "ritsu";

type Tone =
  | "saw"
  | "square"
  | "piano"
  | "guitar"
  | "bell"
  | "organ"
  | "strings"
  | "flute"
  | "hoover";

type Note = {
  step: number;
  length: number; // steps
  pitch: number; // midi
  velocity: number;
  roll: number;
  vowel: number;
};

type Channel = {
  id: string;
  name: string;
  instrument: string;
  kit: number;
  volume: number;
  pan: number;
  insert: number;
  mute: boolean;
  sample: string | null;
  cut: boolean;
};

type Sequence = {
  id: string;
  name: string;
  bars: number;
  notes: Record<string, Array<Note>>;
};

type Clip = {
  pattern: string;
  track: number;
  step: number;
  length: number; // steps
};

type Insert = {
  name: string;
  volume: number;
  pan: number;
  mute: boolean;
  grit: number;
  space: number;
  delay: number; // steps
  filter: number;
};

type Score = {
  tempo: number; // bpm
  key: number; // semitones
  swing: number;
  singer: Singer;
  voicebank: Array<string | null>;
  lyrics: string;
  shared: boolean;
  channels: Array<Channel>;
  patterns: Array<Sequence>;
  clips: Array<Clip>;
  tracks: number;
  inserts: Array<Insert>;
};

type Ambience = {
  levels: Array<number>;
  brightness: number;
  motion: number;
  length: number; // s
  seed: number;
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
  ambience: Ambience;
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
  layers: Array<Parallax>;
};

type SceneKind =
  | "stars"
  | "clouds"
  | "rain"
  | "motes"
  | "waves"
  | "islands"
  | "city"
  | "nebula"
  | "grid";

type Scenery = {
  kind: SceneKind;
  color: string;
  accent: string;
  density: number; // %
  size: number; // %
  seed: number;
};

type Parallax = {
  sprite: string | null;
  scene: Scenery | null;
  scroll: number; // units/s
  drift: number; // units/s
  opacity: number;
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
  effectsTo?: ModifierTarget;
};

type Keyframe = {
  id: string;
  time: number; // s
  spawns: Array<Spawn>;
  cutscene: string | null;
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
  titleCard: boolean;
};

type Run = {
  id: string;
  name: string;
  difficulty: Difficulty;
  stages: Array<string | null>;
};

type GameEffect =
  | "graze"
  | "item"
  | "power"
  | "miss"
  | "capture"
  | "timeout"
  | "cancel"
  | "extend"
  | "bombget";

type GameSounds = Record<GameEffect, string | null>;

type Game = {
  id: string;
  name: string;
  runs: Record<Difficulty, string | null>;
  ost: string | null;
  sounds: GameSounds;
  extends: Array<number>;
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

type Recipe = "ring" | "fan" | "spiral" | "stream" | "rain";

type Motion = "dive" | "cross" | "swoop" | "hover" | "weave";

type Weighted = {
  value: number;
  weight: number;
};

type CardPick = {
  card: string | null;
  weight: number;
};

type DiceTable = {
  weights: Record<string, number>;
  entries: Array<Weighted>;
  cards: Array<CardPick>;
};

type Dice = {
  seed: number;
  sections: Record<string, Record<string, DiceTable>>;
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
  effects: Array<Effect>;
  dice: Record<string, Dice>;
};

export type {
  ModifierTarget,
  EffectMode,
  InstantAction,
  Cleanse,
  RampShape,
  AuraKind,
  WorldKind,
  World,
  GameEffect,
  GameSounds,
  Frame,
  Wall,
  Curve,
  Wave,
  Rank,
  Appearance,
  Drop,
  Drops,
  Parallax,
  SceneKind,
  Scenery,
  Difficulty,
  EffectGroup,
  Stat,
  Modifier,
  Effect,
  EffectDrop,
  Vector,
  Pattern,
  Look,
  Shape,
  Bullet,
  Blend,
  Glow,
  VesselLook,
  Hull,
  Wings,
  Engines,
  Guns,
  Fins,
  Core,
  Livery,
  Build,
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
  Tone,
  Note,
  Channel,
  Sequence,
  Clip,
  Insert,
  Score,
  Ambience,
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
  Recipe,
  Motion,
  Weighted,
  CardPick,
  DiceTable,
  Dice,
  Creations,
  Side,
};
