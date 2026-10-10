import type { Graphics } from "pixi.js";
import type { Sound } from "./data";
import { effectiveVolume } from "../settings/settings";
import { readBlob, storeBlob } from "./images";

const drawRate: number = 11025; // Hz
const drawDetail: number = 256;
const noiseSeed: number = 12345;
const buffers: Map<string, AudioBuffer> = new Map();
const loading: Map<string, Promise<AudioBuffer | null>> = new Map();
let context: AudioContext | null = null;

function soundLength(sound: Sound): number {
  return sound.source === "file"
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

function bufferOf(sound: Sound): AudioBuffer | null {
  return sound.file === null ? null : (buffers.get(sound.file) ?? null);
}

function start(buffer: AudioBuffer, volume: number): void {
  const source: AudioBufferSourceNode = audio().createBufferSource();
  const gain: GainNode = audio().createGain();

  gain.gain.value = volume * effectiveVolume("sfx");
  source.buffer = buffer;
  source.connect(gain).connect(audio().destination);
  source.start();
}

function playSound(sound: Sound): void {
  try {
    if (audio().state === "suspended") {
      void audio().resume();
    }

    if (sound.source === "file") {
      void loadAudio(sound.file).then((buffer: AudioBuffer | null) => {
        if (buffer !== null) {
          start(buffer, sound.volume);
        }
      });
      return;
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
    start(buffer, 1);
  } catch {
    console.warn("Could not play the sound");
  }
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
    sound.source === "file"
      ? (buffer?.getChannelData(0) ?? new Float32Array(1))
      : synthesize(sound, drawRate);
  const scale: number = sound.source === "file" ? sound.volume : 1;
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

export { soundLength, loadAudio, importAudio, playSound, drawSound };
