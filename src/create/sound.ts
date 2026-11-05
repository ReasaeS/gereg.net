import type { Graphics } from "pixi.js";
import type { Channel as Instrument, Note, Score, Sound } from "./types";
import { effectiveVolume, getSafe, type Channel } from "../settings/settings";
import { readBlob, storeBlob } from "./images";
import {
  patchOf,
  renderScore,
  scoreLength,
  stepsPerBar,
  syllableNames,
  syllablesOf,
} from "./jungle";
import { renderAmbience } from "./ambience";

const drawRate: number = 11025; // Hz
const drawDetail: number = 256;
const noiseSeed: number = 12345;
const buffers: Map<string, AudioBuffer> = new Map();
const loading: Map<string, Promise<AudioBuffer | null>> = new Map();
const scores: Map<string, Array<Float32Array<ArrayBuffer>>> = new Map();
const scoreCache: number = 16;
const previews: Map<string, Array<Float32Array<ArrayBuffer>>> = new Map();
const previewCache: number = 48;
const previewSteps: number = 4;
const previewLead: number = 2; // steps
let notePreview: AudioBufferSourceNode | null = null;
const songMinimum: number = 90; // s
const resampled: WeakMap<
  AudioBuffer,
  Map<number, Float32Array>
> = new WeakMap();
let songPreview: (() => void) | null = null;
const ritsuVoices: Array<string> = [
  "voices/ritsu/a.wav",
  "voices/ritsu/u.wav",
  "voices/ritsu/i.wav",
  "voices/ritsu/o.wav",
  "voices/ritsu/n.wav",
  "voices/ritsu/e.wav",
];
const lyricFolder: string = "voices/ritsu/lyrics/";
let library: Array<Sound> = new Array();
let context: AudioContext | null = null;

type Track = {
  stop: () => void;
  position: () => number;
};

function isMusic(sound: Sound): boolean {
  return (
    sound.source === "file" ||
    sound.source === "song" ||
    sound.source === "ambient"
  );
}

function canPlay(sound: Sound): boolean {
  return (
    sound.source === "song" ||
    sound.source === "ambient" ||
    (sound.source === "file" && sound.file !== null)
  );
}

function songLength(score: Score): number {
  return repeated(scoreLength(score));
}

function repeated(loop: number): number {
  return loop * Math.max(Math.ceil(songMinimum / loop), 1);
}

function trackLength(sound: Sound): number {
  return sound.source === "ambient"
    ? repeated(sound.ambience.length)
    : songLength(sound.score);
}

function soundLength(sound: Sound): number {
  return sound.source === "song"
    ? songLength(sound.score)
    : sound.source === "ambient"
      ? sound.ambience.length
      : sound.source === "file"
        ? (bufferOf(sound)?.duration ?? 0)
        : sound.attack + sound.sustain + sound.decay;
}

function synthLength(sound: Sound): number {
  return sound.attack + sound.sustain + sound.decay;
}

function envelope(sound: Sound, time: number): number {
  if (time < sound.attack) {
    return time / sound.attack;
  }

  if (time < sound.attack + sound.sustain) {
    return 1;
  }

  const fade: number = 1 - (time - sound.attack - sound.sustain) / sound.decay;

  return Math.max(fade, 0) ** 2;
}

function synthesize(sound: Sound, rate: number): Float32Array<ArrayBuffer> {
  const length: number = synthLength(sound);
  const samples: Float32Array<ArrayBuffer> = new Float32Array(
    Math.max(Math.ceil(length * rate), 1),
  );
  const ratio: number = sound.slide / sound.pitch;
  let phase: number = 0;
  let noise: number = 0;
  let seed: number = noiseSeed;

  for (let index = 0; index < samples.length; index++) {
    const time: number = index / rate;
    const vibrato: number =
      (sound.vibratoDepth * Math.sin(Math.PI * 2 * sound.vibratoRate * time)) /
      12;
    const frequency: number =
      sound.pitch * ratio ** (time / length) * 2 ** vibrato;

    phase += frequency / rate;

    if (phase >= 1) {
      phase -= Math.floor(phase);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      noise = (seed / 4294967296) * 2 - 1;
    }

    const value: number =
      sound.wave === "square"
        ? phase < 0.5
          ? 1
          : -1
        : sound.wave === "sine"
          ? Math.sin(Math.PI * 2 * phase)
          : sound.wave === "sawtooth"
            ? phase * 2 - 1
            : sound.wave === "triangle"
              ? 1 - 4 * Math.abs(phase - 0.5)
              : noise;

    samples[index] = value * envelope(sound, time) * sound.volume;
  }

  return samples;
}

function audio(): AudioContext {
  context = context ?? new AudioContext();

  return context;
}

async function decode(blob: Blob): Promise<AudioBuffer> {
  return audio().decodeAudioData(await blob.arrayBuffer());
}

async function readAudio(id: string): Promise<AudioBuffer | null> {
  try {
    const blob: Blob | undefined = await readBlob(id);

    if (blob === undefined) {
      return null;
    }

    const buffer: AudioBuffer = await decode(blob);

    buffers.set(id, buffer);
    return buffer;
  } catch {
    console.warn("Could not load the sound " + id);
    return null;
  }
}

function loadAudio(id: string | null): Promise<AudioBuffer | null> {
  if (id === null) {
    return Promise.resolve(null);
  }

  const cached: AudioBuffer | undefined = buffers.get(id);

  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  let pending: Promise<AudioBuffer | null> | undefined = loading.get(id);

  if (pending === undefined) {
    pending = readAudio(id);
    loading.set(id, pending);
  }

  return pending;
}

async function importAudio(file: Blob): Promise<string> {
  const buffer: AudioBuffer = await decode(file);
  const id: string = await storeBlob(file);

  buffers.set(id, buffer);
  return id;
}

function useSounds(list: Array<Sound>): void {
  library = list;
}

function voiceFiles(score: Score): Array<string | null> {
  if (score.singer === "ritsu") {
    return ritsuVoices;
  }

  if (score.singer !== "bank") {
    return new Array();
  }

  return score.voicebank.map(
    (id: string | null) =>
      library.find((sound: Sound) => sound.id === id && sound.source === "file")
        ?.file ?? null,
  );
}

function sampleSounds(score: Score): Array<Sound> {
  const ids: Set<string> = new Set(
    score.channels
      .map((channel: Instrument) => channel.sample)
      .filter((id: string | null): id is string => id !== null),
  );

  return library.filter(
    (sound: Sound) =>
      ids.has(sound.id) &&
      (sound.source === "file" || sound.source === "synth"),
  );
}

function sampleChoices(): Array<{ value: string | null; label: string }> {
  return [
    { value: null, label: "None" },
    ...library
      .filter(
        (sound: Sound) => sound.source === "file" || sound.source === "synth",
      )
      .map((sound: Sound) => ({ value: sound.id, label: sound.name })),
  ];
}

function lyricNames(score: Score): Array<string> {
  return score.singer === "ritsu"
    ? [...new Set(syllablesOf(score.lyrics))].filter((syllable: string) =>
        syllableNames.includes(syllable),
      )
    : new Array();
}

function loadVoices(score: Score): Promise<unknown> {
  return Promise.all(
    [
      ...voiceFiles(score),
      ...lyricNames(score).map(
        (syllable: string) => lyricFolder + syllable + ".wav",
      ),
      ...sampleSounds(score).map((sound: Sound) => sound.file),
    ].map(loadAudio),
  );
}

function heard(score: Score, guarded: boolean): Score {
  return guarded && getSafe() && score.shared && score.lyrics !== ""
    ? { ...score, lyrics: "" }
    : score;
}

function resample(
  samples: Float32Array,
  from: number,
  to: number,
): Float32Array {
  const result: Float32Array = new Float32Array(
    Math.max(Math.floor((samples.length * to) / from), 1),
  );

  for (let index = 0; index < result.length; index++) {
    const position: number = (index * from) / to;
    const before: number = Math.floor(position);
    const first: number = samples[before] ?? 0;
    const second: number = samples[before + 1] ?? first;

    result[index] = first + (second - first) * (position - before);
  }

  return result;
}

function voiceSamples(file: string | null, rate: number): Float32Array | null {
  const buffer: AudioBuffer | null =
    file === null ? null : (buffers.get(file) ?? null);

  if (buffer === null) {
    return null;
  }

  if (buffer.sampleRate === rate) {
    return buffer.getChannelData(0);
  }

  const rates: Map<number, Float32Array> = resampled.get(buffer) ?? new Map();
  const found: Float32Array =
    rates.get(rate) ??
    resample(buffer.getChannelData(0), buffer.sampleRate, rate);

  rates.set(rate, found);
  resampled.set(buffer, rates);

  return found;
}

function scoreSamples(
  score: Score,
  rate: number,
  cache: Map<string, Array<Float32Array<ArrayBuffer>>> = scores,
): Array<Float32Array<ArrayBuffer>> {
  const files: Array<string | null> = voiceFiles(score);
  const voices: Array<Float32Array | null> = files.map((file: string | null) =>
    voiceSamples(file, rate),
  );
  const clips: Map<string, Float32Array> = new Map();

  for (const syllable of lyricNames(score)) {
    const samples: Float32Array | null = voiceSamples(
      lyricFolder + syllable + ".wav",
      rate,
    );

    if (samples !== null) {
      clips.set(syllable, samples);
    }
  }

  const samples: Map<string, Float32Array> = new Map();
  const used: Array<string> = new Array();

  for (const sound of sampleSounds(score)) {
    const found: Float32Array | null =
      sound.source === "file" ? voiceSamples(sound.file, rate) : null;

    if (sound.source === "synth" || found !== null) {
      used.push(
        sound.id +
          "=" +
          (sound.source === "file" ? sound.file : JSON.stringify(sound)),
      );
    }

    if (found !== null) {
      samples.set(sound.id, found);
    }
  }

  const key: string =
    rate +
    ":" +
    JSON.stringify(score) +
    ":" +
    used.join(",") +
    ":" +
    files
      .map((file: string | null, index: number) =>
        voices[index] === null ? "" : file,
      )
      .join(",") +
    ":" +
    [...clips.keys()].join(",");
  const cached: Array<Float32Array<ArrayBuffer>> | undefined = cache.get(key);

  if (cached !== undefined) {
    return cached;
  }

  for (const sound of sampleSounds(score)) {
    if (sound.source === "synth") {
      samples.set(sound.id, synthesize(sound, rate));
    }
  }

  const rendered: Array<Float32Array<ArrayBuffer>> = renderScore(
    score,
    rate,
    voices,
    clips,
    samples,
  );

  remember(key, rendered, cache, cache === scores ? scoreCache : previewCache);

  return rendered;
}

function remember(
  key: string,
  samples: Array<Float32Array<ArrayBuffer>>,
  cache: Map<string, Array<Float32Array<ArrayBuffer>>> = scores,
  limit: number = scoreCache,
): void {
  cache.set(key, samples);

  if (cache.size > limit) {
    cache.delete(cache.keys().next().value!);
  }
}

function ambientSamples(
  sound: Sound,
  rate: number,
): Array<Float32Array<ArrayBuffer>> {
  const key: string = rate + ":ambience:" + JSON.stringify(sound.ambience);
  const cached: Array<Float32Array<ArrayBuffer>> | undefined = scores.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const samples: Array<Float32Array<ArrayBuffer>> = [
    renderAmbience(sound.ambience, rate),
  ];

  remember(key, samples);

  return samples;
}

function scoreBuffer(score: Score): AudioBuffer {
  return samplesBuffer(scoreSamples(score, audio().sampleRate));
}

function samplesBuffer(sides: Array<Float32Array<ArrayBuffer>>): AudioBuffer {
  const buffer: AudioBuffer = audio().createBuffer(
    sides.length,
    sides[0]!.length,
    audio().sampleRate,
  );

  sides.forEach((side: Float32Array<ArrayBuffer>, index: number) => {
    buffer.copyToChannel(side, index);
  });

  return buffer;
}

function bufferOf(sound: Sound): AudioBuffer | null {
  return sound.file === null ? null : (buffers.get(sound.file) ?? null);
}

function start(
  buffer: AudioBuffer,
  volume: number,
  channel: Channel = "sfx",
): AudioBufferSourceNode {
  const source: AudioBufferSourceNode = audio().createBufferSource();
  const gain: GainNode = audio().createGain();

  gain.gain.value = volume * effectiveVolume(channel);
  source.buffer = buffer;
  source.connect(gain).connect(audio().destination);
  source.start();

  return source;
}

function previewNote(score: Score, channel: Instrument, note: Note): void {
  const step: number =
    patchOf(channel.instrument).family === "vocal" ? previewLead : 0;
  const preview: Score = {
    ...score,
    channels: [{ ...channel, mute: false }],
    patterns: [
      {
        id: "preview",
        name: "",
        bars: 1,
        notes: {
          [channel.id]: [
            {
              ...note,
              step: step,
              length: Math.min(note.length, previewSteps),
            },
          ],
        },
      },
    ],
    clips: [{ pattern: "preview", track: 0, step: 0, length: stepsPerBar }],
  };

  void loadVoices(preview).then(() => {
    try {
      if (audio().state === "suspended") {
        void audio().resume();
      }

      notePreview?.stop();
      notePreview = start(
        samplesBuffer(scoreSamples(preview, audio().sampleRate, previews)),
        1,
        "soundtrack",
      );
    } catch {
      console.warn("Could not preview the note");
    }
  });
}

function stopPreview(): void {
  songPreview?.();
  songPreview = null;
}

function playSound(sound: Sound): () => void {
  let source: AudioBufferSourceNode | null = null;
  let stopped: boolean = false;

  function stop(): void {
    stopped = true;
    source?.stop();
  }

  try {
    if (audio().state === "suspended") {
      void audio().resume();
    }

    if (sound.source === "file") {
      void loadAudio(sound.file).then((buffer: AudioBuffer | null) => {
        if (buffer !== null && !stopped) {
          source = start(buffer, sound.volume);
        }
      });
      return stop;
    }

    if (sound.source === "song") {
      stopPreview();
      songPreview = stop;
      void loadVoices(sound.score).then(() => {
        if (!stopped) {
          source = start(scoreBuffer(sound.score), sound.volume, "soundtrack");
        }
      });
      return stop;
    }

    if (sound.source === "ambient") {
      stopPreview();
      songPreview = stop;
      source = start(
        samplesBuffer(ambientSamples(sound, audio().sampleRate)),
        sound.volume,
        "soundtrack",
      );
      return stop;
    }

    const samples: Float32Array<ArrayBuffer> = synthesize(
      sound,
      audio().sampleRate,
    );
    const buffer: AudioBuffer = audio().createBuffer(
      1,
      samples.length,
      audio().sampleRate,
    );

    buffer.copyToChannel(samples, 0);
    source = start(buffer, 1);
  } catch {
    console.warn("Could not play the sound");
  }

  return stop;
}

function playTrack(
  sound: Sound,
  ended: (played: boolean) => void,
  offset: number = 0,
  guarded: boolean = false,
): Track {
  const score: Score = heard(sound.score, guarded);
  let source: AudioBufferSourceNode | null = null;
  let stopped: boolean = false;
  let startedAt: number = 0;

  if (audio().state === "suspended") {
    void audio().resume();
  }

  const ready: Promise<AudioBuffer | null> =
    sound.source === "song"
      ? loadVoices(score).then(() => scoreBuffer(score))
      : sound.source === "ambient"
        ? Promise.resolve(
            samplesBuffer(ambientSamples(sound, audio().sampleRate)),
          )
        : loadAudio(sound.file);

  void ready.then((buffer: AudioBuffer | null) => {
    if (stopped) {
      return;
    }

    if (buffer === null) {
      ended(false);
      return;
    }

    const gain: GainNode = audio().createGain();
    const node: AudioBufferSourceNode = audio().createBufferSource();

    gain.gain.value = sound.volume * effectiveVolume("soundtrack");
    node.buffer = buffer;
    node.connect(gain).connect(audio().destination);
    node.onended = () => {
      if (!stopped) {
        ended(true);
      }
    };

    if (sound.source === "song" || sound.source === "ambient") {
      const length: number = trackLength(sound);
      const begin: number = offset % length;

      node.loop = true;
      startedAt = audio().currentTime - begin;
      node.start(0, begin % buffer.duration);
      node.stop(audio().currentTime + length - begin);
      source = node;
      return;
    }

    startedAt = audio().currentTime - (offset % buffer.duration);
    node.start(0, offset % buffer.duration);
    source = node;
  });

  return {
    stop: () => {
      stopped = true;
      source?.stop();
    },
    position: () =>
      source === null ? offset : audio().currentTime - startedAt,
  };
}

function drawSound(
  graphics: Graphics,
  sound: Sound,
  width: number,
  height: number,
  color: string,
): void {
  const buffer: AudioBuffer | null = bufferOf(sound);
  const samples: Float32Array =
    sound.source === "synth"
      ? synthesize(sound, drawRate)
      : sound.source === "song"
        ? scoreSamples(sound.score, drawRate)[0]!
        : sound.source === "ambient"
          ? ambientSamples(sound, drawRate)[0]!
          : (buffer?.getChannelData(0) ?? new Float32Array(1));
  const scale: number = sound.source === "synth" ? 1 : sound.volume;
  const columns: number = Math.max(Math.floor(width / 2), 1);
  const stride: number = Math.max(
    Math.floor(samples.length / columns / drawDetail),
    1,
  );

  graphics.clear();
  graphics
    .moveTo(0, height / 2)
    .lineTo(width, height / 2)
    .stroke({ color: color, width: 1, alpha: 0.3 });

  for (let column = 0; column < columns; column++) {
    const start: number = Math.floor((column / columns) * samples.length);
    const end: number = Math.max(
      Math.floor(((column + 1) / columns) * samples.length),
      start + 1,
    );
    let low: number = 0;
    let high: number = 0;

    for (
      let index = start;
      index < end && index < samples.length;
      index += stride
    ) {
      low = Math.min(low, samples[index]! * scale);
      high = Math.max(high, samples[index]! * scale);
    }

    const x: number = (column + 0.5) * (width / columns);

    graphics
      .moveTo(x, height / 2 - (high * height) / 2)
      .lineTo(x, height / 2 - (low * height) / 2 + 0.5);
  }

  graphics.stroke({ color: color, width: 1 });
}

export {
  isMusic,
  canPlay,
  soundLength,
  loadAudio,
  importAudio,
  playSound,
  stopPreview,
  useSounds,
  playTrack,
  previewNote,
  sampleChoices,
  drawSound,
};
export type { Track };
