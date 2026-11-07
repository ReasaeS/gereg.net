import type {
  Ambience,
  Channel,
  Insert,
  Note,
  Score,
  Sequence,
  Sound,
  Waveform,
} from "./types";
import { drumLanes, effectLanes, kitPitch, stepsPerBar } from "./jungle";
import {
  createChannel,
  createInsert,
  createNote,
  createSequence,
  insertCount,
} from "./arrange";

type Part = (shift: number) => Array<Note>;

type Mix = Partial<Record<number, Partial<Insert>>>;

type Setup = {
  tempo: number; // bpm
  key: number; // semitones
  swing: number;
  singer?: Score["singer"];
  lyrics?: string;
  mix: Mix;
};

type Tune = {
  score: Score;
  channel: (
    instrument: string,
    name: string,
    insert: number,
    volume: number,
    extra?: Partial<Channel>,
  ) => string;
  block: (name: string, bars: number, parts: Record<string, Part>) => void;
  clip: (name: string, track: number, bar: number, bars: number) => void;
};

const soundIds: Record<string, string> = {
  bell: "lamp-sound-bell",
  gull: "lamp-sound-gull",
  spark: "lamp-sound-spark",
  knock: "lamp-sound-knock",
  thunder: "lamp-sound-thunder",
  voice: "lamp-sound-voice",
  voiceLow: "lamp-sound-voice-low",
  rain: "lamp-sound-rain",
  gallery: "lamp-sound-gallery",
  surf: "lamp-sound-surf",
  title: "lamp-song-title",
  harbour: "lamp-song-harbour",
  breakwater: "lamp-song-breakwater",
  stair: "lamp-song-stair",
  lampRoom: "lamp-song-lamp-room",
  brim: "lamp-song-brim",
  drowned: "lamp-song-drowned",
  vesper: "lamp-song-vesper",
};
const noteNames: Array<string> = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const quiet: number = 0.55;
const rollFast: number = 4;
const rollFaster: number = 8;
const vesperLyrics: string =
  "a-me ga fu-ru u-mi no u-e " +
  "hi-ka-ri mo na-ku na-mi da-ke " +
  "to-mo-shi-bi wo ma-mo-ru ko-e " +
  "ki-e-na-i de a-o-i yo-ru " +
  "na-mi no so-ko ni ne-mu-ru hi " +
  "ka-ze yo ma-te a-ra-shi ya-me " +
  "ko-ko ni i-ru u-ta-u ka-ra " +
  "a-sa ma-de ki-mi wo te-ra-su";

function pitchOf(name: string): number {
  const octave: number = Number(name.slice(-1));

  return noteNames.indexOf(name.slice(0, -1)) + (octave + 1) * 12;
}

function seq(text: string, velocity: number = 1): Part {
  return (shift: number) => {
    const notes: Array<Note> = new Array();
    let step: number = 0;

    for (const token of text.trim().split(/\s+/)) {
      const [spec, span] = token.split(":") as [string, string | undefined];
      const length: number = span === undefined ? 1 : Number(span);

      if (spec !== ".") {
        for (const name of spec.split("+")) {
          notes.push({
            ...createNote(step, pitchOf(name) + shift, length),
            velocity: velocity,
          });
        }
      }

      step += length;
    }

    return notes;
  };
}

function sung(text: string, vowels: Array<number>): Part {
  return (shift: number) =>
    seq(text)(shift).map((note: Note, index: number) => ({
      ...note,
      vowel: vowels[index % vowels.length]!,
    }));
}

function grid(
  lanes: Array<string>,
  bars: number,
  rows: Record<string, string>,
): Part {
  return () => {
    const notes: Array<Note> = new Array();

    lanes.forEach((name: string, lane: number) => {
      const row: string | undefined = rows[name.toLowerCase()];

      if (row === undefined) {
        return;
      }

      for (let step = 0; step < bars * stepsPerBar; step++) {
        const mark: string = row[step % row.length]!;

        if (mark !== ".") {
          notes.push({
            ...createNote(step, kitPitch - lane),
            velocity: mark === "o" ? quiet : 1,
            roll: mark === "r" ? rollFast : mark === "R" ? rollFaster : 1,
          });
        }
      }
    });

    return notes;
  };
}

function beat(bars: number, rows: Record<string, string>): Part {
  return grid(drumLanes, bars, rows);
}

function hits(bars: number, rows: Record<string, string>): Part {
  return grid(effectLanes, bars, rows);
}

function createTune(setup: Setup): Tune {
  const inserts: Array<Insert> = new Array();
  const shift: number = ((setup.key + 5) % 12) - 5;

  for (let index = 0; index < insertCount; index++) {
    inserts.push({ ...createInsert(index), ...setup.mix[index] });
  }

  const score: Score = {
    tempo: setup.tempo,
    key: setup.key,
    swing: setup.swing,
    singer: setup.singer ?? "lead",
    voicebank: new Array(5).fill(null),
    lyrics: setup.lyrics ?? "",
    shared: false,
    channels: new Array(),
    patterns: new Array(),
    clips: new Array(),
    tracks: 8,
    inserts: inserts,
  };

  return {
    score: score,
    channel: (instrument, name, insert, volume, extra = {}) => {
      const channel: Channel = {
        ...createChannel(instrument, insert),
        name: name,
        volume: volume,
        ...extra,
      };

      score.channels.push(channel);
      return channel.id;
    },
    block: (name, bars, parts) => {
      const pattern: Sequence = { ...createSequence(name, bars), notes: {} };

      for (const [channel, part] of Object.entries(parts)) {
        pattern.notes[channel] = part(shift);
      }

      score.patterns.push(pattern);
    },
    clip: (name, track, bar, bars) => {
      score.clips.push({
        pattern: score.patterns.find(
          (pattern: Sequence) => pattern.name === name,
        )!.id,
        track: track,
        step: bar * stepsPerBar,
        length: bars * stepsPerBar,
      });
      score.tracks = Math.max(score.tracks, track + 1);
    },
  };
}

function blankScore(): Score {
  const score: Score = createTune({
    tempo: 172,
    key: 0,
    swing: 0,
    mix: {},
  }).score;

  score.patterns.push(createSequence("Pattern 1"));
  return score;
}

function baseSound(id: string, name: string): Sound {
  return {
    id: id,
    name: name,
    source: "synth",
    file: null,
    fileName: "",
    wave: "sine",
    pitch: 440,
    slide: 440,
    attack: 0.01,
    sustain: 0.05,
    decay: 0.25,
    vibratoDepth: 0,
    vibratoRate: 8,
    volume: 0.5,
    score: blankScore(),
    ambience: {
      levels: new Array(9).fill(0),
      brightness: 0.5,
      motion: 0.5,
      length: 12,
      seed: 1,
    },
  };
}

function synth(
  id: string,
  name: string,
  wave: Waveform,
  [pitch, slide]: [number, number],
  [attack, sustain, decay]: [number, number, number],
  [depth, rate]: [number, number],
  volume: number,
): Sound {
  return {
    ...baseSound(id, name),
    wave: wave,
    pitch: pitch,
    slide: slide,
    attack: attack,
    sustain: sustain,
    decay: decay,
    vibratoDepth: depth,
    vibratoRate: rate,
    volume: volume,
  };
}

function ambient(
  id: string,
  name: string,
  ambience: Ambience,
  volume: number,
): Sound {
  return {
    ...baseSound(id, name),
    source: "ambient",
    ambience: ambience,
    volume: volume,
  };
}

function song(id: string, name: string, tune: Tune, volume: number): Sound {
  return {
    ...baseSound(id, name),
    source: "song",
    score: tune.score,
    volume: volume,
  };
}

function titleSong(): Sound {
  const tune: Tune = createTune({
    tempo: 120,
    key: 0,
    swing: 0,
    mix: {
      1: { name: "Piano", space: 0.45, delay: 6 },
      2: { name: "Strings", space: 0.5, filter: 0.7 },
      3: { name: "Bell", space: 0.6, delay: 3, pan: 0.2 },
    },
  });
  const piano: string = tune.channel("piano", "Piano", 1, 0.8);
  const strings: string = tune.channel("strings", "Strings", 2, 0.55);
  const bell: string = tune.channel("sampler", "Buoy bell", 3, 0.45, {
    sample: soundIds["bell"]!,
  });
  const sub: string = tune.channel("sub", "Sub", 0, 0.5);

  tune.block("Harbour chords", 4, {
    [strings]: seq("A3+C4+E4:16 F3+A3+C4:16 C4+E4+G4:16 G3+B3+D4:16"),
    [sub]: seq("A1:16 F1:16 C2:16 G1:16"),
  });
  tune.block("Keeper", 4, {
    [piano]: seq(
      "A4:2 E5:2 C5:2 E5:2 A4:2 E5:2 C5:2 E5:2 " +
        "F4:2 C5:2 A4:2 C5:2 F4:2 C5:2 A4:2 C5:2 " +
        "G4:2 E5:2 C5:2 E5:2 G4:2 E5:2 C5:2 E5:2 " +
        "G4:2 D5:2 B4:2 D5:2 G4:2 D5:2 B4:2 D5:2",
      0.8,
    ),
  });
  tune.block("Lamp theme", 4, {
    [piano]: seq(
      "E5:6 D5:2 C5:4 A4:4 C5:6 A4:2 F4:4 A4:4 " +
        "G4:6 E4:2 G4:4 C5:4 B4:8 D5:4 B4:4",
    ),
    [bell]: seq("A4:16 F4:16 C5:16 G4:16", 0.8),
  });
  tune.clip("Harbour chords", 0, 0, 24);
  tune.clip("Keeper", 1, 0, 8);
  tune.clip("Lamp theme", 2, 8, 8);
  tune.clip("Keeper", 1, 16, 8);
  return song(soundIds["title"]!, "The Last Lamp", tune, 0.7);
}

function harbourSong(): Sound {
  const tune: Tune = createTune({
    tempo: 172,
    key: 0,
    swing: 0.1,
    mix: {
      1: { name: "Break", grit: 0.15 },
      2: { name: "Sub" },
      3: { name: "Pads", space: 0.5, filter: 0.65 },
      4: { name: "Bells", space: 0.35, delay: 3, pan: -0.25 },
      5: { name: "Flute", space: 0.4, delay: 6, pan: 0.15 },
      7: { name: "FX", space: 0.5 },
    },
  });
  const drums: string = tune.channel("drums", "Drums", 1, 0.8);
  const bass: string = tune.channel("sub", "Sub bass", 2, 0.75);
  const pad: string = tune.channel("pad", "Pad", 3, 0.55);
  const arp: string = tune.channel("bell", "Harbour bells", 4, 0.45);
  const lead: string = tune.channel("flute", "Flute", 5, 0.7);
  const fx: string = tune.channel("fx", "FX", 7, 0.6);
  const groove: Record<string, string> = {
    kick: "x.........x.....x.........x...x.",
    snare: "....x.......x.......x.......x...",
    ghost: ".......o.o....o........o.o....oo",
    hat: "x.o.x.o.x.o.x.o.x.o.x.o.x.o.x.xo",
  };

  tune.block("Pads", 4, {
    [pad]: seq("A3+C4+E4:16 F3+A3+C4:16 C4+E4+G4:16 G3+B3+D4:16"),
  });
  tune.block("Bells", 4, {
    [arp]: seq(
      "A4:2 C5:2 E5:2 A5:2 E5:2 C5:2 A4:2 E4:2 " +
        "F4:2 A4:2 C5:2 F5:2 C5:2 A4:2 F4:2 C4:2 " +
        "C5:2 E5:2 G5:2 C6:2 G5:2 E5:2 C5:2 G4:2 " +
        "G4:2 B4:2 D5:2 G5:2 D5:2 B4:2 G4:2 D4:2",
    ),
  });
  tune.block("Bass", 4, {
    [bass]: seq(
      "A1:6 .:2 A1:4 C2:4 F1:6 .:2 F1:4 A1:4 " +
        "C2:6 .:2 C2:4 E2:4 G1:6 .:2 G1:4 B1:4",
    ),
  });
  tune.block("Break", 2, { [drums]: beat(2, groove) });
  tune.block("Break fill", 4, {
    [drums]: beat(4, {
      ...groove,
      snare:
        "....x.......x.......x.......x..." + "....x.......x.......x.....r.x.r.",
      ride: "x...x...x...x...",
    }),
  });
  tune.block("Flute A", 4, {
    [lead]: seq(
      "E5:6 D5:2 C5:4 A4:4 C5:6 A4:2 F4:4 A4:4 " +
        "G4:6 E4:2 G4:4 C5:4 B4:8 D5:4 B4:4",
    ),
  });
  tune.block("Flute B", 4, {
    [lead]: seq(
      "A5:4 G5:2 E5:2 C5:4 E5:4 F5:4 E5:2 C5:2 A4:4 C5:4 " +
        "G5:4 E5:2 C5:2 G4:4 C5:4 D5:8 B4:4 G4:4",
    ),
  });
  tune.block("Risers", 8, {
    [fx]: hits(8, {
      riser: "." + ".".repeat(126) + "x",
      impact: "x" + ".".repeat(127),
    }),
  });
  tune.clip("Pads", 0, 0, 48);
  tune.clip("Bells", 1, 0, 16);
  tune.clip("Bass", 2, 8, 40);
  tune.clip("Break", 3, 8, 24);
  tune.clip("Break fill", 3, 32, 16);
  tune.clip("Flute A", 4, 16, 16);
  tune.clip("Flute B", 4, 32, 16);
  tune.clip("Bells", 1, 32, 16);
  tune.clip("Risers", 5, 8, 40);
  return song(soundIds["harbour"]!, "Harbour Mouth", tune, 0.65);
}

function breakwaterSong(): Sound {
  const tune: Tune = createTune({
    tempo: 168,
    key: 5,
    swing: 0.25,
    mix: {
      1: { name: "Tight kit", grit: 0.25 },
      2: { name: "Reese", grit: 0.1, filter: 0.75 },
      3: { name: "Strings", space: 0.4, filter: 0.8 },
      4: { name: "Guitar", delay: 3, space: 0.3, pan: -0.3 },
      5: { name: "Saw lead", delay: 6, space: 0.35, pan: 0.1 },
      6: { name: "Buoy", delay: 4, space: 0.5, pan: 0.35 },
    },
  });
  const drums: string = tune.channel("drums", "Drums", 1, 0.85, { kit: 1 });
  const bass: string = tune.channel("reese", "Reese", 2, 0.65);
  const strings: string = tune.channel("strings", "Strings", 3, 0.5);
  const guitar: string = tune.channel("guitar", "Stabs", 4, 0.45);
  const lead: string = tune.channel("saw", "Saw lead", 5, 0.5);
  const buoy: string = tune.channel("sampler", "Buoy bell", 6, 0.4, {
    sample: soundIds["bell"]!,
    pan: 0.2,
  });

  tune.block("Strings", 8, {
    [strings]: seq(
      "A3+C4+E4:16 E3+G3+B3:16 F3+A3+C4:16 G3+B3+D4:16 " +
        "D3+F3+A3:16 A3+C4+E4:16 E3+G#3+B3:16 A3+C4+E4:16",
    ),
  });
  tune.block("Reese", 8, {
    [bass]: seq(
      "A1:4 .:2 A1:2 C2:4 A1:4 E1:4 .:2 E1:2 G1:4 B1:4 " +
        "F1:4 .:2 F1:2 A1:4 F1:4 G1:4 .:2 G1:2 B1:4 D2:4 " +
        "D2:4 .:2 D2:2 F2:4 D2:4 A1:4 .:2 A1:2 C2:4 E2:4 " +
        "E1:4 .:2 E1:2 G#1:4 B1:4 A1:8 E1:4 A1:4",
    ),
  });
  tune.block("Kit", 2, {
    [drums]: beat(2, {
      kick: "x.....x...x.....x.....x.x.......",
      snare: "....x.......x.......x.......x...",
      ghost: "..o....o.o....o...o....o.o...o.o",
      hat: "x.x.x.x.x.x.x.x.",
      ride: "................x...............",
    }),
  });
  tune.block("Kit roll", 2, {
    [drums]: beat(2, {
      kick: "x.....x...x.....x.....x.x.......",
      snare: "....x.......x.......x...r...R...",
      hat: "x.xox.xox.xox.xo",
    }),
  });
  tune.block("Stabs", 4, {
    [guitar]: seq(
      ".:4 A3+E4:2 .:6 A3+E4:2 .:2 .:4 E3+B3:2 .:6 E3+B3:2 .:2 " +
        ".:4 F3+C4:2 .:6 F3+C4:2 .:2 .:4 G3+D4:2 .:6 G3+D4:2 .:2",
    ),
  });
  tune.block("Saw hook", 8, {
    [lead]: seq(
      "A4:3 C5:3 E5:2 D5:4 C5:4 B4:3 G4:3 E4:2 G4:4 B4:4 " +
        "C5:3 A4:3 F4:2 A4:4 C5:4 D5:3 B4:3 G4:2 B4:4 D5:4 " +
        "F5:3 E5:3 D5:2 C5:4 A4:4 E5:3 C5:3 A4:2 C5:4 E5:4 " +
        "E5:3 D5:3 B4:2 G#4:4 B4:4 A4:12 .:4",
    ),
  });
  tune.block("Buoy", 4, {
    [buoy]: seq("A4:8 .:8 .:8 E5:8 C5:8 .:8 .:8 G4:8"),
  });
  tune.clip("Strings", 0, 0, 56);
  tune.clip("Buoy", 1, 0, 8);
  tune.clip("Kit", 2, 8, 22);
  tune.clip("Kit roll", 2, 30, 2);
  tune.clip("Kit", 2, 32, 22);
  tune.clip("Kit roll", 2, 54, 2);
  tune.clip("Reese", 3, 8, 48);
  tune.clip("Stabs", 4, 16, 16);
  tune.clip("Saw hook", 5, 24, 32);
  tune.clip("Buoy", 1, 40, 16);
  return song(soundIds["breakwater"]!, "Breakwater", tune, 0.65);
}

function stairSong(): Sound {
  const tune: Tune = createTune({
    tempo: 140,
    key: 3,
    swing: 0.15,
    singer: "choir",
    mix: {
      1: { name: "Lo-fi kit", grit: 0.35, filter: 0.7 },
      2: { name: "Sub" },
      3: { name: "Organ", space: 0.55, filter: 0.55 },
      4: { name: "Piano", delay: 3, space: 0.45, pan: -0.2 },
      6: { name: "Choir", delay: 8, space: 0.7 },
      7: { name: "FX", space: 0.6 },
    },
  });
  const drums: string = tune.channel("drums", "Drums", 1, 0.8, { kit: 3 });
  const bass: string = tune.channel("sub", "Sub bass", 2, 0.75);
  const organ: string = tune.channel("organ", "Organ", 3, 0.5);
  const piano: string = tune.channel("piano", "Piano", 4, 0.65);
  const choir: string = tune.channel("vocals", "Choir", 6, 0.6);
  const fx: string = tune.channel("fx", "FX", 7, 0.55);

  tune.block("Organ", 4, {
    [organ]: seq("D3+F3+A3:16 A2+C3+E3:16 A#2+D3+F3:16 E3+G#3+B3:16"),
  });
  tune.block("Deep bass", 4, {
    [bass]: seq("D2:12 .:4 A1:12 .:4 A#1:12 .:4 E2:8 E1:8"),
  });
  tune.block("Slow step", 2, {
    [drums]: beat(2, {
      kick: "x.........x.......x.............",
      snare: "........x...............x.......",
      ghost: "...o.......o.......o.......o..oo",
      hat: "x...x...x...x...x...x...x...x.x.",
    }),
  });
  tune.block("Descent", 4, {
    [piano]: seq(
      "A5:2 F5:2 D5:2 A4:2 F5:2 D5:2 A4:2 F4:2 " +
        "G5:2 E5:2 C5:2 A4:2 E5:2 C5:2 A4:2 E4:2 " +
        "F5:2 D5:2 A#4:2 F4:2 D5:2 A#4:2 F4:2 D4:2 " +
        "E5:2 B4:2 G#4:2 E4:2 B4:2 G#4:2 E4:2 B3:2",
      0.8,
    ),
  });
  tune.block("Choir", 8, {
    [choir]: sung(
      "D5:8 F5:8 E5:16 C5:8 E5:8 A4:16 " + "D5:8 A#4:8 F4:16 G#4:8 B4:8 E5:16",
      [0, 3, 1, 2],
    ),
  });
  tune.block("Sinking", 8, {
    [fx]: hits(8, {
      fall: "x" + ".".repeat(63),
      reverse: ".".repeat(127) + "x",
    }),
  });
  tune.clip("Organ", 0, 0, 32);
  tune.clip("Descent", 1, 0, 32);
  tune.clip("Deep bass", 2, 4, 28);
  tune.clip("Slow step", 3, 8, 24);
  tune.clip("Choir", 4, 8, 8);
  tune.clip("Choir", 4, 24, 8);
  tune.clip("Sinking", 5, 0, 32);
  return song(soundIds["stair"]!, "The Drowned Stair", tune, 0.7);
}

function lampRoomSong(): Sound {
  const tune: Tune = createTune({
    tempo: 178,
    key: 7,
    swing: 0,
    mix: {
      1: { name: "Heavy kit", grit: 0.3 },
      2: { name: "Reese", grit: 0.2 },
      3: { name: "Arp", delay: 3, space: 0.35, pan: -0.2 },
      5: { name: "Hoover", delay: 6, space: 0.3 },
      7: { name: "FX", space: 0.5 },
    },
  });
  const drums: string = tune.channel("drums", "Drums", 1, 0.85, { kit: 2 });
  const bass: string = tune.channel("reese", "Reese", 2, 0.7);
  const arp: string = tune.channel("square", "Square arp", 3, 0.35);
  const lead: string = tune.channel("hoover", "Hoover", 5, 0.5);
  const fx: string = tune.channel("fx", "FX", 7, 0.6);

  tune.block("Arp", 4, {
    [arp]: seq(
      "A4 C5 E5 A5 E5 C5 A4 C5 A4 C5 E5 A5 E5 C5 A4 C5 " +
        "F4 A4 C5 F5 C5 A4 F4 A4 F4 A4 C5 F5 C5 A4 F4 A4 " +
        "D4 F4 A4 D5 A4 F4 D4 F4 D4 F4 A4 D5 A4 F4 D4 F4 " +
        "E4 G#4 B4 E5 B4 G#4 E4 G#4 E4 G#4 B4 E5 B4 G#4 E4 G#4",
      0.8,
    ),
  });
  tune.block("Reese drive", 4, {
    [bass]: seq(
      "A1:3 A1:3 A1:2 C2:3 A1:3 G1:2 F1:3 F1:3 F1:2 A1:3 F1:3 E1:2 " +
        "D2:3 D2:3 D2:2 F2:3 D2:3 C2:2 E1:3 E1:3 E1:2 G#1:3 B1:3 E2:2",
    ),
  });
  tune.block("Amen", 2, {
    [drums]: beat(2, {
      kick: "x.x.......xx....x.x.......x.....",
      snare: "....x..o.o..x..o....x..o.o..x..o",
      hat: "x.x.x.x.x.x.x.x.",
      ride: "x...............",
    }),
  });
  tune.block("Amen chop", 2, {
    [drums]: beat(2, {
      kick: "x.x.......xx....x.x...x.........",
      snare: "....x..o.o..x..o....r.......R...",
      hat: "xoxoxoxoxoxoxoxo",
    }),
  });
  tune.block("Hoover", 8, {
    [lead]: seq(
      "A4:8 C5:4 E5:4 F5:8 E5:4 C5:4 D5:8 F5:4 A5:4 G#5:8 E5:8 " +
        "A5:6 G5:2 E5:4 C5:4 F5:6 E5:2 C5:4 A4:4 " +
        "D5:6 C5:2 A4:4 F4:4 E4:8 G#4:4 B4:4",
    ),
  });
  tune.block("Zaps", 4, {
    [fx]: hits(4, {
      zap: "....x...........",
      impact: "x" + ".".repeat(63),
    }),
  });
  tune.clip("Arp", 0, 0, 40);
  tune.clip("Amen", 1, 4, 14);
  tune.clip("Amen chop", 1, 18, 2);
  tune.clip("Amen", 1, 20, 18);
  tune.clip("Amen chop", 1, 38, 2);
  tune.clip("Reese drive", 2, 4, 36);
  tune.clip("Hoover", 3, 12, 8);
  tune.clip("Hoover", 3, 24, 16);
  tune.clip("Zaps", 4, 4, 36);
  return song(soundIds["lampRoom"]!, "Lamp Room", tune, 0.62);
}

function brimSong(): Sound {
  const tune: Tune = createTune({
    tempo: 160,
    key: 2,
    swing: 0.35,
    mix: {
      1: { name: "Swing kit", grit: 0.1 },
      2: { name: "Sub" },
      3: { name: "Piano", delay: 3, space: 0.35, pan: -0.15 },
      5: { name: "Guitar", delay: 6, space: 0.3, pan: 0.15 },
    },
  });
  const drums: string = tune.channel("drums", "Drums", 1, 0.8);
  const bass: string = tune.channel("sub", "Sub bass", 2, 0.75);
  const piano: string = tune.channel("piano", "Piano", 3, 0.55);
  const guitar: string = tune.channel("guitar", "Guitar", 5, 0.65);

  tune.block("Sway", 2, {
    [drums]: beat(2, {
      kick: "x.........x.....x.....x.........",
      snare: "....x.......x.......x.......x.o.",
      hat: "x.oxx.oxx.oxx.ox",
    }),
  });
  tune.block("Walking", 4, {
    [bass]: seq(
      "A1:4 C2:4 E2:4 G2:4 F1:4 A1:4 C2:4 E2:4 " +
        "D2:4 F2:4 A2:4 F2:4 E2:4 D2:4 C2:4 B1:4",
    ),
  });
  tune.block("Comping", 4, {
    [piano]: seq(
      ".:2 A3+C4+E4:2 .:4 .:2 A3+C4+E4:2 .:4 " +
        ".:2 F3+A3+C4:2 .:4 .:2 F3+A3+C4:2 .:4 " +
        ".:2 D3+F3+A3:2 .:4 .:2 D3+F3+A3:2 .:4 " +
        ".:2 E3+G#3+B3:2 .:4 .:2 E3+G#3+B3:2 .:4",
      0.8,
    ),
  });
  tune.block("Wide brim", 8, {
    [guitar]: seq(
      "E5:3 D5:1 C5:4 A4:4 C5:4 F5:3 E5:1 C5:4 A4:8 " +
        "D5:3 C5:1 A4:4 F4:4 A4:4 B4:3 C5:1 D5:4 E5:8 " +
        "A5:4 G5:2 E5:2 C5:4 E5:4 F5:4 E5:2 C5:2 A4:8 " +
        "D5:4 E5:2 F5:2 A5:4 F5:4 E5:4 D5:2 B4:2 G#4:8",
    ),
  });
  tune.clip("Walking", 0, 0, 32);
  tune.clip("Comping", 1, 0, 32);
  tune.clip("Sway", 2, 4, 28);
  tune.clip("Wide brim", 3, 8, 24);
  return song(soundIds["brim"]!, "The Wide Brim", tune, 0.68);
}

function drownedSong(): Sound {
  const tune: Tune = createTune({
    tempo: 150,
    key: 10,
    swing: 0,
    mix: {
      1: { name: "Kit", grit: 0.45 },
      2: { name: "Reese", filter: 0.5 },
      3: { name: "Organ", space: 0.6, filter: 0.5 },
      4: { name: "Toll", delay: 8, space: 0.7 },
      5: { name: "Strings", space: 0.5 },
    },
  });
  const drums: string = tune.channel("drums", "Drums", 1, 0.85, { kit: 2 });
  const bass: string = tune.channel("reese", "Reese", 2, 0.7);
  const organ: string = tune.channel("organ", "Organ", 3, 0.5);
  const toll: string = tune.channel("sampler", "Sunken toll", 4, 0.6, {
    sample: soundIds["bell"]!,
  });
  const strings: string = tune.channel("strings", "Strings", 5, 0.6);

  tune.block("Toll", 4, {
    [toll]: seq("A3:16 A3:8 C4:8 F3:16 G3:16"),
  });
  tune.block("Organ", 4, {
    [organ]: seq("A2+E3+A3:16 C3+G3+C4:16 F2+C3+F3:16 G2+D3+G3:16"),
  });
  tune.block("Tread", 4, {
    [bass]: seq("A1:8 A1:8 C2:8 C2:8 F1:8 F1:8 G1:8 G1:4 B1:4"),
  });
  tune.block("March", 2, {
    [drums]: beat(2, {
      kick: "x.......x.......x.......x...x...",
      snare: "........x.......................x...............x.......x...r...",
      hat: "x...x...x...x...",
    }),
  });
  tune.block("Lament", 8, {
    [strings]: seq(
      "A4:12 B4:4 C5:8 E5:8 F5:12 E5:4 D5:16 " +
        "E5:12 D5:4 C5:8 A4:8 B4:8 D5:8 G#4:16",
    ),
  });
  tune.clip("Toll", 0, 0, 32);
  tune.clip("Organ", 1, 4, 28);
  tune.clip("Tread", 2, 8, 24);
  tune.clip("March", 3, 8, 24);
  tune.clip("Lament", 4, 16, 16);
  return song(soundIds["drowned"]!, "The Drowned Bell", tune, 0.68);
}

function vesperSong(): Sound {
  const tune: Tune = createTune({
    tempo: 174,
    key: 0,
    swing: 0,
    singer: "ritsu",
    lyrics: vesperLyrics,
    mix: {
      1: { name: "Kit", grit: 0.2 },
      2: { name: "Reese", grit: 0.15 },
      3: { name: "Strings", space: 0.45 },
      4: { name: "Saw", delay: 3, space: 0.3, pan: -0.2 },
      5: { name: "Hoover", delay: 6, space: 0.3, pan: 0.2 },
      6: { name: "Vesper", delay: 6, space: 0.45 },
      7: { name: "FX", space: 0.6 },
    },
  });
  const drums: string = tune.channel("drums", "Drums", 1, 0.85);
  const bass: string = tune.channel("reese", "Reese", 2, 0.68);
  const strings: string = tune.channel("strings", "Strings", 3, 0.5);
  const saw: string = tune.channel("saw", "Saw arp", 4, 0.3);
  const hoover: string = tune.channel("hoover", "Hoover", 5, 0.45);
  const voice: string = tune.channel("vocals", "Vesper", 6, 0.85);
  const fx: string = tune.channel("fx", "FX", 7, 0.6);

  tune.block("Strings", 8, {
    [strings]: seq(
      "A3+C4+E4:16 F3+A3+C4:16 C4+E4+G4:16 G3+B3+D4:16 " +
        "A3+C4+E4:16 F3+A3+C4:16 D3+F3+A3:16 E3+G#3+B3:16",
    ),
  });
  tune.block("Reese", 8, {
    [bass]: seq(
      "A1:6 A1:2 C2:4 E2:4 F1:6 F1:2 A1:4 C2:4 " +
        "C2:6 C2:2 E2:4 G2:4 G1:6 G1:2 B1:4 D2:4 " +
        "A1:6 A1:2 C2:4 E2:4 F1:6 F1:2 A1:4 C2:4 " +
        "D2:6 D2:2 F2:4 A2:4 E2:6 E2:2 G#1:4 B1:4",
    ),
  });
  tune.block("Saw arp", 4, {
    [saw]: seq(
      "A4 E5 C5 E5 A4 E5 C5 E5 A4 E5 C5 E5 A4 E5 C5 E5 " +
        "F4 C5 A4 C5 F4 C5 A4 C5 F4 C5 A4 C5 F4 C5 A4 C5 " +
        "G4 E5 C5 E5 G4 E5 C5 E5 G4 E5 C5 E5 G4 E5 C5 E5 " +
        "G4 D5 B4 D5 G4 D5 B4 D5 G4 D5 B4 D5 G4 D5 B4 D5",
      0.8,
    ),
  });
  tune.block("Vespers", 2, {
    [drums]: beat(2, {
      kick: "x.........x.....x.....x.........",
      snare: "....x.......x.......x.......x...",
      ghost: ".......o.o....o....o...o.o....oo",
      hat: "x.xox.xox.xox.xo",
    }),
  });
  tune.block("Vespers roll", 2, {
    [drums]: beat(2, {
      kick: "x.........x.....x.....x.........",
      snare: "....x.......x.......r.......R...",
      hat: "x.xox.xox.xox.xo",
      ride: "x...............",
    }),
  });
  tune.block("Hymn", 8, {
    [voice]: seq(
      "A4:2 A4:2 C5:2 D5:2 E5:4 D5:2 C5:2 A4:4 C5:4 D5:8 " +
        "E5:2 E5:2 G5:2 E5:2 D5:4 C5:2 D5:2 E5:4 C5:4 A4:8 " +
        "A5:2 G5:2 E5:2 D5:2 E5:4 G5:2 A5:2 G5:4 E5:4 D5:8 " +
        "C5:2 D5:2 E5:2 G5:2 E5:4 D5:2 C5:2 B4:4 C5:4 A4:8",
    ),
  });
  tune.block("Hoover answer", 16, {
    [hoover]: seq(
      ".:48 E5:8 D5:8 .:48 E5:8 C5:8 .:48 G5:8 E5:8 .:48 C5:8 A4:8",
    ),
  });
  tune.block("Swell", 8, {
    [fx]: hits(8, {
      riser: ".".repeat(127) + "x",
      impact: "x" + ".".repeat(127),
    }),
  });
  tune.clip("Strings", 0, 0, 56);
  tune.clip("Saw arp", 1, 0, 8);
  tune.clip("Vespers", 2, 8, 22);
  tune.clip("Vespers roll", 2, 30, 2);
  tune.clip("Vespers", 2, 32, 22);
  tune.clip("Vespers roll", 2, 54, 2);
  tune.clip("Reese", 3, 8, 48);
  tune.clip("Hymn", 4, 16, 16);
  tune.clip("Hoover answer", 5, 32, 16);
  tune.clip("Hymn", 4, 40, 16);
  tune.clip("Saw arp", 1, 32, 8);
  tune.clip("Swell", 6, 8, 48);
  return song(soundIds["vesper"]!, "Vesper's Light", tune, 0.68);
}

function starterSounds(): Array<Sound> {
  return [
    synth(
      soundIds["bell"]!,
      "Buoy Bell",
      "sine",
      [440, 436],
      [0.005, 0.02, 1.4],
      [0.08, 5],
      0.8,
    ),
    synth(
      soundIds["gull"]!,
      "Gull Cry",
      "triangle",
      [1500, 780],
      [0.03, 0.08, 0.3],
      [0.6, 11],
      0.3,
    ),
    synth(
      soundIds["spark"]!,
      "Wick Spark",
      "square",
      [1800, 3600],
      [0.002, 0.01, 0.1],
      [0, 8],
      0.2,
    ),
    synth(
      soundIds["knock"]!,
      "Hull Knock",
      "noise",
      [900, 120],
      [0.002, 0.02, 0.22],
      [0, 8],
      0.5,
    ),
    synth(
      soundIds["thunder"]!,
      "Thunderclap",
      "noise",
      [1400, 60],
      [0.01, 0.2, 1.8],
      [0, 8],
      0.6,
    ),
    synth(
      soundIds["voice"]!,
      "Keeper Voice",
      "square",
      [420, 400],
      [0.002, 0.012, 0.03],
      [0, 8],
      0.14,
    ),
    synth(
      soundIds["voiceLow"]!,
      "Tide Voice",
      "triangle",
      [190, 170],
      [0.004, 0.02, 0.05],
      [0.4, 20],
      0.3,
    ),
    ambient(
      soundIds["rain"]!,
      "Rain on the Glass",
      {
        levels: [0.35, 1, 0, 0, 0, 0, 0, 0.45, 0],
        brightness: 0.45,
        motion: 0.55,
        length: 24,
        seed: 11,
      },
      0.6,
    ),
    ambient(
      soundIds["gallery"]!,
      "Lamp Gallery",
      {
        levels: [0.7, 0, 0.4, 0, 0.2, 0, 0, 0.15, 0],
        brightness: 0.35,
        motion: 0.7,
        length: 20,
        seed: 12,
      },
      0.6,
    ),
    ambient(
      soundIds["surf"]!,
      "Morning Surf",
      {
        levels: [0.2, 0, 0.85, 0, 0, 0, 0.2, 0, 0.5],
        brightness: 0.6,
        motion: 0.45,
        length: 24,
        seed: 13,
      },
      0.6,
    ),
    titleSong(),
    harbourSong(),
    breakwaterSong(),
    stairSong(),
    lampRoomSong(),
    brimSong(),
    drownedSong(),
    vesperSong(),
  ];
}

export { soundIds, starterSounds };
