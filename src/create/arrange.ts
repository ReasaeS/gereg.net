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
import {
  beatsPerBar,
  degreeSemitones,
  drumLanes,
  effectLanes,
  instruments,
  keyNames,
  kitLanes,
  kitPitch,
  kits,
  samplePitch,
  patchOf,
  patches,
  rollSpeeds,
  rootFrequency,
  stepsPerBar,
  stepsPerBeat,
  swingMax,
  tempoMax,
  tempoMin,
  vowels,
  type Family,
  type Patch,
} from "./jungle";
import { createId } from "./defaults";

type Legacy = {
  tempo: number;
  key: number;
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
  melody: Array<number>;
  chords: Array<number>;
  leadTone: Tone;
  chordTone: Tone;
  rolls: Array<Array<number>>;
  speeds: Array<number>;
  effects: Array<Array<number>>;
  octaves: Array<number>;
  lyrics: string;
  shared: boolean;
};

type Run = {
  start: number;
  length: number;
  degree: number;
};

const defaultTracks: number = 8;
const insertCount: number = 9;
const channelMost: number = 32;
const patternMost: number = 64;
const clipMost: number = 256;
const songBarsMost: number = 64;
const patternBarsMost: number = 16;
const rollChoices: Array<number> = [1, ...rollSpeeds];
const pitchLow: number = 24;
const pitchHigh: number = 96;
const pitchMost: number = 127;
const noteShortest: number = 0.25; // steps
const volumeMost: number = 1.25;
const delayLow: number = 1; // steps
const delayHigh: number = 16; // steps
const defaultDelay: number = 3; // steps
const vocalDelay: number = 6; // steps
const legacyBars: Array<number> = [1, 2, 4, 8, 16];
const legacyRows: number = 8;
const legacyParts: number = 8;
const legacyRegisters: Array<number> = [0, 1, 4, 8, 8, 4, 0, 0];
const legacyOctaveLow: number = -2;
const legacyOctaveHigh: number = 2;
const legacySpeed: number = 2;
const drumMix: number = 0.8;
const bassMix: number = 0.75;
const padMix: number = 0.6;
const leadMix: number = 0.7;
const chordMix: number = 0.5;
const effectMix: number = 0.6;
const insertNames: Array<string> = [
  "Master",
  "Drums",
  "Bass",
  "Pads",
  "Chords",
  "Lead",
  "Vocals",
  "FX",
  "Insert 8",
];
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

function repeated(list: Array<number>, length: number): Array<number> {
  const steps: Array<number> = new Array();

  for (let index = 0; index < length; index++) {
    steps.push(list.length === 0 ? 0 : list[index % list.length]!);
  }

  return steps;
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

function cleanTone(value: unknown, fallback: Tone): Tone {
  return (
    instruments.find((instrument: { tone: Tone }) => instrument.tone === value)
      ?.tone ?? fallback
  );
}

function cleanLanes(
  value: unknown,
  lanes: Array<string>,
  length: number,
): Array<Array<number>> {
  const list: Array<unknown> = Array.isArray(value) ? value : new Array();

  return lanes.map((_: string, lane: number) =>
    cleanSteps(list[lane], length, 0, 1, 0),
  );
}

function cleanSinger(value: unknown): Singer {
  return value === "choir" || value === "bank" || value === "ritsu"
    ? value
    : "lead";
}

function cleanVoicebank(value: unknown): Array<string | null> {
  return vowels.map((_: unknown, index: number) => {
    const entry: unknown = Array.isArray(value) ? value[index] : null;

    return typeof entry === "string" ? entry : null;
  });
}

function defaultLegacy(): Legacy {
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
    mutes: repeated([0], legacyParts),
    vocals: notes(defaultVocals),
    vowels: repeated(defaultVowels, bars * beatsPerBar),
    voice: 0.6,
    singer: "ritsu",
    voicebank: vowels.map(() => null),
    melody: repeated([-1], bars * stepsPerBar),
    chords: repeated([-1], bars * stepsPerBar),
    leadTone: "saw",
    chordTone: "organ",
    rolls: drumLanes.map((_: string, lane: number) =>
      repeated([0], bars * stepsPerBar).map((_: number, step: number) =>
        lane === 1 && step === bars * stepsPerBar - 2 ? 1 : 0,
      ),
    ),
    speeds: repeated([legacySpeed], bars),
    effects: effectLanes.map((_: string, lane: number) =>
      repeated([0], bars * stepsPerBar).map((_: number, step: number) =>
        lane === 1 && step === 0 ? 1 : 0,
      ),
    ),
    octaves: repeated([0], legacyParts),
    lyrics: "",
    shared: false,
  };
}

function cleanLegacy(stale: Partial<Record<keyof Legacy, unknown>>): Legacy {
  const fallback: Legacy = defaultLegacy();
  const bars: number = legacyBars.includes(stale.bars as number)
    ? (stale.bars as number)
    : fallback.bars;
  const length: number = bars * stepsPerBar;

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
    drums: cleanLanes(stale.drums, drumLanes, length),
    bassline: cleanSteps(stale.bassline, length, -1, legacyRows - 1, -1),
    pads: cleanSteps(stale.pads, length, -1, legacyRows - 1, -1),
    kits: cleanSteps(stale.kits, bars, 0, kits.length - 1, 0),
    mutes: cleanSteps(stale.mutes, legacyParts, 0, 1, 0),
    vocals: cleanSteps(stale.vocals, length, -1, legacyRows - 1, -1),
    vowels: cleanVowels(stale.vowels, bars),
    voice: clampNumber(stale.voice, 0, 1, fallback.voice),
    singer: cleanSinger(stale.singer),
    voicebank: cleanVoicebank(stale.voicebank),
    melody: cleanSteps(stale.melody, length, -1, legacyRows - 1, -1),
    chords: cleanSteps(stale.chords, length, -1, legacyRows - 1, -1),
    leadTone: cleanTone(stale.leadTone, fallback.leadTone),
    chordTone: cleanTone(stale.chordTone, fallback.chordTone),
    rolls: cleanLanes(stale.rolls, drumLanes, length),
    speeds: cleanSteps(
      stale.speeds,
      bars,
      0,
      rollSpeeds.length - 1,
      legacySpeed,
    ),
    effects: cleanLanes(stale.effects, effectLanes, length),
    octaves: cleanSteps(
      stale.octaves,
      legacyParts,
      legacyOctaveLow,
      legacyOctaveHigh,
      0,
    ),
    lyrics: typeof stale.lyrics === "string" ? stale.lyrics : "",
    shared: stale.shared === true,
  };
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

function createNote(step: number, pitch: number, length: number = 1): Note {
  return {
    step: step,
    length: length,
    pitch: pitch,
    velocity: 1,
    roll: 1,
    vowel: 0,
  };
}

function createInsert(index: number): Insert {
  return {
    name: insertNames[index] ?? "Insert " + index,
    volume: 1,
    pan: 0,
    mute: false,
    grit: 0,
    space: 0,
    delay: index === 6 ? vocalDelay : defaultDelay,
    filter: 1,
  };
}

function createChannel(instrument: string, insert: number = 0): Channel {
  const patch: Patch = patchOf(instrument);

  return {
    id: createId(),
    name: patch.name,
    instrument: patch.key,
    kit: 0,
    volume: 0.7,
    pan: 0,
    insert: insert,
    mute: false,
    sample: null,
    cut: false,
  };
}

function createSequence(name: string, bars: number = 1): Sequence {
  return { id: createId(), name: name, bars: bars, notes: {} };
}

function defaultPitch(score: Score, family: Family): number {
  if (family === "drum" || family === "effect") {
    return kitPitch;
  }

  if (family === "sample") {
    return samplePitch;
  }

  const root: number = 57 + ((score.key + 5) % 12) - 5;

  return family === "bass" ? root - 24 : family === "vocal" ? root + 12 : root;
}

function legacyPitch(legacy: Legacy, part: number, degree: number): number {
  return Math.round(
    69 +
      12 *
        Math.log2(
          (rootFrequency(legacy.key) *
            legacyRegisters[part]! *
            2 ** legacy.octaves[part]!) /
            440,
        ) +
      degreeSemitones(degree),
  );
}

function upgradeScore(legacy: Legacy): Score {
  const channels: Array<Channel> = new Array();
  const patterns: Array<Sequence> = new Array();
  const clips: Array<Clip> = new Array();
  const inserts: Array<Insert> = new Array();
  const length: number = legacy.bars * stepsPerBar;
  const used: Array<number> = [...new Set(legacy.kits)];

  for (let index = 0; index < insertCount; index++) {
    inserts.push(createInsert(index));
  }

  inserts[1]!.grit = legacy.grit;

  for (const index of [3, 4, 5, 6, 7]) {
    inserts[index]!.space = legacy.space;
  }

  function addChannel(
    instrument: string,
    name: string,
    insert: number,
    volume: number,
    part: number,
  ): Channel {
    const channel: Channel = {
      ...createChannel(instrument, insert),
      name: name,
      volume: volume,
      mute: legacy.mutes[part] === 1,
    };

    channels.push(channel);
    return channel;
  }

  function addPattern(name: string, notes: Record<string, Array<Note>>): void {
    if (Object.values(notes).every((list: Array<Note>) => list.length === 0)) {
      return;
    }

    const pattern: Sequence = {
      ...createSequence(name, legacy.bars),
      notes: notes,
    };

    patterns.push(pattern);
    clips.push({
      pattern: pattern.id,
      track: clips.length,
      step: 0,
      length: length,
    });
  }

  function melodic(
    line: Array<number>,
    part: number,
    offsets: Array<number>,
  ): Array<Note> {
    return runsOf(line).flatMap((run: Run) =>
      offsets.map((offset: number) =>
        createNote(
          run.start,
          legacyPitch(legacy, part, run.degree + offset),
          run.length,
        ),
      ),
    );
  }

  const drumNotes: Record<string, Array<Note>> = {};

  used.forEach((kit: number, order: number) => {
    const notes: Array<Note> = new Array();

    drumLanes.forEach((_: string, lane: number) => {
      for (let step = 0; step < length; step++) {
        const bar: number = Math.floor(step / stepsPerBar);

        if (legacy.kits[bar] !== kit) {
          continue;
        }

        if (legacy.drums[lane]?.[step] === 1) {
          notes.push(createNote(step, kitPitch - lane));
        }

        if (legacy.rolls[lane]?.[step] === 1) {
          notes.push({
            ...createNote(step, kitPitch - lane),
            roll: rollSpeeds[legacy.speeds[bar]!]!,
          });
        }
      }
    });

    if (order > 0 && notes.length === 0) {
      return;
    }

    const channel: Channel = addChannel(
      "drums",
      used.length > 1 ? "Drums " + kits[kit]!.name : "Drums",
      1,
      drumMix,
      0,
    );

    channel.kit = kit;
    drumNotes[channel.id] = notes;
  });

  addPattern("Drums", drumNotes);

  const bass: Channel = addChannel(legacy.bass, "Bass", 2, bassMix, 1);

  addPattern("Bass", { [bass.id]: melodic(legacy.bassline, 1, [0]) });

  const pads: Channel = addChannel("pad", "Pads", 3, padMix, 2);

  addPattern("Pads", { [pads.id]: melodic(legacy.pads, 2, [0, 2, 4]) });

  const chords: Channel = addChannel(
    legacy.chordTone,
    "Chords",
    4,
    chordMix,
    5,
  );

  addPattern("Chords", {
    [chords.id]: melodic(legacy.chords, 5, [0, 2, 4]),
  });

  const lead: Channel = addChannel(legacy.leadTone, "Lead", 5, leadMix, 4);

  addPattern("Lead", { [lead.id]: melodic(legacy.melody, 4, [0]) });

  const vocals: Channel = addChannel("vocals", "Vocals", 6, legacy.voice, 3);

  addPattern("Vocals", {
    [vocals.id]: melodic(legacy.vocals, 3, [0]).map((note: Note) => ({
      ...note,
      vowel: legacy.vowels[Math.floor(note.step / stepsPerBeat)] ?? 0,
    })),
  });

  const effectNotes: Array<Note> = new Array();

  effectLanes.forEach((_: string, lane: number) => {
    for (let step = 0; step < length; step++) {
      if (legacy.effects[lane]?.[step] === 1) {
        effectNotes.push(createNote(step, kitPitch - lane));
      }
    }
  });

  if (effectNotes.length > 0) {
    addPattern("FX", {
      [addChannel("fx", "FX", 7, effectMix, 7).id]: effectNotes,
    });
  }

  if (patterns.length === 0) {
    patterns.push(createSequence("Pattern 1"));
  }

  return {
    tempo: legacy.tempo,
    key: legacy.key,
    swing: legacy.swing,
    singer: legacy.singer,
    voicebank: legacy.voicebank,
    lyrics: legacy.lyrics,
    shared: legacy.shared,
    channels: channels,
    patterns: patterns,
    clips: clips,
    tracks: Math.max(defaultTracks, clips.length),
    inserts: inserts,
  };
}

function defaultScore(): Score {
  return upgradeScore(defaultLegacy());
}

function quarter(value: number): number {
  return Math.round(value / noteShortest) * noteShortest;
}

function cleanNote(value: unknown, span: number): Note | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const stale: Partial<Record<keyof Note, unknown>> = value;
  const step: number = quarter(clampNumber(stale.step, -1, span, -1));

  if (step < 0 || step >= span) {
    return null;
  }

  return {
    step: step,
    length: Math.max(
      quarter(clampNumber(stale.length, 0, songBarsMost * stepsPerBar, 1)),
      noteShortest,
    ),
    pitch: Math.round(clampNumber(stale.pitch, 0, pitchMost, kitPitch)),
    velocity: clampNumber(stale.velocity, 0, 1, 1),
    roll: rollChoices.includes(stale.roll as number)
      ? (stale.roll as number)
      : 1,
    vowel: Math.round(clampNumber(stale.vowel, 0, vowels.length - 1, 0)),
  };
}

function cleanChannel(value: unknown, taken: Set<string>): Channel | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const stale: Partial<Record<keyof Channel, unknown>> = value;

  if (typeof stale.id !== "string" || taken.has(stale.id)) {
    return null;
  }

  const patch: Patch = patchOf(
    typeof stale.instrument === "string" ? stale.instrument : "",
  );

  taken.add(stale.id);

  return {
    id: stale.id,
    name: typeof stale.name === "string" ? stale.name : patch.name,
    instrument: patch.key,
    kit: Math.round(clampNumber(stale.kit, 0, kits.length - 1, 0)),
    volume: clampNumber(stale.volume, 0, volumeMost, 0.7),
    pan: clampNumber(stale.pan, -1, 1, 0),
    insert: Math.round(clampNumber(stale.insert, 0, insertCount - 1, 0)),
    mute: stale.mute === true,
    sample: typeof stale.sample === "string" ? stale.sample : null,
    cut: stale.cut === true,
  };
}

function cleanPattern(
  value: unknown,
  channels: Array<Channel>,
  taken: Set<string>,
): Sequence | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const stale: Partial<Record<keyof Sequence, unknown>> = value;

  if (typeof stale.id !== "string" || taken.has(stale.id)) {
    return null;
  }

  const bars: number = Math.round(
    clampNumber(stale.bars, 1, patternBarsMost, 1),
  );
  const notes: Record<string, Array<Note>> = {};
  const source: Record<string, unknown> =
    typeof stale.notes === "object" && stale.notes !== null
      ? (stale.notes as Record<string, unknown>)
      : {};

  taken.add(stale.id);

  for (const channel of channels) {
    const list: unknown = source[channel.id];

    if (Array.isArray(list)) {
      notes[channel.id] = list
        .map((note: unknown) => cleanNote(note, bars * stepsPerBar))
        .filter((note: Note | null): note is Note => note !== null);
    }
  }

  return {
    id: stale.id,
    name: typeof stale.name === "string" ? stale.name : "Pattern",
    bars: bars,
    notes: notes,
  };
}

function cleanClip(value: unknown, patterns: Array<Sequence>): Clip | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const stale: Partial<Record<keyof Clip, unknown>> = value;
  const most: number = songBarsMost * stepsPerBar;
  const step: number = Math.round(clampNumber(stale.step, 0, most - 1, 0));

  if (
    !patterns.some((pattern: Sequence) => pattern.id === stale.pattern) ||
    typeof stale.pattern !== "string"
  ) {
    return null;
  }

  return {
    pattern: stale.pattern,
    track: Math.round(clampNumber(stale.track, 0, Number.MAX_SAFE_INTEGER, 0)),
    step: step,
    length: Math.round(clampNumber(stale.length, 1, most - step, stepsPerBar)),
  };
}

function cleanInsert(value: unknown, index: number): Insert {
  const fallback: Insert = createInsert(index);

  if (typeof value !== "object" || value === null) {
    return fallback;
  }

  const stale: Partial<Record<keyof Insert, unknown>> = value;

  return {
    name: typeof stale.name === "string" ? stale.name : fallback.name,
    volume: clampNumber(stale.volume, 0, volumeMost, 1),
    pan: clampNumber(stale.pan, -1, 1, 0),
    mute: stale.mute === true,
    grit: clampNumber(stale.grit, 0, 1, 0),
    space: clampNumber(stale.space, 0, 1, 0),
    delay: Math.round(
      clampNumber(stale.delay, delayLow, delayHigh, fallback.delay),
    ),
    filter: clampNumber(stale.filter, 0, 1, 1),
  };
}

function laneOf(value: unknown): [string, number] | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const instrument: unknown = (value as Partial<Record<keyof Channel, unknown>>)
    .instrument;

  for (const [key, family] of [
    ["drums", "drum"],
    ["fx", "effect"],
  ] as Array<[string, Family]>) {
    const lane: number = kitLanes(family).findIndex(
      (name: string) => name.toLowerCase() === instrument,
    );

    if (lane >= 0) {
      return [key, lane];
    }
  }

  return null;
}

function groupOf(channel: Channel): string {
  return [channel.instrument, channel.kit, channel.insert, channel.mute].join(
    ":",
  );
}

function soloLane(
  channel: Channel,
  patterns: Array<Sequence>,
): [string, number] | null {
  if (pitched(channel)) {
    return null;
  }

  const used: Set<number> = new Set(
    patterns.flatMap((pattern: Sequence) =>
      (pattern.notes[channel.id] ?? new Array()).map(
        (note: Note) => note.pitch,
      ),
    ),
  );
  const lane: number = kitPitch - ([...used][0] ?? kitPitch + 1);

  return used.size === 1 &&
    lane >= 0 &&
    lane < kitLanes(familyOf(channel)).length
    ? [channel.instrument, lane]
    : null;
}

function mergeLanes(
  channels: Array<Channel>,
  patterns: Array<Sequence>,
  lanes: Map<string, [string, number]>,
): Array<Channel> {
  const targets: Map<string, Channel> = new Map();
  const loudest: Map<string, number> = new Map();

  for (const channel of channels) {
    channel.instrument = lanes.get(channel.id)?.[0] ?? channel.instrument;
  }

  for (const channel of channels) {
    const solo: [string, number] | null = lanes.has(channel.id)
      ? null
      : soloLane(channel, patterns);

    if (solo !== null) {
      lanes.set(channel.id, solo);
    } else if (!pitched(channel) && !targets.has(groupOf(channel))) {
      targets.set(groupOf(channel), channel);
    }
  }

  for (const channel of channels) {
    if (!lanes.has(channel.id)) {
      continue;
    }

    const group: string = groupOf(channel);
    const target: Channel = targets.get(group) ?? channel;

    targets.set(group, target);
    loudest.set(
      group,
      Math.max(loudest.get(group) ?? 0, channel.volume, target.volume),
    );
  }

  for (const target of targets.values()) {
    const most: number = loudest.get(groupOf(target)) ?? target.volume;

    if (lanes.has(target.id) || most <= target.volume) {
      continue;
    }

    for (const pattern of patterns) {
      for (const note of pattern.notes[target.id] ?? new Array()) {
        note.velocity *= target.volume / most;
      }
    }
  }

  for (const channel of channels) {
    const found: [string, number] | undefined = lanes.get(channel.id);

    if (found === undefined) {
      continue;
    }

    const [key, lane] = found;
    const group: string = groupOf(channel);
    const target: Channel = targets.get(group)!;
    const most: number = loudest.get(group)!;
    const laneName: string = kitLanes(patchOf(key).family)[lane]!;

    for (const pattern of patterns) {
      const moved: Array<Note> = (pattern.notes[channel.id] ?? new Array()).map(
        (note: Note) => ({
          ...note,
          pitch: kitPitch - lane,
          velocity: (note.velocity * channel.volume) / most,
        }),
      );

      if (target === channel) {
        pattern.notes[channel.id] = moved;
      } else {
        delete pattern.notes[channel.id];
        pattern.notes[target.id] = [
          ...(pattern.notes[target.id] ?? new Array()),
          ...moved,
        ];
      }
    }

    if (target === channel && channel.name.startsWith(laneName)) {
      channel.name =
        (key === "drums" ? "Drums" : "FX") +
        channel.name.slice(laneName.length);
    }
  }

  for (const target of targets.values()) {
    target.volume = Math.max(target.volume, loudest.get(groupOf(target)) ?? 0);
  }

  return channels.filter(
    (channel: Channel) =>
      !lanes.has(channel.id) || targets.get(groupOf(channel)) === channel,
  );
}

function repairScore(value: unknown): Score {
  if (typeof value !== "object" || value === null) {
    return defaultScore();
  }

  const stale: Partial<Record<keyof Score, unknown>> = value;

  if (!Array.isArray(stale.channels)) {
    return upgradeScore(cleanLegacy(value));
  }

  const channelIds: Set<string> = new Set();
  const patternIds: Set<string> = new Set();
  const lanes: Map<string, [string, number]> = new Map();
  const cleaned: Array<Channel> = stale.channels
    .map((channel: unknown) => cleanChannel(channel, channelIds))
    .filter((channel: Channel | null): channel is Channel => channel !== null)
    .slice(0, channelMost);

  for (const channel of stale.channels) {
    const found: [string, number] | null = laneOf(channel);
    const id: unknown = (channel as Partial<Record<keyof Channel, unknown>>).id;

    if (found !== null && typeof id === "string") {
      lanes.set(id, found);
    }
  }

  const patterns: Array<Sequence> = (
    Array.isArray(stale.patterns) ? stale.patterns : new Array()
  )
    .map((pattern: unknown) => cleanPattern(pattern, cleaned, patternIds))
    .filter((pattern: Sequence | null): pattern is Sequence => pattern !== null)
    .slice(0, patternMost);
  const channels: Array<Channel> = mergeLanes(cleaned, patterns, lanes);

  if (patterns.length === 0) {
    patterns.push(createSequence("Pattern 1"));
  }

  const inserts: Array<Insert> = new Array();

  for (let index = 0; index < insertCount; index++) {
    inserts.push(
      cleanInsert(
        Array.isArray(stale.inserts) ? stale.inserts[index] : null,
        index,
      ),
    );
  }

  const clips: Array<Clip> = (
    Array.isArray(stale.clips) ? stale.clips : new Array()
  )
    .map((clip: unknown) => cleanClip(clip, patterns))
    .filter((clip: Clip | null): clip is Clip => clip !== null)
    .slice(0, clipMost);

  return {
    tempo: Math.round(clampNumber(stale.tempo, tempoMin, tempoMax, 172)),
    key: Math.round(clampNumber(stale.key, 0, keyNames.length - 1, 0)),
    swing: clampNumber(stale.swing, 0, swingMax, 0),
    singer: cleanSinger(stale.singer),
    voicebank: cleanVoicebank(stale.voicebank),
    lyrics: typeof stale.lyrics === "string" ? stale.lyrics : "",
    shared: stale.shared === true,
    channels: channels,
    patterns: patterns,
    clips: clips,
    tracks: Math.max(
      Math.round(
        clampNumber(stale.tracks, 1, Number.MAX_SAFE_INTEGER, defaultTracks),
      ),
      ...clips.map((clip: Clip) => clip.track + 1),
    ),
    inserts: inserts,
  };
}

function familyOf(channel: Channel): Family {
  return patchOf(channel.instrument).family;
}

function pitched(channel: Channel): boolean {
  const family: Family = familyOf(channel);

  return family !== "drum" && family !== "effect";
}

function addChannel(score: Score, instrument: string): Channel | null {
  if (score.channels.length >= channelMost) {
    return null;
  }

  const channel: Channel = createChannel(instrument);

  score.channels.push(channel);
  return channel;
}

function removeChannel(score: Score, id: string): void {
  score.channels = score.channels.filter(
    (channel: Channel) => channel.id !== id,
  );

  for (const pattern of score.patterns) {
    delete pattern.notes[id];
  }
}

function addPattern(score: Score, bars: number = 1): Sequence | null {
  if (score.patterns.length >= patternMost) {
    return null;
  }

  const taken: Set<string> = new Set(
    score.patterns.map((pattern: Sequence) => pattern.name),
  );
  let count: number = score.patterns.length + 1;

  while (taken.has("Pattern " + count)) {
    count++;
  }

  const pattern: Sequence = createSequence("Pattern " + count, bars);

  score.patterns.push(pattern);
  return pattern;
}

function clonePattern(score: Score, source: Sequence): Sequence | null {
  const pattern: Sequence | null = addPattern(score, source.bars);

  if (pattern === null) {
    return null;
  }

  pattern.name = source.name + " copy";
  pattern.notes = JSON.parse(JSON.stringify(source.notes));
  return pattern;
}

function removePattern(score: Score, id: string): void {
  if (score.patterns.length <= 1) {
    return;
  }

  score.patterns = score.patterns.filter(
    (pattern: Sequence) => pattern.id !== id,
  );
  score.clips = score.clips.filter((clip: Clip) => clip.pattern !== id);
}

function notesOf(pattern: Sequence, channel: string): Array<Note> {
  pattern.notes[channel] = pattern.notes[channel] ?? new Array();

  return pattern.notes[channel];
}

function placeClip(
  score: Score,
  pattern: Sequence,
  track: number,
  step: number,
): Clip | null {
  const length: number = pattern.bars * stepsPerBar;

  if (
    score.clips.length >= clipMost ||
    step + length > songBarsMost * stepsPerBar
  ) {
    return null;
  }

  const clip: Clip = {
    pattern: pattern.id,
    track: track,
    step: step,
    length: length,
  };

  score.clips.push(clip);
  return clip;
}

function editBars(pattern: Sequence): number {
  return Math.min(pattern.bars + 1, patternBarsMost);
}

function fitPattern(score: Score, pattern: Sequence): void {
  const end: number = Math.max(
    ...Object.values(pattern.notes).flatMap((list: Array<Note>) =>
      list.map((note: Note) => note.step + note.length),
    ),
    0,
  );
  const bars: number = Math.min(
    Math.max(Math.ceil(end / stepsPerBar), 1),
    patternBarsMost,
  );
  const span: number = pattern.bars * stepsPerBar;

  if (bars === pattern.bars) {
    return;
  }

  for (const clip of score.clips) {
    if (
      clip.pattern === pattern.id &&
      clip.length === span &&
      clip.step + bars * stepsPerBar <= songBarsMost * stepsPerBar
    ) {
      clip.length = bars * stepsPerBar;
    }
  }

  pattern.bars = bars;
}

function addTrack(score: Score): void {
  score.tracks++;
}

function removeTrack(score: Score, track: number): void {
  if (score.tracks <= 1) {
    return;
  }

  score.clips = score.clips
    .filter((clip: Clip) => clip.track !== track)
    .map((clip: Clip) => ({
      ...clip,
      track: clip.track > track ? clip.track - 1 : clip.track,
    }));
  score.tracks--;
}

function soloScore(score: Score, pattern: Sequence): Score {
  return {
    ...score,
    clips: [
      {
        pattern: pattern.id,
        track: 0,
        step: 0,
        length: pattern.bars * stepsPerBar,
      },
    ],
  };
}

function patchOptions(): Array<{ value: string; label: string }> {
  return patches.map((patch: Patch) => ({
    value: patch.key,
    label: patch.name,
  }));
}

export {
  insertCount,
  songBarsMost,
  rollChoices,
  noteShortest,
  pitchLow,
  pitchHigh,
  volumeMost,
  delayLow,
  delayHigh,
  defaultScore,
  repairScore,
  createNote,
  createInsert,
  createChannel,
  createSequence,
  defaultPitch,
  familyOf,
  pitched,
  addChannel,
  removeChannel,
  addPattern,
  clonePattern,
  removePattern,
  notesOf,
  placeClip,
  soloScore,
  addTrack,
  removeTrack,
  editBars,
  fitPattern,
  patchOptions,
};
