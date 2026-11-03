import type { Bassline, Score, Singer } from "./types";

type Voice = (time: number) => number;

type Run = {
  start: number;
  length: number;
  degree: number;
};

type Phrase = {
  start: number;
  notes: Array<number>;
};

type Vowel = {
  name: string;
  formants: Array<Array<number>>;
};

type Style = {
  open: number;
  closing: number;
  breath: number;
  vibrato: number; // semitones
  gain: number;
  ring: number; // dB
  detunes: Array<number>; // semitones
  delays: Array<number>; // s
};

type Bank = {
  samples: Float32Array;
  marks: Array<number>;
  period: number; // samples
  pitch: number; // Hz
  level: number;
};

type Kit = {
  name: string;
  kickLow: number; // Hz
  kickSweep: number; // Hz
  kickFade: number; // 1/s
  snareTone: number; // Hz
  snareFade: number; // 1/s
  hatFade: number; // 1/s
  grit: number;
};

const stepsPerBar: number = 16;
const beatsPerBar: number = 4;
const stepsPerBeat: number = stepsPerBar / beatsPerBar;
const drumLanes: Array<string> = ["Kick", "Snare", "Ghost", "Hat", "Ride"];
const noteRows: number = 8;
const partCount: number = 4;
const vowels: Array<Vowel> = [
  {
    name: "Aah",
    formants: [
      [800, 0, 80],
      [1150, -6, 90],
      [2900, -32, 120],
      [3900, -20, 130],
      [4950, -50, 140],
    ],
  },
  {
    name: "Ooh",
    formants: [
      [325, 0, 50],
      [700, -16, 60],
      [2530, -35, 170],
      [3500, -40, 180],
      [4950, -60, 200],
    ],
  },
  {
    name: "Eeh",
    formants: [
      [270, 0, 60],
      [2140, -12, 90],
      [2950, -26, 100],
      [3900, -26, 120],
      [4950, -44, 120],
    ],
  },
  {
    name: "Oh",
    formants: [
      [450, 0, 70],
      [800, -11, 80],
      [2830, -22, 100],
      [3800, -22, 130],
      [4950, -50, 135],
    ],
  },
  {
    name: "Mmm",
    formants: [
      [250, 0, 60],
      [1700, -30, 100],
      [2500, -36, 120],
      [3300, -42, 150],
      [4900, -60, 200],
    ],
  },
];
const vocalRange: number = 8;
const vocalAttack: number = 0.12; // s
const vocalRelease: number = 0.3; // s
const vocalGlide: number = 0.07; // s
const vocalScoop: number = 0.7; // semitones
const flowScale: number = 0.1;
const vibratoRate: number = 5.3; // Hz
const vibratoDelay: number = 0.2; // s
const vibratoRamp: number = 0.35; // s
const vibratoSpread: number = 0.05;
const jitterDepth: number = 0.08; // semitones
const shimmerDepth: number = 0.08;
const wanderTime: number = 0.06; // s
const formantLift: number = 1.1;
const filterEvery: number = 16; // samples
const vocalEcho: number = 6;
const vocalMix: number = 1;
const bankEdge: number = 0.15;
const bankMinimum: number = 0.2; // s
const pitchLow: number = 70; // Hz
const pitchHigh: number = 1000; // Hz
const pitchWindow: number = 0.06; // s
const pitchClarity: number = 0.9;
const pitchConfidence: number = 0.5;
const markReach: number = 0.2;
const bankLevel: number = 0.25;
const blendTime: number = 0.06; // s
const octaveMost: number = 32;
const analysed: WeakMap<Float32Array, Bank | null> = new WeakMap();
const ringCenter: number = 3000; // Hz
const ringWidth: number = 300; // Hz
const styles: Record<Singer, Style> = {
  lead: {
    open: 0.32,
    closing: 0.12,
    breath: 0.12,
    vibrato: 0.5,
    gain: 3,
    ring: -8,
    detunes: [0],
    delays: [0],
  },
  choir: {
    open: 0.45,
    closing: 0.18,
    breath: 0.35,
    vibrato: 0.35,
    gain: 1.2,
    ring: -40,
    detunes: [-0.07, 0, 0.07],
    delays: [0.014, 0, 0.026],
  },
  bank: {
    open: 0.32,
    closing: 0.12,
    breath: 0.12,
    vibrato: 0.35,
    gain: 3,
    ring: -8,
    detunes: [0],
    delays: [0],
  },
  ritsu: {
    open: 0.32,
    closing: 0.12,
    breath: 0.12,
    vibrato: 0.35,
    gain: 3,
    ring: -8,
    detunes: [0],
    delays: [0],
  },
};
const kits: Array<Kit> = [
  {
    name: "Break",
    kickLow: 58,
    kickSweep: 95,
    kickFade: 12,
    snareTone: 225,
    snareFade: 15,
    hatFade: 50,
    grit: 0.25,
  },
  {
    name: "Tight",
    kickLow: 50,
    kickSweep: 140,
    kickFade: 9,
    snareTone: 200,
    snareFade: 22,
    hatFade: 75,
    grit: 0,
  },
  {
    name: "Heavy",
    kickLow: 42,
    kickSweep: 160,
    kickFade: 6,
    snareTone: 175,
    snareFade: 16,
    hatFade: 65,
    grit: 0.1,
  },
  {
    name: "Lo-fi",
    kickLow: 55,
    kickSweep: 100,
    kickFade: 10,
    snareTone: 210,
    snareFade: 14,
    hatFade: 45,
    grit: 0.6,
  },
];
const scaleSteps: Array<number> = [0, 2, 3, 5, 7, 8, 10];
const keyNames: Array<string> = [
  "A",
  "A#",
  "B",
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
];
const barOptions: Array<number> = [1, 2, 4, 8, 16];
const tempoMin: number = 160; // bpm
const tempoMax: number = 180; // bpm
const swingMax: number = 0.6;
const noiseSeed: number = 90210;
const bassBase: number = 55; // Hz
const kickLength: number = 0.32; // s
const kickBend: number = 28; // 1/s
const clickFade: number = 400; // 1/s
const snareLength: number = 0.24; // s
const toneFade: number = 30; // 1/s
const ghostFade: number = 1.7;
const ghostLevel: number = 0.35;
const hatLength: number = 0.06; // s
const rideLength: number = 0.45; // s
const rideFade: number = 7; // 1/s
const rideTones: Array<number> = [540, 803, 1171]; // Hz
const gritHold: number = 5; // samples
const gritBits: number = 10;
const noteAttack: number = 0.006; // s
const noteRelease: number = 0.04; // s
const reeseDetune: number = 0.18; // semitones
const reeseCutoff: number = 260; // Hz
const reeseSweep: number = 520; // Hz
const reeseWobble: number = 0.35; // Hz
const padAttack: number = 0.3; // s
const padRelease: number = 0.8; // s
const padDetune: number = 0.08; // semitones
const padCutoff: number = 1400; // Hz
const padLevel: number = 0.08;
const echoSteps: number = 3;
const drumMix: number = 0.8;
const bassMix: number = 0.75;
const padMix: number = 0.6;
const masterDrive: number = 1.1;
const masterLevel: number = 0.9;
const defaultBeat: Array<Array<string>> = [
  [
    "x.........x.....",
    "x.x.......xx....",
    "x.........x.....",
    "x.x.......x.....",
  ],
  [
    "....x.......x...",
    "....x.......x...",
    "....x.......x...",
    "....x.....x.x.xx",
  ],
  [
    ".......x.x....x.",
    ".......x.......x",
    ".......x.x....x.",
    ".......x.x......",
  ],
  [
    "x.x.x.x.x.x.x.xx",
    "x.x.x.x.x.x.x.x.",
    "x.x.x.x.x.x.x.xx",
    "x.x.x.x.x.x.....",
  ],
  [
    "................",
    "................",
    "................",
    "................",
  ],
];
const defaultBass: Array<string> = [
  "111111....666666",
  "444444....555555",
  "111111....666666",
  "666666....777777",
];
const defaultPads: Array<string> = [
  "1111111111111111",
  "1111111111111111",
  "6666666666666666",
  "7777777777777777",
];
const defaultVocals: Array<string> = [
  "8888888877776666",
  "5555555555555...",
  "3333444455556666",
  "5555555555555555",
];
const defaultVowels: Array<number> = [0, 1];

function defaultScore(): Score {
  const bars: number = defaultBass.length;
  const drums: Array<Array<number>> = defaultBeat.map((lane: Array<string>) => {
    const steps: Array<number> = new Array();

    for (let bar = 0; bar < bars; bar++) {
      for (const mark of lane[bar % lane.length]!) {
        steps.push(mark === "x" ? 1 : 0);
      }
    }

    return steps;
  });

  function notes(rows: Array<string>): Array<number> {
    const steps: Array<number> = new Array();

    for (const row of rows) {
      for (const mark of row) {
        steps.push(mark === "." ? -1 : Number(mark) - 1);
      }
    }

    return steps;
  }

  return {
    tempo: 172,
    key: 0,
    bars: bars,
    swing: 0.1,
    grit: 0.4,
    space: 0.5,
    bass: "sub",
    drums: drums,
    bassline: notes(defaultBass),
    pads: notes(defaultPads),
    kits: repeated([0], bars),
    mutes: repeated([0], partCount),
    vocals: notes(defaultVocals),
    vowels: repeated(defaultVowels, bars * beatsPerBar),
    voice: 0.6,
    singer: "ritsu",
    voicebank: vowels.map(() => null),
  };
}

function stepCount(score: Score): number {
  return score.bars * stepsPerBar;
}

function repeated(list: Array<number>, length: number): Array<number> {
  const steps: Array<number> = new Array();

  for (let index = 0; index < length; index++) {
    steps.push(list.length === 0 ? 0 : list[index % list.length]!);
  }

  return steps;
}

function resizeScore(score: Score, bars: number): void {
  const length: number = bars * stepsPerBar;

  score.bars = bars;
  score.drums = score.drums.map((lane: Array<number>) =>
    repeated(lane, length),
  );
  score.bassline = repeated(score.bassline, length);
  score.pads = repeated(score.pads, length);
  score.kits = repeated(score.kits, bars);
  score.vocals = repeated(score.vocals, length);
  score.vowels = repeated(score.vowels, bars * beatsPerBar);
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, min), max)
    : fallback;
}

function cleanSteps(
  value: unknown,
  length: number,
  min: number,
  max: number,
  fallback: number,
): Array<number> {
  const list: Array<unknown> = Array.isArray(value) ? value : new Array();
  const steps: Array<number> = new Array();

  for (let index = 0; index < length; index++) {
    steps.push(Math.round(clampNumber(list[index], min, max, fallback)));
  }

  return steps;
}

function cleanVowels(value: unknown, bars: number): Array<number> {
  const list: Array<unknown> = Array.isArray(value) ? value : new Array();
  const beats: number = bars * beatsPerBar;

  if (list.length === 0) {
    return repeated(defaultVowels, beats);
  }

  if (list.length === bars) {
    return cleanSteps(
      list.flatMap((entry: unknown) => {
        const first: number = Math.round(
          clampNumber(entry, 0, vowels.length - 1, 0),
        );
        const second: number = (first + 1) % vowels.length;

        return [first, second, first, second];
      }),
      beats,
      0,
      vowels.length - 1,
      0,
    );
  }

  return cleanSteps(list, beats, 0, vowels.length - 1, 0);
}

function repairScore(value: unknown): Score {
  const fallback: Score = defaultScore();

  if (typeof value !== "object" || value === null) {
    return fallback;
  }

  const stale: Partial<Record<keyof Score, unknown>> = value;
  const bars: number = barOptions.includes(stale.bars as number)
    ? (stale.bars as number)
    : fallback.bars;
  const length: number = bars * stepsPerBar;
  const drums: Array<unknown> = Array.isArray(stale.drums)
    ? stale.drums
    : new Array();

  return {
    tempo: Math.round(
      clampNumber(stale.tempo, tempoMin, tempoMax, fallback.tempo),
    ),
    key: Math.round(clampNumber(stale.key, 0, keyNames.length - 1, 0)),
    bars: bars,
    swing: clampNumber(stale.swing, 0, swingMax, fallback.swing),
    grit: clampNumber(stale.grit, 0, 1, fallback.grit),
    space: clampNumber(stale.space, 0, 1, fallback.space),
    bass: stale.bass === "reese" ? "reese" : "sub",
    drums: drumLanes.map((_: string, lane: number) =>
      cleanSteps(drums[lane], length, 0, 1, 0),
    ),
    bassline: cleanSteps(stale.bassline, length, -1, noteRows - 1, -1),
    pads: cleanSteps(stale.pads, length, -1, noteRows - 1, -1),
    kits: cleanSteps(stale.kits, bars, 0, kits.length - 1, 0),
    mutes: cleanSteps(stale.mutes, partCount, 0, 1, 0),
    vocals: cleanSteps(stale.vocals, length, -1, noteRows - 1, -1),
    vowels: cleanVowels(stale.vowels, bars),
    voice: clampNumber(stale.voice, 0, 1, fallback.voice),
    singer:
      stale.singer === "choir" ||
      stale.singer === "bank" ||
      stale.singer === "ritsu"
        ? stale.singer
        : "lead",
    voicebank: vowels.map((_: Vowel, index: number) => {
      const entry: unknown = Array.isArray(stale.voicebank)
        ? stale.voicebank[index]
        : null;

      return typeof entry === "string" ? entry : null;
    }),
  };
}

function degreeSemitones(degree: number): number {
  return scaleSteps[degree % scaleSteps.length]! + 12 * Math.floor(degree / 7);
}

function noteName(score: Score, degree: number): string {
  return keyNames[(score.key + degreeSemitones(degree)) % keyNames.length]!;
}

function rootFrequency(key: number): number {
  return bassBase * 2 ** ((((key + 5) % 12) - 5) / 12);
}

function stepLength(score: Score): number {
  return 60 / score.tempo / 4;
}

function scoreLength(score: Score): number {
  return stepCount(score) * stepLength(score);
}

function stepTime(score: Score, step: number): number {
  return (step + (step % 2 === 1 ? score.swing * 0.5 : 0)) * stepLength(score);
}

function runsOf(line: Array<number>): Array<Run> {
  const runs: Array<Run> = new Array();

  for (let step = 0; step < line.length; step++) {
    const degree: number = line[step]!;

    if (degree < 0) {
      continue;
    }

    const last: Run | undefined = runs[runs.length - 1];

    if (
      last !== undefined &&
      last.degree === degree &&
      last.start + last.length === step
    ) {
      last.length++;
    } else {
      runs.push({ start: step, length: 1, degree: degree });
    }
  }

  return runs;
}

function phrasesOf(line: Array<number>): Array<Phrase> {
  const phrases: Array<Phrase> = new Array();

  for (let step = 0; step < line.length; step++) {
    const last: Phrase | undefined = phrases[phrases.length - 1];

    if (line[step]! < 0) {
      continue;
    }

    if (last !== undefined && last.start + last.notes.length === step) {
      last.notes.push(line[step]!);
    } else {
      phrases.push({ start: step, notes: [line[step]!] });
    }
  }

  return phrases;
}

function createNoise(): () => number {
  let seed: number = noiseSeed;

  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 - 1;
  };
}

function place(
  target: Float32Array,
  start: number,
  length: number,
  rate: number,
  voice: Voice,
): void {
  const from: number = Math.round(start * rate);
  const count: number = Math.round(length * rate);

  for (let index = 0; index < count; index++) {
    target[(from + index) % target.length]! += voice(index / rate);
  }
}

function saw(phase: number): number {
  return (phase % 1) * 2 - 1;
}

function kick(kit: Kit, rate: number, random: () => number): Voice {
  let phase: number = 0;

  return (time: number) => {
    phase += (kit.kickLow + kit.kickSweep * Math.exp(-time * kickBend)) / rate;

    return (
      Math.sin(Math.PI * 2 * phase) * Math.exp(-time * kit.kickFade) +
      random() * Math.exp(-time * clickFade) * 0.3
    );
  };
}

function snare(
  kit: Kit,
  random: () => number,
  fade: number,
  level: number,
): Voice {
  let last: number = 0;

  return (time: number) => {
    const sample: number = random();
    const bright: number = sample - last;

    last = sample;

    return (
      level *
      (Math.sin(Math.PI * 2 * kit.snareTone * time) *
        Math.exp(-time * toneFade) *
        0.45 +
        bright * Math.exp(-time * fade) * 0.5)
    );
  };
}

function hat(kit: Kit, random: () => number): Voice {
  let last: number = 0;

  return (time: number) => {
    const sample: number = random();
    const bright: number = sample - last;

    last = sample;

    return bright * Math.exp(-time * kit.hatFade) * 0.22;
  };
}

function ride(random: () => number): Voice {
  let last: number = 0;

  return (time: number) => {
    const sample: number = random();
    const bright: number = sample - last;
    const metal: number =
      rideTones.reduce(
        (total: number, tone: number) =>
          total + Math.sign(Math.sin(Math.PI * 2 * tone * time)),
        0,
      ) / rideTones.length;

    last = sample;

    return (bright * 0.08 + metal * 0.05) * Math.exp(-time * rideFade);
  };
}

function envelope(
  time: number,
  length: number,
  attack: number,
  release: number,
): number {
  return Math.max(Math.min(time / attack, 1, 1 + (length - time) / release), 0);
}

function bassVoice(
  bass: Bassline,
  frequency: number,
  length: number,
  rate: number,
): Voice {
  const spread: number = 2 ** (reeseDetune / 12);
  let low: number = 0;
  let high: number = 0;
  let filtered: number = 0;

  return (time: number) => {
    const level: number = Math.min(
      time / noteAttack,
      1,
      Math.max((length - time) / noteRelease, 0),
    );

    low += frequency / spread / rate;
    high += (frequency * spread) / rate;

    const body: number = Math.sin(Math.PI * 2 * (low + high) * 0.5);

    if (bass === "sub") {
      return (
        Math.tanh((body + 0.2 * Math.sin(Math.PI * 2 * (low + high))) * 1.5) *
        0.6 *
        level
      );
    }

    const cutoff: number =
      reeseCutoff +
      reeseSweep * (0.5 + 0.5 * Math.sin(Math.PI * 2 * reeseWobble * time));

    filtered +=
      (1 - Math.exp((-Math.PI * 2 * cutoff) / rate)) *
      ((saw(low) + saw(high)) * 0.5 - filtered);

    return Math.tanh(filtered * 1.8 + body * 0.5) * 0.6 * level;
  };
}

function padVoice(frequency: number, length: number, rate: number): Voice {
  const spread: number = 2 ** (padDetune / 12);
  const smoothing: number = 1 - Math.exp((-Math.PI * 2 * padCutoff) / rate);
  let low: number = 0;
  let high: number = 0;
  let filtered: number = 0;

  return (time: number) => {
    low += frequency / spread / rate;
    high += (frequency * spread) / rate;
    filtered += smoothing * ((saw(low) + saw(high)) * 0.5 - filtered);

    return filtered * padLevel * envelope(time, length, padAttack, padRelease);
  };
}

function glottalFlow(phase: number, style: Style): number {
  if (phase < style.open) {
    return 0.5 * (1 - Math.cos((Math.PI * phase) / style.open));
  }

  if (phase < style.open + style.closing) {
    return Math.cos(((Math.PI / 2) * (phase - style.open)) / style.closing);
  }

  return 0;
}

function vocalVoice(
  score: Score,
  phrase: Phrase,
  root: number,
  singer: number,
  random: () => number,
  rate: number,
): Voice {
  const step: number = stepLength(score);
  const length: number = phrase.notes.length * step;
  const glide: number = 1 - Math.exp(-1 / (vocalGlide * rate));
  const wander: number = 1 - Math.exp(-1 / (wanderTime * rate));
  const wanderEvery: number = Math.max(Math.round(wanderTime * rate), 1);
  const blend: number = Math.min(glide * filterEvery, 1);
  const style: Style = styles[score.singer];
  const detune: number = style.detunes[singer]!;
  const sway: number = 1 + (singer - 1) * vibratoSpread;
  const offset: number = singer * 2.1;
  const first: Vowel = vowelAt(0);
  const states: Array<Array<number>> = targetsOf(first).map(() => [0, 0, 0, 0]);
  const filters: Array<Array<number>> = targetsOf(first).map(() => [
    0, 0, 0, 0,
  ]);
  const shape: Array<Array<number>> = targetsOf(first).map(
    (formant: Array<number>) => formant.slice(),
  );
  let pitch: number = degreeSemitones(phrase.notes[0]!) - vocalScoop;
  let held: number = phrase.notes[0]!;
  let noteStart: number = 0;
  let phase: number = 0;
  let flow: number = 0;
  let count: number = 0;
  let jitter: number = 0;
  let jitterGoal: number = 0;
  let shimmer: number = 1;
  let shimmerGoal: number = 1;

  function targetsOf(vowel: Vowel): Array<Array<number>> {
    return [...vowel.formants, [ringCenter, style.ring, ringWidth]];
  }

  function vowelAt(index: number): Vowel {
    return vowels[
      score.vowels[Math.floor((phrase.start + index) / stepsPerBeat)] ?? 0
    ]!;
  }

  return (time: number) => {
    const index: number = Math.min(
      Math.floor(time / step),
      phrase.notes.length - 1,
    );
    const degree: number = phrase.notes[index]!;

    if (degree !== held) {
      held = degree;
      noteStart = time;
    }

    pitch += (degreeSemitones(degree) - pitch) * glide;
    jitter += (jitterGoal - jitter) * wander;
    shimmer += (shimmerGoal - shimmer) * wander;

    const vibrato: number =
      style.vibrato *
      Math.min(
        Math.max((time - noteStart - vibratoDelay) / vibratoRamp, 0),
        1,
      ) *
      Math.sin(Math.PI * 2 * vibratoRate * sway * time + offset);
    const frequency: number =
      root * vocalRange * 2 ** ((pitch + vibrato + jitter + detune) / 12);

    phase += frequency / rate;

    if (phase >= 1) {
      phase -= Math.floor(phase);
    }

    if (count % wanderEvery === 0) {
      jitterGoal = random() * jitterDepth;
      shimmerGoal = 1 + random() * shimmerDepth;
    }

    if (count % filterEvery === 0) {
      const targets: Array<Array<number>> = targetsOf(vowelAt(index));

      for (let formant = 0; formant < shape.length; formant++) {
        const target: Array<number> = targets[formant]!;
        const current: Array<number> = shape[formant]!;

        for (let field = 0; field < current.length; field++) {
          current[field]! += (target[field]! - current[field]!) * blend;
        }

        const center: number =
          formant === 0
            ? Math.max(current[0]!, frequency * formantLift)
            : current[0]!;
        const angle: number = (Math.PI * 2 * center) / rate;
        const alpha: number = (Math.sin(angle) * current[2]!) / (2 * center);
        const norm: number = 1 + alpha;

        filters[formant] = [
          alpha / norm,
          (-2 * Math.cos(angle)) / norm,
          (1 - alpha) / norm,
          10 ** (current[1]! / 20),
        ];
      }
    }

    count++;

    const next: number = glottalFlow(phase, style);
    const pulse: number = ((next - flow) * rate * flowScale) / frequency;
    const source: number = pulse + random() * style.breath * (0.2 + next) * 0.3;

    flow = next;

    let output: number = 0;

    for (let formant = 0; formant < states.length; formant++) {
      const [x1, x2, y1, y2] = states[formant]! as [
        number,
        number,
        number,
        number,
      ];
      const [gain, a1, a2, level] = filters[formant]! as [
        number,
        number,
        number,
        number,
      ];
      const filtered: number = gain * source - gain * x2 - a1 * y1 - a2 * y2;

      states[formant] = [source, x1, filtered, y1];
      output += filtered * level;
    }

    return (
      output *
      shimmer *
      (style.gain / style.detunes.length) *
      envelope(time, length, vocalAttack, vocalRelease)
    );
  };
}

function crush(drums: Float32Array, grits: Array<number>): void {
  const barLength: number = drums.length / grits.length;
  let held: number = 0;

  for (let index = 0; index < drums.length; index++) {
    const grit: number =
      grits[Math.min(Math.floor(index / barLength), grits.length - 1)]!;
    const hold: number = 1 + Math.round(grit * gritHold);
    const levels: number = 2 ** Math.round(16 - grit * gritBits);
    const drive: number = 1 + grit * 2;

    if (index % hold === 0) {
      held = Math.round(drums[index]! * levels) / levels;
    }

    drums[index] = Math.tanh(held * drive) / Math.tanh(drive);
  }
}

function echo(pads: Float32Array, delay: number, space: number): void {
  const wet: Float32Array = new Float32Array(pads.length);
  const feedback: number = 0.25 + space * 0.45;

  for (let pass = 0; pass < 2; pass++) {
    for (let index = 0; index < pads.length; index++) {
      const from: number = (index - delay + pads.length * 2) % pads.length;

      wet[index] = (pads[from]! + wet[from]!) * feedback;
    }
  }

  for (let index = 0; index < pads.length; index++) {
    pads[index]! += wet[index]! * space;
  }
}

function audible(
  score: Score,
  line: Array<number>,
  part: number,
): Array<number> {
  return score.mutes[part] === 1 ? new Array() : line;
}

function detectPeriod(samples: Float32Array, rate: number): number | null {
  const size: number = Math.round(pitchWindow * rate);
  const from: number = Math.max(Math.floor(samples.length / 2 - size / 2), 0);
  const shortest: number = Math.floor(rate / pitchHigh);
  const longest: number = Math.ceil(rate / pitchLow);
  const scores: Array<number> = new Array();
  let best: number = 0;

  if (from + size + longest > samples.length) {
    return null;
  }

  for (let lag = shortest; lag <= longest; lag++) {
    let cross: number = 0;
    let first: number = 0;
    let second: number = 0;

    for (let index = from; index < from + size; index++) {
      const a: number = samples[index]!;
      const b: number = samples[index + lag]!;

      cross += a * b;
      first += a * a;
      second += b * b;
    }

    const value: number =
      first > 0 && second > 0 ? cross / Math.sqrt(first * second) : 0;

    scores.push(value);
    best = Math.max(best, value);
  }

  if (best < pitchConfidence) {
    return null;
  }

  for (let index = 0; index < scores.length; index++) {
    if (
      scores[index]! >= best * pitchClarity &&
      (index + 1 >= scores.length || scores[index]! >= scores[index + 1]!)
    ) {
      return shortest + index;
    }
  }

  return null;
}

function peakAt(samples: Float32Array, from: number, to: number): number {
  let found: number = from;

  for (let index = from; index < to; index++) {
    if (samples[index]! > samples[found]!) {
      found = index;
    }
  }

  return found;
}

function analyseBank(samples: Float32Array, rate: number): Bank | null {
  const cached: Bank | null | undefined = analysed.get(samples);

  if (cached !== undefined) {
    return cached;
  }

  const period: number | null =
    samples.length < bankMinimum * rate ? null : detectPeriod(samples, rate);
  let bank: Bank | null = null;

  if (period !== null) {
    const start: number = Math.floor(samples.length * bankEdge) + period;
    const end: number = Math.floor(samples.length * (1 - bankEdge)) - period;
    const marks: Array<number> = new Array();
    let mark: number = peakAt(samples, start, start + period);
    let energy: number = 0;

    while (mark + period * (1 + markReach) < end) {
      marks.push(mark);
      mark = peakAt(
        samples,
        mark + Math.round(period * (1 - markReach)),
        mark + Math.round(period * (1 + markReach)),
      );
    }

    for (let index = start; index < end; index++) {
      energy += samples[index]! ** 2;
    }

    const loudness: number = Math.sqrt(energy / Math.max(end - start, 1));

    bank =
      marks.length < 4 || loudness === 0
        ? null
        : {
            samples: samples,
            marks: marks,
            period: period,
            pitch: rate / period,
            level: bankLevel / loudness,
          };
  }

  analysed.set(samples, bank);

  return bank;
}

function bounce(count: number, span: number): number {
  if (span <= 1) {
    return 0;
  }

  const cycle: number = (span - 1) * 2;
  const position: number = count % cycle;

  return position < span ? position : cycle - position;
}

function addGrain(
  target: Float32Array,
  at: number,
  bank: Bank,
  mark: number,
  gain: number,
): void {
  const half: number = bank.period;

  for (let offset = -half; offset < half; offset++) {
    const index: number =
      (((at + offset) % target.length) + target.length) % target.length;

    target[index]! +=
      bank.samples[mark + offset]! *
      0.5 *
      (1 + Math.cos((Math.PI * offset) / half)) *
      gain;
  }
}

function bankOctave(score: Score, root: number, set: Array<Bank>): number {
  const notes: Array<number> = score.vocals.filter(
    (degree: number) => degree >= 0,
  );
  const middle: number =
    notes.reduce(
      (total: number, degree: number) => total + degreeSemitones(degree),
      0,
    ) / Math.max(notes.length, 1);
  const pitch: number =
    set.reduce((total: number, bank: Bank) => total + bank.pitch, 0) /
    set.length;
  const octave: number =
    2 ** Math.round(Math.log2(pitch / (root * 2 ** (middle / 12))));

  return Math.min(Math.max(octave, 1), octaveMost);
}

function singPhrase(
  target: Float32Array,
  score: Score,
  phrase: Phrase,
  root: number,
  set: Array<Bank | null>,
  random: () => number,
  rate: number,
): void {
  const style: Style = styles.bank;
  const step: number = stepLength(score);
  const length: number = phrase.notes.length * step;
  const total: number = Math.round((length + vocalRelease) * rate);
  const begin: number = Math.round(stepTime(score, phrase.start) * rate);
  const glide: number = 1 - Math.exp(-1 / (vocalGlide * rate));
  const wander: number = 1 - Math.exp(-1 / (wanderTime * rate));
  const wanderEvery: number = Math.max(Math.round(wanderTime * rate), 1);
  const ready: Array<Bank> = set.filter(
    (bank: Bank | null): bank is Bank => bank !== null,
  );
  const octave: number = bankOctave(score, root, ready);
  const frequencies: Float32Array = new Float32Array(total);
  const weights: Array<number> = set.map(() => 0);
  let pitch: number = degreeSemitones(phrase.notes[0]!) - vocalScoop;
  let held: number = phrase.notes[0]!;
  let noteStart: number = 0;
  let jitter: number = 0;
  let jitterGoal: number = 0;

  function voiceAt(index: number): number {
    const wanted: number =
      score.vowels[Math.floor((phrase.start + index) / stepsPerBeat)] ?? 0;

    return set[wanted] !== null
      ? wanted
      : set.findIndex((bank: Bank | null) => bank !== null);
  }

  for (let count = 0; count < total; count++) {
    const time: number = count / rate;
    const degree: number =
      phrase.notes[Math.min(Math.floor(time / step), phrase.notes.length - 1)]!;

    if (degree !== held) {
      held = degree;
      noteStart = time;
    }

    if (count % wanderEvery === 0) {
      jitterGoal = random() * jitterDepth;
    }

    pitch += (degreeSemitones(degree) - pitch) * glide;
    jitter += (jitterGoal - jitter) * wander;

    const vibrato: number =
      style.vibrato *
      Math.min(
        Math.max((time - noteStart - vibratoDelay) / vibratoRamp, 0),
        1,
      ) *
      Math.sin(Math.PI * 2 * vibratoRate * time);

    frequencies[count] = root * octave * 2 ** ((pitch + vibrato + jitter) / 12);
  }

  weights[voiceAt(0)] = 1;

  for (let at = 0; at < total;) {
    const spacing: number = rate / frequencies[Math.floor(at)]!;
    const time: number = at / rate;
    const current: number = voiceAt(
      Math.min(Math.floor(time / step), phrase.notes.length - 1),
    );
    const fade: number = 1 - Math.exp(-spacing / (blendTime * rate));
    const level: number =
      envelope(time, length, vocalAttack, vocalRelease) *
      (1 + random() * shimmerDepth * 0.5);

    for (let voice = 0; voice < set.length; voice++) {
      const bank: Bank | null = set[voice]!;

      weights[voice]! += ((voice === current ? 1 : 0) - weights[voice]!) * fade;

      if (bank === null || weights[voice]! < 0.001) {
        continue;
      }

      addGrain(
        target,
        begin + Math.round(at),
        bank,
        bank.marks[bounce(Math.floor(time * bank.pitch), bank.marks.length)]!,
        weights[voice]! * level * bank.level * (spacing / bank.period),
      );
    }

    at += spacing;
  }
}

function renderScore(
  score: Score,
  rate: number,
  voices: Array<Float32Array | null> = new Array(),
): Float32Array<ArrayBuffer> {
  const total: number = Math.max(Math.round(scoreLength(score) * rate), 1);
  const drums: Float32Array = new Float32Array(total);
  const bass: Float32Array = new Float32Array(total);
  const pads: Float32Array = new Float32Array(total);
  const vocals: Float32Array = new Float32Array(total);
  const mix: Float32Array<ArrayBuffer> = new Float32Array(total);
  const random: () => number = createNoise();
  const step: number = stepLength(score);
  const root: number = rootFrequency(score.key);

  for (let index = 0; index < stepCount(score); index++) {
    const bar: number = Math.floor(index / stepsPerBar);

    if (score.mutes[0] === 1) {
      break;
    }

    const kit: Kit = kits[score.kits[bar]!]!;
    const time: number = stepTime(score, index);
    const hits: Array<[number, Voice]> = [
      [kickLength, kick(kit, rate, random)],
      [snareLength, snare(kit, random, kit.snareFade, 1)],
      [snareLength, snare(kit, random, kit.snareFade * ghostFade, ghostLevel)],
      [hatLength, hat(kit, random)],
      [rideLength, ride(random)],
    ];

    for (let lane = 0; lane < hits.length; lane++) {
      if (score.drums[lane]?.[index] === 1) {
        place(drums, time, hits[lane]![0], rate, hits[lane]![1]);
      }
    }
  }

  for (const run of runsOf(audible(score, score.bassline, 1))) {
    const length: number = run.length * step;

    place(
      bass,
      stepTime(score, run.start),
      length,
      rate,
      bassVoice(
        score.bass,
        root * 2 ** (degreeSemitones(run.degree) / 12),
        length,
        rate,
      ),
    );
  }

  for (const run of runsOf(audible(score, score.pads, 2))) {
    const length: number = run.length * step;

    for (const offset of [0, 2, 4]) {
      place(
        pads,
        stepTime(score, run.start),
        length + padRelease,
        rate,
        padVoice(
          root * 4 * 2 ** (degreeSemitones(run.degree + offset) / 12),
          length,
          rate,
        ),
      );
    }
  }

  crush(
    drums,
    score.kits.map((kit: number) => Math.min(score.grit + kits[kit]!.grit, 1)),
  );
  echo(pads, Math.round(echoSteps * step * rate), score.space);

  const set: Array<Bank | null> = vowels.map((_: Vowel, index: number) => {
    const samples: Float32Array | null = voices[index] ?? null;

    return samples === null ? null : analyseBank(samples, rate);
  });
  const sampled: boolean =
    (score.singer === "bank" || score.singer === "ritsu") &&
    set.some((bank: Bank | null) => bank !== null);

  for (const phrase of phrasesOf(audible(score, score.vocals, 3))) {
    if (sampled) {
      singPhrase(vocals, score, phrase, root, set, random, rate);
      continue;
    }

    for (
      let singer = 0;
      singer < styles[score.singer].detunes.length;
      singer++
    ) {
      place(
        vocals,
        stepTime(score, phrase.start) + styles[score.singer].delays[singer]!,
        phrase.notes.length * step + vocalRelease,
        rate,
        vocalVoice(score, phrase, root, singer, random, rate),
      );
    }
  }

  echo(vocals, Math.round(vocalEcho * step * rate), score.space);

  for (let index = 0; index < total; index++) {
    mix[index] =
      Math.tanh(
        (drums[index]! * drumMix +
          bass[index]! * bassMix +
          pads[index]! * padMix +
          vocals[index]! * vocalMix * score.voice) *
          masterDrive,
      ) * masterLevel;
  }

  return mix;
}

export {
  stepsPerBar,
  beatsPerBar,
  drumLanes,
  noteRows,
  kits,
  vowels,
  keyNames,
  barOptions,
  tempoMin,
  tempoMax,
  swingMax,
  defaultScore,
  repairScore,
  resizeScore,
  stepCount,
  noteName,
  scoreLength,
  stepTime,
  renderScore,
};
