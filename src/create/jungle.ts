import type {
  Bassline,
  Channel,
  Clip,
  Insert,
  Note,
  Score,
  Sequence,
  Singer,
  Tone,
} from "./types";

type Voice = (time: number) => number;

type Phrase = {
  start: number;
  notes: Array<number>;
  vowels: Array<number>;
};

type Family = "drum" | "bass" | "pad" | "tone" | "vocal" | "effect" | "sample";

type Patch = {
  key: string;
  name: string;
  family: Family;
  lane: number;
};

type Placed = {
  note: Note;
  step: number;
  pattern: string;
  index: number;
};

type Line = {
  pitches: Array<number>;
  vowels: Array<number>;
  words: Array<string | null>;
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

type Word = {
  at: number; // s
  start: number; // s
  bank: Bank | null;
  sustain: number;
  last: number;
};

type Bank = {
  samples: Float32Array;
  onset: number; // samples
  marks: Array<number>;
  period: number; // samples
  pitch: number; // Hz
  level: number;
};

type Instrument = {
  tone: Tone;
  name: string;
  level: number;
  release: number; // s
};

type Swarm = {
  detunes: Array<number>; // semitones
  cutoff: number; // Hz
  attack: number; // s
  scoop: number; // semitones
  vibrato: number; // semitones
  drive: number;
  pulse: boolean;
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
const effectLanes: Array<string> = [
  "Riser",
  "Reverse",
  "Impact",
  "Fall",
  "Zap",
];
const rollSpeeds: Array<number> = [2, 3, 4, 6, 8];
const instruments: Array<Instrument> = [
  { tone: "saw", name: "Saw", level: 0.22, release: 0.08 },
  { tone: "square", name: "Square", level: 0.16, release: 0.08 },
  { tone: "piano", name: "Piano", level: 0.2, release: 0.18 },
  { tone: "guitar", name: "Guitar", level: 0.55, release: 0.1 },
  { tone: "bell", name: "Bell", level: 0.25, release: 0.6 },
  { tone: "organ", name: "Organ", level: 0.11, release: 0.06 },
  { tone: "strings", name: "Strings", level: 0.22, release: 0.4 },
  { tone: "flute", name: "Flute", level: 0.3, release: 0.15 },
  { tone: "hoover", name: "Hoover", level: 0.2, release: 0.15 },
];
const swarms: Partial<Record<Tone, Swarm>> = {
  saw: {
    detunes: [-0.1, 0.1],
    cutoff: 2600,
    attack: 0.005,
    scoop: 0,
    vibrato: 0.15,
    drive: 1,
    pulse: false,
  },
  square: {
    detunes: [-0.05, 0.05],
    cutoff: 3200,
    attack: 0.005,
    scoop: 0,
    vibrato: 0.15,
    drive: 1,
    pulse: true,
  },
  strings: {
    detunes: [-0.12, 0, 0.12],
    cutoff: 2000,
    attack: 0.15,
    scoop: 0,
    vibrato: 0.12,
    drive: 1,
    pulse: false,
  },
  hoover: {
    detunes: [-0.3, -12, 0, 0.3],
    cutoff: 4000,
    attack: 0.01,
    scoop: 7,
    vibrato: 0,
    drive: 2.5,
    pulse: false,
  },
};
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
const clipped: WeakMap<Float32Array, Bank | null> = new WeakMap();
const lyricLead: number = 0.16; // s
const lyricHold: number = 0.06; // s
const lyricAttack: number = 0.02; // s
const lyricTail: number = 0.03; // s
const vowelOrder: string = "auione";
const syllableNames: Array<string> = (
  "ka ki ku ke ko kya kyu kyo ga gi gu ge go gya gyu gyo " +
  "sa shi su se so si sha shu sho she za ji zu ze zo zi ja ju jo je " +
  "ta chi tsu te to ti tu cha chu cho che da de do di du " +
  "na ni nu ne no nya nyu nyo ha hi fu he ho hya hyu hyo fa fi fe fo " +
  "ba bi bu be bo bya byu byo pa pi pu pe po pya pyu pyo " +
  "ma mi mu me mo mya myu myo ya yu yo ye ra ri ru re ro rya ryu ryo " +
  "wa wi we wo va vi vu ve vo tsa tsi tse tso"
).split(" ");
const spokenWords: Record<string, string> = {
  i: "a i",
  you: "y u",
  your: "y o a",
  my: "m a i",
  me: "m i",
  we: "w i",
  he: "h i",
  she: "sh i",
  be: "b i",
  the: "z a",
  to: "t u",
  do: "d u",
  one: "w a n",
  are: "a",
  eye: "a i",
  by: "b a i",
  love: "r a b",
  heart: "h a t",
  oh: "o",
  ah: "a",
  la: "r a",
  of: "o b",
  what: "w o t",
  was: "w o z",
  come: "k a m",
  some: "s a m",
  done: "d a n",
  none: "n a n",
};
const spellings: Array<[string, string]> = [
  ["tch", "ch"],
  ["igh", "a i"],
  ["ght", "t"],
  ["ough", "o"],
  ["sh", "sh"],
  ["ch", "ch"],
  ["ph", "f"],
  ["ck", "k"],
  ["wh", "w"],
  ["qu", "k w"],
  ["ts", "ts"],
  ["ee", "i"],
  ["ea", "i"],
  ["oo", "u"],
  ["ou", "a u"],
  ["ow", "a u"],
  ["ai", "e i"],
  ["ay", "e i"],
  ["ei", "e i"],
  ["ey", "e i"],
  ["oa", "o"],
  ["oi", "o i"],
  ["oy", "o i"],
  ["au", "o"],
  ["aw", "o"],
  ["ew", "y u"],
  ["ue", "u"],
  ["ie", "i"],
  ["x", "k s"],
  ["q", "k"],
  ["l", "r"],
];
const romajiSpellings: Array<[string, string]> = [
  ["sh", "sh"],
  ["ch", "ch"],
  ["ts", "ts"],
  ["l", "r"],
  ["c", "k"],
  ["q", "k"],
  ["x", "k s"],
];
const longVowels: Record<string, string> = {
  a: "EI",
  e: "I",
  i: "AI",
  o: "O",
  u: "YU",
};
const spokenEndings: Array<string> = ["the", "she", "there", "where", "were"];
const softVowels: Record<string, string> = {
  t: "o",
  d: "o",
  ch: "i",
  j: "i",
  sh: "u",
};
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
const tempoMin: number = 80; // bpm
const tempoMax: number = 300; // bpm
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
const scoopBend: number = 25; // 1/s
const pianoPartials: number = 6;
const pianoStretch: number = 0.0004;
const pianoFade: number = 1.2; // 1/s
const pianoDamp: number = 0.8; // 1/s
const pianoChorus: number = 1.0009;
const hammerFade: number = 300; // 1/s
const hammerLevel: number = 0.15;
const guitarPick: number = 0.5;
const guitarSustain: number = 0.996;
const guitarMute: number = 0.9;
const bellRatio: number = 3.5;
const bellDepth: number = 4;
const bellBend: number = 3; // 1/s
const bellFade: number = 2.5; // 1/s
const organBars: Array<Array<number>> = [
  [0.5, 0.5],
  [1, 1],
  [2, 0.6],
  [3, 0.4],
  [4, 0.3],
  [6, 0.15],
];
const organSwirl: number = 0.15;
const organSpin: number = 6.5; // Hz
const organAttack: number = 0.004; // s
const fluteAttack: number = 0.06; // s
const fluteVibrato: number = 0.2; // semitones
const fluteAir: number = 0.15;
const fluteBreath: number = 0.25;
const rollFloor: number = 0.45;
const sweepDamp: number = 0.3;
const riserLow: number = 300; // Hz
const riserHigh: number = 6000; // Hz
const riserToneLow: number = 200; // Hz
const riserToneHigh: number = 1600; // Hz
const fallLow: number = 150; // Hz
const impactLength: number = 1.5; // s
const impactLow: number = 45; // Hz
const impactSweep: number = 110; // Hz
const impactBend: number = 6; // 1/s
const impactFade: number = 2.5; // 1/s
const impactNoise: number = 10; // 1/s
const zapLength: number = 0.3; // s
const zapLow: number = 100; // Hz
const zapHigh: number = 3000; // Hz
const zapBend: number = 18; // 1/s
const zapFade: number = 9; // 1/s
const masterDrive: number = 1.1;
const masterLevel: number = 0.9;
const tuning: number = 440; // Hz
const tuningPitch: number = 69;
const filterLow: number = 120; // Hz
const filterRange: number = 160;
const kitPitch: number = 60;
const samplePitch: number = 60;
const sampleFade: number = 0.01; // s
const patches: Array<Patch> = [
  { key: "drums", name: "Drum kit", family: "drum", lane: 0 },
  { key: "sub", name: "Sub bass", family: "bass", lane: 0 },
  { key: "reese", name: "Reese bass", family: "bass", lane: 1 },
  { key: "pad", name: "Pad", family: "pad", lane: 0 },
  ...instruments.map((instrument: Instrument, lane: number) => ({
    key: instrument.tone as string,
    name: instrument.name,
    family: "tone" as Family,
    lane: lane,
  })),
  { key: "vocals", name: "Vocals", family: "vocal", lane: 0 },
  { key: "fx", name: "FX kit", family: "effect", lane: 0 },
  { key: "sampler", name: "Sampler", family: "sample", lane: 0 },
];

function isVowel(letter: string | undefined): boolean {
  return letter !== undefined && "aeiou".includes(letter);
}

function soundsOf(word: string, english: boolean): Array<string> {
  if (english && spokenWords[word] !== undefined) {
    return spokenWords[word]!.split(" ");
  }

  let text: string = word;

  if (english) {
    text = text.replace(
      /th/g,
      ["the", "this", "that", "they", "them", "then", "there", "these"].some(
        (spoken: string) => spoken === word,
      )
        ? "Z"
        : "S",
    );

    const last: number = text.length - 1;

    if (
      text.length > 2 &&
      text[last] === "e" &&
      !isVowel(text[last - 1]) &&
      !spokenEndings.includes(word)
    ) {
      const vowel: string = text[last - 2]!;
      const consonant: string = text[last - 1]!;

      text = text.slice(0, last);

      if (isVowel(vowel) && !isVowel(text[last - 3]) && consonant !== "r") {
        text = text.slice(0, last - 2) + longVowels[vowel] + consonant;
      }
    }
  }

  const sounds: Array<string> = new Array();
  const rules: Array<[string, string]> = english ? spellings : romajiSpellings;
  let index: number = 0;

  while (index < text.length) {
    const letter: string = text[index]!;
    const next: string | undefined = text[index + 1];
    const rule: [string, string] | undefined = rules.find(
      ([spelling]: [string, string]) => text.startsWith(spelling, index),
    );

    if (letter !== letter.toLowerCase()) {
      sounds.push(letter.toLowerCase());
      index++;
    } else if (letter === next && !isVowel(letter)) {
      index++;
    } else if (rule !== undefined) {
      sounds.push(...rule[1].split(" "));
      index += rule[0].length;
    } else if (
      english &&
      letter === "r" &&
      isVowel(text[index - 1]) &&
      !isVowel(next)
    ) {
      index++;
    } else if (english && letter === "c") {
      sounds.push(next === "e" || next === "i" || next === "y" ? "s" : "k");
      index++;
    } else if (letter === "y") {
      sounds.push(
        isVowel(next) ? "y" : english && !/[aeiou]/.test(text) ? "a i" : "i",
      );
      index++;
    } else if (
      english &&
      letter === "u" &&
      next !== undefined &&
      !isVowel(next) &&
      next !== "r" &&
      !isVowel(text[index + 2])
    ) {
      sounds.push("a");
      index++;
    } else {
      sounds.push(letter);
      index++;
    }
  }

  return sounds.flatMap((sound: string) => sound.split(" "));
}

function joinSyllable(consonant: string, vowel: string): string {
  if (consonant === "y" && (vowel === "i" || vowel === "e")) {
    return vowel === "i" ? "i" : "ye";
  }

  if (consonant === "w" && vowel === "u") {
    return "u";
  }

  if (consonant === "h" && vowel === "u") {
    return "fu";
  }

  const syllable: string = consonant + vowel;

  return syllableNames.includes(syllable) ? syllable : vowel;
}

function syllablesOf(lyrics: string): Array<string> {
  const syllables: Array<string> = new Array();

  for (const word of lyrics.toLowerCase().split(/[^a-z-]+/)) {
    const english: boolean = !word.includes("-");
    const sounds: Array<string> = word
      .split("-")
      .filter((part: string) => part.length > 0)
      .flatMap((part: string) => soundsOf(part, english));

    for (let index = 0; index < sounds.length; index++) {
      const sound: string = sounds[index]!;
      const next: string | undefined = sounds[index + 1];

      if (isVowel(sound)) {
        syllables.push(sound);
      } else if (
        next === "y" &&
        isVowel(sounds[index + 2]) &&
        syllableNames.includes(sound + "y" + sounds[index + 2])
      ) {
        syllables.push(sound + "y" + sounds[index + 2]);
        index += 2;
      } else if (isVowel(next)) {
        syllables.push(joinSyllable(sound, next!));
        index++;
      } else if (sound === "n") {
        syllables.push("n");
      } else if (sound !== "y" && sound !== "w" && sound !== "h") {
        syllables.push(joinSyllable(sound, softVowels[sound] ?? "u"));
      }
    }
  }

  return syllables;
}

function degreeSemitones(degree: number): number {
  return scaleSteps[degree % scaleSteps.length]! + 12 * Math.floor(degree / 7);
}

function rootFrequency(key: number): number {
  return bassBase * 2 ** ((((key + 5) % 12) - 5) / 12);
}

function stepLength(score: Score): number {
  return 60 / score.tempo / 4;
}

function songSteps(score: Score): number {
  const end: number = score.clips.reduce(
    (last: number, clip: Clip) => Math.max(last, clip.step + clip.length),
    0,
  );

  return Math.max(Math.ceil(end / stepsPerBar), 1) * stepsPerBar;
}

function songBars(score: Score): number {
  return songSteps(score) / stepsPerBar;
}

function scoreLength(score: Score): number {
  return songSteps(score) * stepLength(score);
}

function patchOf(key: string): Patch {
  return patches.find((patch: Patch) => patch.key === key) ?? patches[0]!;
}

function kitLanes(family: Family): Array<string> {
  return family === "drum"
    ? drumLanes
    : family === "effect"
      ? effectLanes
      : new Array();
}

function kitLane(family: Family, pitch: number): number {
  return Math.min(
    Math.max(kitPitch - pitch, 0),
    Math.max(kitLanes(family).length - 1, 0),
  );
}

function midiFrequency(pitch: number): number {
  return tuning * 2 ** ((pitch - tuningPitch) / 12);
}

function arrangedNotes(score: Score, channel: string): Array<Placed> {
  const placed: Array<Placed> = new Array();

  for (const clip of score.clips) {
    const pattern: Sequence | undefined = score.patterns.find(
      (entry: Sequence) => entry.id === clip.pattern,
    );

    if (pattern === undefined) {
      continue;
    }

    const notes: Array<Note> = pattern.notes[channel] ?? new Array();
    const span: number = pattern.bars * stepsPerBar;

    for (let offset = 0; offset < clip.length; offset += span) {
      notes.forEach((note: Note, index: number) => {
        const step: number = offset + note.step;

        if (note.step < span && step < clip.length) {
          placed.push({
            note: {
              ...note,
              length: Math.min(note.length, clip.length - step),
            },
            step: clip.step + step,
            pattern: pattern.id,
            index: index,
          });
        }
      });
    }
  }

  return placed.sort(
    (first: Placed, second: Placed) =>
      first.step - second.step || second.note.pitch - first.note.pitch,
  );
}

function lyricsOf(score: Score, placed: Array<Placed>): Array<string | null> {
  const syllables: Array<string> =
    score.singer === "ritsu" ? syllablesOf(score.lyrics) : new Array();
  let next: number = 0;

  return placed.map((entry: Placed, index: number) =>
    index > 0 && placed[index - 1]!.step === entry.step
      ? null
      : (syllables[next++] ?? null),
  );
}

function lineOf(
  placed: Array<Placed>,
  sung: Array<string | null>,
  steps: number,
): Line {
  const line: Line = {
    pitches: new Array(steps).fill(-1),
    vowels: new Array(steps).fill(0),
    words: sung.some((word: string | null) => word !== null)
      ? new Array(steps).fill(null)
      : new Array(),
  };

  placed.forEach((entry: Placed, index: number) => {
    const start: number = Math.floor(entry.step);
    const end: number = Math.min(
      Math.ceil(entry.step + entry.note.length),
      steps,
    );

    for (let step = start; step < end; step++) {
      line.pitches[step] = entry.note.pitch;
      line.vowels[step] = entry.note.vowel;
    }

    if (line.words.length > 0 && start < steps && sung[index] !== null) {
      line.words[start] = sung[index]!;
    }
  });

  return line;
}

function stepTime(score: Score, step: number): number {
  return (
    (step + (Math.floor(step) % 2 === 1 ? score.swing * 0.5 : 0)) *
    stepLength(score)
  );
}

function phrasesOf(line: Line): Array<Phrase> {
  const phrases: Array<Phrase> = new Array();

  for (let step = 0; step < line.pitches.length; step++) {
    const last: Phrase | undefined = phrases[phrases.length - 1];
    const pitch: number = line.pitches[step]!;

    if (pitch < 0) {
      continue;
    }

    if (last !== undefined && last.start + last.notes.length === step) {
      last.notes.push(pitch);
      last.vowels.push(line.vowels[step]!);
    } else {
      phrases.push({
        start: step,
        notes: [pitch],
        vowels: [line.vowels[step]!],
      });
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

function hit(
  kit: Kit,
  lane: number,
  rate: number,
  random: () => number,
): [number, Voice] {
  if (lane === 0) {
    return [kickLength, kick(kit, rate, random)];
  }

  if (lane === 1) {
    return [snareLength, snare(kit, random, kit.snareFade, 1)];
  }

  if (lane === 2) {
    return [
      snareLength,
      snare(kit, random, kit.snareFade * ghostFade, ghostLevel),
    ];
  }

  if (lane === 3) {
    return [hatLength, hat(kit, random)];
  }

  return [rideLength, ride(random)];
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

function scaled(voice: Voice, level: number): Voice {
  return (time: number) => voice(time) * level;
}

function vibratoAt(time: number, depth: number): number {
  return (
    depth *
    Math.min(Math.max((time - vibratoDelay) / vibratoRamp, 0), 1) *
    Math.sin(Math.PI * 2 * vibratoRate * time)
  );
}

function swarmVoice(
  swarm: Swarm,
  frequency: number,
  length: number,
  release: number,
  rate: number,
): Voice {
  const smoothing: number = 1 - Math.exp((-Math.PI * 2 * swarm.cutoff) / rate);
  const phases: Array<number> = swarm.detunes.map(() => 0);
  let filtered: number = 0;

  return (time: number) => {
    const bend: number =
      -swarm.scoop * Math.exp(-time * scoopBend) +
      vibratoAt(time, swarm.vibrato);
    let sum: number = 0;

    for (let voice = 0; voice < phases.length; voice++) {
      const phase: number =
        (phases[voice]! +
          (frequency * 2 ** ((swarm.detunes[voice]! + bend) / 12)) / rate) %
        1;

      phases[voice] = phase;
      sum += swarm.pulse ? saw(phase) - saw(phase + 0.5) : saw(phase);
    }

    filtered += smoothing * (sum / phases.length - filtered);

    return (
      (Math.tanh(filtered * swarm.drive) / Math.tanh(swarm.drive)) *
      envelope(time, length, swarm.attack, release)
    );
  };
}

function pianoVoice(
  frequency: number,
  length: number,
  release: number,
  rate: number,
  random: () => number,
): Voice {
  const tones: Array<number> = new Array();

  for (let partial = 1; partial <= pianoPartials; partial++) {
    const tone: number =
      frequency * partial * Math.sqrt(1 + pianoStretch * partial * partial);

    if (tone < rate / 2) {
      tones.push(tone);
    }
  }

  return (time: number) => {
    let sum: number =
      Math.sin(Math.PI * 2 * frequency * pianoChorus * time) *
      Math.exp(-time * (pianoFade + pianoDamp));

    for (let partial = 0; partial < tones.length; partial++) {
      sum +=
        (Math.sin(Math.PI * 2 * tones[partial]! * time) *
          Math.exp(-time * (pianoFade + (partial + 1) * pianoDamp))) /
        (partial + 1);
    }

    return (
      (sum + random() * Math.exp(-time * hammerFade) * hammerLevel) *
      envelope(time, length, noteAttack, release)
    );
  };
}

function guitarVoice(
  frequency: number,
  length: number,
  rate: number,
  random: () => number,
): Voice {
  const total: number = Math.max(rate / frequency, 3);
  let size: number = Math.floor(total - 0.5);
  let fraction: number = total - 0.5 - size;

  if (fraction < 0.1) {
    size--;
    fraction++;
  }

  const coefficient: number = (1 - fraction) / (1 + fraction);
  const string: Float32Array = new Float32Array(size);
  let position: number = 0;
  let previous: number = 0;
  let passIn: number = 0;
  let passOut: number = 0;
  let pick: number = 0;

  for (let index = 0; index < size; index++) {
    pick += (random() - pick) * guitarPick;
    string[index] = pick;
  }

  return (time: number) => {
    const sample: number = string[position]!;
    const averaged: number =
      (sample + previous) * 0.5 * (time < length ? guitarSustain : guitarMute);
    const passed: number =
      coefficient * averaged + passIn - coefficient * passOut;

    previous = sample;
    passIn = averaged;
    passOut = passed;
    string[position] = passed;
    position = (position + 1) % size;

    return sample;
  };
}

function bellVoice(frequency: number, length: number, release: number): Voice {
  return (time: number) =>
    Math.sin(
      Math.PI * 2 * frequency * time +
        bellDepth *
          Math.exp(-time * bellBend) *
          Math.sin(Math.PI * 2 * frequency * bellRatio * time),
    ) *
    Math.exp(-time * bellFade) *
    envelope(time, length, noteAttack, release);
}

function organVoice(
  frequency: number,
  length: number,
  release: number,
  random: () => number,
): Voice {
  return (time: number) => {
    let sum: number = 0;

    for (const [ratio, level] of organBars as Array<[number, number]>) {
      sum += Math.sin(Math.PI * 2 * frequency * ratio * time) * level;
    }

    return (
      (sum * (1 + organSwirl * Math.sin(Math.PI * 2 * organSpin * time)) +
        random() * Math.exp(-time * clickFade) * 0.3) *
      envelope(time, length, organAttack, release)
    );
  };
}

function fluteVoice(
  frequency: number,
  length: number,
  release: number,
  rate: number,
  random: () => number,
): Voice {
  let phase: number = 0;
  let air: number = 0;

  return (time: number) => {
    phase =
      (phase + (frequency * 2 ** (vibratoAt(time, fluteVibrato) / 12)) / rate) %
      1;
    air += (random() - air) * fluteAir;

    return (
      (Math.sin(Math.PI * 2 * phase) +
        Math.sin(Math.PI * 4 * phase) * 0.12 +
        air * fluteBreath) *
      envelope(time, length, fluteAttack, release)
    );
  };
}

function instrumentOf(tone: Tone): Instrument {
  return instruments.find(
    (instrument: Instrument) => instrument.tone === tone,
  )!;
}

function toneVoice(
  tone: Tone,
  frequency: number,
  length: number,
  rate: number,
  random: () => number,
): Voice {
  const { level, release } = instrumentOf(tone);
  const swarm: Swarm | undefined = swarms[tone];

  if (swarm !== undefined) {
    return scaled(swarmVoice(swarm, frequency, length, release, rate), level);
  }

  if (tone === "piano") {
    return scaled(pianoVoice(frequency, length, release, rate, random), level);
  }

  if (tone === "guitar") {
    return scaled(guitarVoice(frequency, length, rate, random), level);
  }

  if (tone === "bell") {
    return scaled(bellVoice(frequency, length, release), level);
  }

  if (tone === "organ") {
    return scaled(organVoice(frequency, length, release, random), level);
  }

  return scaled(fluteVoice(frequency, length, release, rate, random), level);
}

function sweep(
  from: number,
  to: number,
  length: number,
  rate: number,
  random: () => number,
): Voice {
  let low: number = 0;
  let band: number = 0;

  return (time: number) => {
    const cutoff: number = Math.min(
      from * (to / from) ** Math.min(time / length, 1),
      rate / 6,
    );
    const tune: number = 2 * Math.sin((Math.PI * cutoff) / rate);
    const high: number = random() - low - sweepDamp * band;

    band += tune * high;
    low += tune * band;

    return band;
  };
}

function riser(length: number, rate: number, random: () => number): Voice {
  const noise: Voice = sweep(riserLow, riserHigh, length, rate, random);
  let phase: number = 0;

  return (time: number) => {
    const progress: number = Math.min(time / length, 1);

    phase =
      (phase +
        (riserToneLow * (riserToneHigh / riserToneLow) ** progress) / rate) %
      1;

    return (
      (noise(time) * 0.6 + Math.sin(Math.PI * 2 * phase) * 0.25) * progress ** 2
    );
  };
}

function reverse(length: number, random: () => number): Voice {
  let last: number = 0;

  return (time: number) => {
    const sample: number = random();
    const bright: number = sample - last;

    last = sample;

    return bright * 0.35 * Math.min(time / length, 1) ** 3;
  };
}

function impact(rate: number, random: () => number): Voice {
  let phase: number = 0;
  let rumble: number = 0;

  return (time: number) => {
    phase =
      (phase +
        (impactLow + impactSweep * Math.exp(-time * impactBend)) / rate) %
      1;
    rumble += (random() - rumble) * 0.05;

    return (
      Math.sin(Math.PI * 2 * phase) * Math.exp(-time * impactFade) +
      rumble * Math.exp(-time * impactNoise) * 2
    );
  };
}

function fall(length: number, rate: number, random: () => number): Voice {
  const noise: Voice = sweep(riserHigh, fallLow, length, rate, random);

  return (time: number) =>
    noise(time) * 0.6 * (1 - Math.min(time / length, 1)) ** 2;
}

function zap(rate: number): Voice {
  let phase: number = 0;

  return (time: number) => {
    phase = (phase + (zapLow + zapHigh * Math.exp(-time * zapBend)) / rate) % 1;

    return (saw(phase) - saw(phase + 0.5)) * 0.2 * Math.exp(-time * zapFade);
  };
}

function effect(
  lane: number,
  bar: number,
  rate: number,
  random: () => number,
): [number, boolean, Voice] {
  if (lane === 0) {
    return [bar, true, riser(bar, rate, random)];
  }

  if (lane === 1) {
    return [bar / 2, true, reverse(bar / 2, random)];
  }

  if (lane === 2) {
    return [impactLength, false, impact(rate, random)];
  }

  if (lane === 3) {
    return [bar, false, fall(bar, rate, random)];
  }

  return [zapLength, false, zap(rate)];
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
  let pitch: number = phrase.notes[0]! - vocalScoop;
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
    return vowels[phrase.vowels[index] ?? 0] ?? vowels[0]!;
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

    pitch += (degree - pitch) * glide;
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
      root * 2 ** ((pitch + vibrato + jitter + detune) / 12);

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
            onset: 0,
            marks: marks,
            period: period,
            pitch: rate / period,
            level: bankLevel / loudness,
          };
  }

  analysed.set(samples, bank);

  return bank;
}

function analyseClip(samples: Float32Array, rate: number): Bank | null {
  const cached: Bank | null | undefined = clipped.get(samples);

  if (cached !== undefined) {
    return cached;
  }

  const vowelStart: number = Math.round(lyricLead * rate);
  const period: number | null =
    samples.length < vowelStart + bankMinimum * rate * 0.5
      ? null
      : detectPeriod(samples.subarray(vowelStart), rate);
  let bank: Bank | null = null;

  if (period !== null) {
    const end: number = samples.length - period;
    const marks: Array<number> = new Array();
    let onset: number = 0;
    let mark: number = peakAt(samples, period, period * 2);
    let energy: number = 0;

    while (onset < vowelStart && samples[onset] === 0) {
      onset++;
    }

    while (mark + period * (1 + markReach) < end) {
      marks.push(mark);
      mark = peakAt(
        samples,
        mark + Math.round(period * (1 - markReach)),
        mark + Math.round(period * (1 + markReach)),
      );
    }

    for (let index = vowelStart; index < end; index++) {
      energy += samples[index]! ** 2;
    }

    const loudness: number = Math.sqrt(energy / Math.max(end - vowelStart, 1));

    bank =
      marks.length < 4 || loudness === 0
        ? null
        : {
            samples: samples,
            onset: onset,
            marks: marks,
            period: period,
            pitch: rate / period,
            level: bankLevel / loudness,
          };
  }

  clipped.set(samples, bank);

  return bank;
}

function bounce(count: number, span: number): number {
  if (span <= 1) {
    return 0;
  }

  const cycle: number = (span - 1) * 2;
  const position: number = ((count % cycle) + cycle) % cycle;

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

function wordMark(word: Word, position: number): number {
  const bank: Bank = word.bank!;
  const first: number = bank.marks[word.sustain]!;
  let found: number = 0;

  if (position >= first) {
    return (
      word.sustain +
      bounce(
        Math.round((position - first) / bank.period),
        word.last - word.sustain + 1,
      )
    );
  }

  while (found + 1 < word.sustain && bank.marks[found + 1]! <= position) {
    found++;
  }

  return found;
}

function speakerAt(words: Array<Word>, time: number): Word | null {
  let found: Word | null = null;

  for (const word of words) {
    if (time >= word.start) {
      found = word;
    }
  }

  return found;
}

function bankOctave(pitches: Array<number>, set: Array<Bank>): number {
  const notes: Array<number> = pitches.filter((pitch: number) => pitch >= 0);
  const middle: number =
    notes.reduce((total: number, pitch: number) => total + pitch, 0) /
    Math.max(notes.length, 1);
  const pitch: number =
    set.reduce((total: number, bank: Bank) => total + bank.pitch, 0) /
    Math.max(set.length, 1);
  const octave: number =
    2 ** Math.round(Math.log2(pitch / midiFrequency(middle)));

  return Math.min(Math.max(octave, 1 / octaveMost), octaveMost);
}

function singPhrase(
  target: Float32Array,
  score: Score,
  phrase: Phrase,
  base: number,
  set: Array<Bank | null>,
  sung: Array<string | null>,
  clips: Map<string, Bank | null>,
  random: () => number,
  rate: number,
): void {
  const style: Style = styles.bank;
  const step: number = stepLength(score);
  const length: number = phrase.notes.length * step;
  const lead: number = sung.length > 0 ? lyricLead : 0;
  const attack: number = sung.length > 0 ? lyricAttack : vocalAttack;
  const total: number = Math.round((lead + length + vocalRelease) * rate);
  const begin: number = Math.round(
    (stepTime(score, phrase.start) - lead) * rate,
  );
  const glide: number = 1 - Math.exp(-1 / (vocalGlide * rate));
  const wander: number = 1 - Math.exp(-1 / (wanderTime * rate));
  const wanderEvery: number = Math.max(Math.round(wanderTime * rate), 1);
  const frequencies: Float32Array = new Float32Array(total);
  const weights: Array<number> = set.map(() => 0);
  const words: Array<Word> = new Array();
  let sungVowel: number = -1;
  const sungVowels: Array<number> = phrase.notes.map(
    (_: number, index: number) => {
      const syllable: string | null = sung[phrase.start + index] ?? null;

      if (syllable !== null) {
        const bank: Bank | null = clips.get(syllable) ?? null;

        const settled: number = (lyricLead + lyricHold) * rate;
        const tail: number =
          bank === null ? 0 : bank.samples.length - lyricTail * rate;
        const sustain: number =
          bank === null
            ? 0
            : bank.marks.findIndex((mark: number) => mark >= settled);
        const last: number =
          bank === null
            ? 0
            : bank.marks.filter((mark: number) => mark <= tail).length - 1;

        sungVowel = vowelOrder.indexOf(syllable[syllable.length - 1]!);
        words.push({
          at: index * step,
          start:
            bank === null
              ? index * step
              : index * step - lyricLead + bank.onset / rate,
          bank: bank,
          sustain: sustain < 0 ? Math.max(last, 0) : sustain,
          last: Math.max(last, sustain),
        });
      }

      return sungVowel;
    },
  );
  let pitch: number = phrase.notes[0]! - vocalScoop;
  let held: number = phrase.notes[0]!;
  let noteStart: number = 0;
  let jitter: number = 0;
  let jitterGoal: number = 0;

  function noteAt(time: number): number {
    return Math.min(
      Math.max(Math.floor(time / step), 0),
      phrase.notes.length - 1,
    );
  }

  function voiceAt(index: number): number {
    const wanted: number =
      sungVowels[index]! >= 0
        ? sungVowels[index]!
        : (phrase.vowels[index] ?? 0);

    return set[wanted] !== null && set[wanted] !== undefined
      ? wanted
      : set.findIndex((bank: Bank | null) => bank !== null);
  }

  for (let count = 0; count < total; count++) {
    const time: number = count / rate - lead;
    const degree: number = phrase.notes[noteAt(time)]!;

    if (degree !== held) {
      held = degree;
      noteStart = time;
    }

    if (count % wanderEvery === 0) {
      jitterGoal = random() * jitterDepth;
    }

    pitch += (degree - pitch) * glide;
    jitter += (jitterGoal - jitter) * wander;

    const vibrato: number =
      style.vibrato *
      Math.min(
        Math.max((time - noteStart - vibratoDelay) / vibratoRamp, 0),
        1,
      ) *
      Math.sin(Math.PI * 2 * vibratoRate * time);

    frequencies[count] = base * 2 ** ((pitch + vibrato + jitter) / 12);
  }

  weights[voiceAt(0)] = 1;

  for (let at = 0; at < total;) {
    const spacing: number = rate / frequencies[Math.floor(at)]!;
    const time: number = at / rate - lead;
    const current: number = voiceAt(noteAt(time));
    const fade: number = 1 - Math.exp(-spacing / (blendTime * rate));
    const level: number =
      envelope(time, length, attack, vocalRelease) *
      (1 + random() * shimmerDepth * 0.5);
    const speaking: boolean = (speakerAt(words, time)?.bank ?? null) !== null;
    const release: number = Math.max(
      Math.min(1 + (length - time) / vocalRelease, 1),
      0,
    );

    for (let voice = 0; voice < set.length; voice++) {
      const bank: Bank | null = set[voice]!;

      weights[voice]! +=
        ((voice === current && !speaking ? 1 : 0) - weights[voice]!) * fade;

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

    for (let index = 0; index < words.length; index++) {
      const word: Word = words[index]!;
      const next: Word | undefined = words[index + 1];
      const since: number = time - word.at + lyricLead;

      if (word.bank === null || since < 0) {
        continue;
      }

      const weight: number =
        release *
        (next === undefined || time < next.start
          ? 1
          : Math.exp(-(time - next.start) / blendTime));

      if (weight < 0.001) {
        continue;
      }

      addGrain(
        target,
        begin + Math.round(at),
        word.bank,
        word.bank.marks[wordMark(word, since * rate)]!,
        weight * word.bank.level * (spacing / word.bank.period),
      );
    }

    at += spacing;
  }
}

function balance(pan: number): [number, number] {
  return [Math.min(1 - pan, 1), Math.min(1 + pan, 1)];
}

function smooth(samples: Float32Array, filter: number, rate: number): void {
  const amount: number =
    1 - Math.exp((-Math.PI * 2 * filterLow * filterRange ** filter) / rate);
  let first: number = 0;
  let second: number = 0;

  for (let index = 0; index < samples.length; index++) {
    first += (samples[index]! - first) * amount;
    second += (first - second) * amount;
    samples[index] = second;
  }
}

function playChannel(
  target: Float32Array,
  score: Score,
  family: Family,
  lane: number,
  kit: Kit,
  placed: Array<Placed>,
  rate: number,
  random: () => number,
): void {
  const step: number = stepLength(score);

  for (const { note, step: at } of placed) {
    const time: number = stepTime(score, at);
    const length: number = note.length * step;

    if (family === "drum") {
      const hits: number =
        note.roll > 1 ? Math.max(Math.round(note.roll * note.length), 1) : 1;
      const gap: number = step / Math.max(note.roll, 1);

      for (let repeat = 0; repeat < hits; repeat++) {
        const [span, voice] = hit(
          kit,
          kitLane(family, note.pitch),
          rate,
          random,
        );
        const ramp: number =
          hits > 1 ? rollFloor + ((1 - rollFloor) * (repeat + 1)) / hits : 1;

        place(
          target,
          time + repeat * gap,
          repeat < hits - 1 ? Math.min(gap, span) : span,
          rate,
          scaled(voice, note.velocity * ramp),
        );
      }
    } else if (family === "effect") {
      const [span, before, voice] = effect(
        kitLane(family, note.pitch),
        step * stepsPerBar,
        rate,
        random,
      );

      place(
        target,
        time - (before ? span : 0) + scoreLength(score),
        span,
        rate,
        scaled(voice, note.velocity),
      );
    } else if (family === "bass") {
      place(
        target,
        time,
        length,
        rate,
        scaled(
          bassVoice(
            lane === 1 ? "reese" : "sub",
            midiFrequency(note.pitch),
            length,
            rate,
          ),
          note.velocity,
        ),
      );
    } else if (family === "pad") {
      place(
        target,
        time,
        length + padRelease,
        rate,
        scaled(
          padVoice(midiFrequency(note.pitch), length, rate),
          note.velocity,
        ),
      );
    } else {
      const tone: Tone = instruments[lane]?.tone ?? "saw";

      place(
        target,
        time,
        length + instrumentOf(tone).release,
        rate,
        scaled(
          toneVoice(tone, midiFrequency(note.pitch), length, rate, random),
          note.velocity,
        ),
      );
    }
  }
}

function sampleChannel(
  target: Float32Array,
  score: Score,
  placed: Array<Placed>,
  source: Float32Array,
  cut: boolean,
  rate: number,
): void {
  for (const { note, step } of placed) {
    const speed: number = 2 ** ((note.pitch - samplePitch) / 12);
    const whole: number = source.length / rate / speed;
    const span: number = cut
      ? Math.min(whole, note.length * stepLength(score))
      : whole;

    place(target, stepTime(score, step), span, rate, (time: number) => {
      const position: number = time * rate * speed;
      const before: number = Math.floor(position);
      const first: number = source[before] ?? 0;
      const second: number = source[before + 1] ?? first;
      const fade: number = cut
        ? Math.min(Math.max((span - time) / sampleFade, 0), 1)
        : 1;

      return (
        (first + (second - first) * (position - before)) * note.velocity * fade
      );
    });
  }
}

function singChannel(
  target: Float32Array,
  score: Score,
  placed: Array<Placed>,
  set: Array<Bank | null>,
  clips: Map<string, Bank | null>,
  rate: number,
  random: () => number,
): void {
  const sampled: boolean =
    (score.singer === "bank" || score.singer === "ritsu") &&
    set.some((bank: Bank | null) => bank !== null);
  const line: Line = lineOf(
    placed,
    sampled ? lyricsOf(score, placed) : new Array(),
    songSteps(score),
  );
  const base: number = sampled
    ? midiFrequency(0) *
      bankOctave(
        line.pitches,
        set.filter((bank: Bank | null): bank is Bank => bank !== null),
      )
    : midiFrequency(0);

  for (const phrase of phrasesOf(line)) {
    if (sampled) {
      singPhrase(
        target,
        score,
        phrase,
        base,
        set,
        line.words,
        clips,
        random,
        rate,
      );
      continue;
    }

    for (
      let singer = 0;
      singer < styles[score.singer].detunes.length;
      singer++
    ) {
      place(
        target,
        stepTime(score, phrase.start) + styles[score.singer].delays[singer]!,
        phrase.notes.length * stepLength(score) + vocalRelease,
        rate,
        vocalVoice(score, phrase, base, singer, random, rate),
      );
    }
  }
}

function finishBus(
  bus: Array<Float32Array>,
  insert: Insert,
  delay: number,
  rate: number,
): void {
  for (const side of bus) {
    if (insert.grit > 0) {
      crush(side, [insert.grit]);
    }

    if (insert.space > 0) {
      echo(side, delay, insert.space);
    }

    if (insert.filter < 1) {
      smooth(side, insert.filter, rate);
    }
  }
}

function renderScore(
  score: Score,
  rate: number,
  voices: Array<Float32Array | null> = new Array(),
  clips: Map<string, Float32Array> = new Map(),
  samples: Map<string, Float32Array> = new Map(),
): Array<Float32Array<ArrayBuffer>> {
  const total: number = Math.max(Math.round(scoreLength(score) * rate), 1);
  const buses: Array<Array<Float32Array>> = score.inserts.map(() => [
    new Float32Array(total),
    new Float32Array(total),
  ]);
  const channel: Float32Array = new Float32Array(total);
  const random: () => number = createNoise();
  const step: number = stepLength(score);
  const singing: boolean = score.channels.some(
    (entry: Channel) => patchOf(entry.instrument).family === "vocal",
  );
  const set: Array<Bank | null> = vowels.map((_: Vowel, index: number) => {
    const samples: Float32Array | null = singing
      ? (voices[index] ?? null)
      : null;

    return samples === null ? null : analyseBank(samples, rate);
  });
  const clipBanks: Map<string, Bank | null> = new Map(
    [...(singing ? clips : new Map<string, Float32Array>())].map(
      ([syllable, samples]: [string, Float32Array]) => [
        syllable,
        analyseClip(samples, rate),
      ],
    ),
  );

  for (const entry of score.channels) {
    const insert: Insert | undefined = score.inserts[entry.insert];
    const patch: Patch = patchOf(entry.instrument);
    const placed: Array<Placed> = arrangedNotes(score, entry.id);
    const kit: Kit = kits[entry.kit] ?? kits[0]!;

    if (entry.mute || insert === undefined || placed.length === 0) {
      continue;
    }

    channel.fill(0);

    if (patch.family === "vocal") {
      singChannel(channel, score, placed, set, clipBanks, rate, random);
    } else if (patch.family === "sample") {
      const source: Float32Array | undefined =
        entry.sample === null ? undefined : samples.get(entry.sample);

      if (source !== undefined) {
        sampleChannel(channel, score, placed, source, entry.cut, rate);
      }
    } else {
      playChannel(
        channel,
        score,
        patch.family,
        patch.lane,
        kit,
        placed,
        rate,
        random,
      );
    }

    if (patch.family === "drum") {
      crush(channel, [kit.grit]);
    }

    const [left, right] = balance(entry.pan);
    const [busLeft, busRight] = buses[entry.insert]! as [
      Float32Array,
      Float32Array,
    ];

    for (let index = 0; index < total; index++) {
      busLeft[index]! += channel[index]! * entry.volume * left;
      busRight[index]! += channel[index]! * entry.volume * right;
    }
  }

  const master: Array<Float32Array> = buses[0]!;

  score.inserts.forEach((insert: Insert, index: number) => {
    if (index === 0 || insert.mute) {
      return;
    }

    const bus: Array<Float32Array> = buses[index]!;
    const [left, right] = balance(insert.pan);

    finishBus(
      bus,
      insert,
      Math.max(Math.round(insert.delay * step * rate), 1),
      rate,
    );

    for (let sample = 0; sample < total; sample++) {
      master[0]![sample]! += bus[0]![sample]! * insert.volume * left;
      master[1]![sample]! += bus[1]![sample]! * insert.volume * right;
    }
  });

  const main: Insert = score.inserts[0]!;
  const [left, right] = balance(main.pan);
  const mix: Array<Float32Array<ArrayBuffer>> = [
    new Float32Array(total),
    new Float32Array(total),
  ];

  finishBus(
    master,
    main,
    Math.max(Math.round(main.delay * step * rate), 1),
    rate,
  );

  for (let index = 0; index < total; index++) {
    const level: number = main.mute ? 0 : main.volume;

    mix[0]![index] =
      Math.tanh(master[0]![index]! * level * left * masterDrive) * masterLevel;
    mix[1]![index] =
      Math.tanh(master[1]![index]! * level * right * masterDrive) * masterLevel;
  }

  return mix;
}

export {
  stepsPerBar,
  kitPitch,
  samplePitch,
  kitLanes,
  kitLane,
  beatsPerBar,
  stepsPerBeat,
  drumLanes,
  effectLanes,
  rollSpeeds,
  instruments,
  patches,
  kits,
  vowels,
  keyNames,
  scaleSteps,
  tempoMin,
  tempoMax,
  swingMax,
  degreeSemitones,
  rootFrequency,
  patchOf,
  arrangedNotes,
  lyricsOf,
  songSteps,
  songBars,
  scoreLength,
  stepLength,
  stepTime,
  renderScore,
  syllablesOf,
  syllableNames,
};
export type { Family, Patch, Placed };
