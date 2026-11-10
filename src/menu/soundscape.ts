import type { Creations, Sound } from "../create/types";
import { loadBuiltinSounds, loadSoundCard } from "../create/builtin";
import { audioContext, soundBuffer } from "../create/sound";
import { loadCreations, onSave, useLockedSounds } from "../create/storage";
import {
  defaultMenuSound,
  effectiveVolume,
  getMenuSound,
  menuSlots,
  onMenuSound,
  onVolume,
  type MenuSlot,
} from "../settings/settings";

type Mix = {
  intro: number;
  portal: number;
  rain: number;
  music: number;
  depth: number;
  level: number;
};

type Soundscape = {
  start: () => void;
  set: (mix: Mix) => void;
};

type Layer = {
  slot: MenuSlot;
  restart: boolean;
  key: string;
  sound: Sound | null;
  buffer: AudioBuffer | null;
  source: AudioBufferSourceNode | null;
  gain: GainNode | null;
  token: number;
  loudness: number;
  rest: number | null;
};

const blend: number = 0.6; // s
const openFilter: number = 20000; // Hz
const deepFilter: number = 320; // Hz
const deepLevel: number = 0.6;
const settle: number = 0.001;
const swellTime: number = 5; // s
const swellStart: number = 0.2;
const loudnessStride: number = 64;
const restTime: number = 60; // s
const breathTime: number = 6; // s
const breathSteps: number = 32;

function breathCurve(rising: boolean): Float32Array {
  const curve: Float32Array = new Float32Array(breathSteps);

  for (let index = 0; index < breathSteps; index++) {
    const progress: number = index / (breathSteps - 1);
    const eased: number = progress * progress * (3 - 2 * progress);

    curve[index] = rising ? eased : 1 - eased;
  }

  return curve;
}

function loudnessOf(buffer: AudioBuffer): number {
  let total: number = 0;
  let count: number = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data: Float32Array = buffer.getChannelData(channel);

    for (let index = 0; index < data.length; index += loudnessStride) {
      total += data[index]! * data[index]!;
      count++;
    }
  }

  return count === 0 ? 0 : Math.sqrt(total / count);
}

function loadMenuSound(name: string): Promise<Sound | null> {
  return loadSoundCard("menu/" + name.replace(".geregnet.json", ""));
}

function menuSoundOf(creations: Creations, slot: MenuSlot): Sound | null {
  const id: string | null = getMenuSound(slot);

  if (id === null) {
    return null;
  }

  return (
    creations.sounds.find((sound: Sound) => sound.id === id) ??
    creations.sounds.find(
      (sound: Sound) => sound.id === defaultMenuSound(slot),
    ) ??
    null
  );
}

async function createSoundscape(): Promise<Soundscape> {
  useLockedSounds(await loadBuiltinSounds());

  const layers: Array<Layer> = menuSlots.map((slot: MenuSlot) => ({
    slot: slot,
    restart: slot === "music",
    key: "",
    sound: null,
    buffer: null,
    source: null,
    gain: null,
    token: 0,
    loudness: 0,
    rest: null,
  }));
  const shown: Mix = {
    intro: -1,
    portal: -1,
    rain: -1,
    music: -1,
    depth: -1,
    level: -1,
  };
  let wanted: Mix = {
    intro: 0,
    portal: 0,
    rain: 0,
    music: 0,
    depth: 0,
    level: 0,
  };
  let master: GainNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let swell: GainNode | null = null;
  let breath: GainNode | null = null;
  let swelled: boolean = false;

  function layerOf(slot: MenuSlot): Layer {
    return layers.find((layer: Layer) => layer.slot === slot)!;
  }

  function levelOf(layer: Layer): number {
    const rain: Layer = layerOf("rain");

    if (
      layer.slot === "intro" &&
      layer.loudness > 0 &&
      rain.loudness > 0 &&
      rain.sound !== null
    ) {
      return (
        (wanted.intro * rain.sound.volume * rain.loudness) / layer.loudness
      );
    }

    return wanted[layer.slot] * (layer.sound?.volume ?? 0);
  }

  function matchIntro(): void {
    const intro: Layer = layerOf("intro");

    if (intro.source !== null && intro.gain !== null) {
      glide(intro.gain.gain, levelOf(intro));
    }
  }

  function glide(param: AudioParam, value: number): void {
    param.setTargetAtTime(value, audioContext().currentTime, blend / 3);
  }

  function rest(layer: Layer): void {
    layer.rest = window.setTimeout(() => {
      layer.rest = null;

      if (wanted[layer.slot] > settle && layer.source === null) {
        begin(layer, true);
      }
    }, restTime * 1000);
  }

  function breathe(buffer: AudioBuffer, replay: boolean): void {
    if (breath === null) {
      return;
    }

    const now: number = audioContext().currentTime;
    const ease: number = Math.min(breathTime, buffer.duration / 3);

    breath.gain.cancelScheduledValues(now);

    if (replay) {
      breath.gain.setValueCurveAtTime(breathCurve(true), now, ease);
    } else {
      breath.gain.setValueAtTime(1, now);
    }

    breath.gain.setValueCurveAtTime(
      breathCurve(false),
      now + buffer.duration - ease,
      ease,
    );
  }

  function begin(layer: Layer, replay: boolean = false): void {
    if (layer.buffer === null || layer.gain === null || layer.rest !== null) {
      return;
    }

    const context: AudioContext = audioContext();
    const source: AudioBufferSourceNode = context.createBufferSource();
    const resting: boolean = layer.slot === "music";

    layer.source?.stop();
    layer.gain.gain.cancelScheduledValues(context.currentTime);
    layer.gain.gain.setValueAtTime(0, context.currentTime);
    source.buffer = layer.buffer;
    source.loop = !resting;
    source.connect(layer.gain);
    source.start();
    layer.source = source;

    if (resting) {
      breathe(layer.buffer, replay);
      source.onended = () => {
        if (layer.source === source) {
          layer.source = null;
          rest(layer);
        }
      };
    }

    if (layer.slot === "music" && swell !== null && !swelled) {
      swelled = true;
      swell.gain.cancelScheduledValues(context.currentTime);
      swell.gain.setValueAtTime(swellStart, context.currentTime);
      swell.gain.exponentialRampToValueAtTime(
        1,
        context.currentTime + swellTime,
      );
    }

    glide(layer.gain.gain, levelOf(layer));
  }

  function fade(layer: Layer): void {
    if (layer.source === null || layer.gain === null) {
      return;
    }

    glide(layer.gain.gain, 0);
    layer.source.stop(audioContext().currentTime + blend * 2);
    layer.source = null;
  }

  function load(layer: Layer): void {
    const token: number = ++layer.token;
    const sound: Sound | null = layer.sound;

    layer.buffer = null;
    layer.loudness = 0;
    fade(layer);

    if (layer.rest !== null) {
      window.clearTimeout(layer.rest);
      layer.rest = null;
    }

    if (sound === null || master === null) {
      return;
    }

    void soundBuffer(sound, true).then((buffer: AudioBuffer | null) => {
      if (token !== layer.token || buffer === null) {
        return;
      }

      layer.buffer = buffer;
      layer.loudness = loudnessOf(buffer);

      if (!layer.restart || wanted[layer.slot] > settle) {
        begin(layer);
      }

      if (layer.slot === "rain") {
        matchIntro();
      }
    });
  }

  function choose(layer: Layer, sound: Sound | null): void {
    const key: string = sound === null ? "" : JSON.stringify(sound);

    if (key === layer.key) {
      return;
    }

    layer.key = key;
    layer.sound = sound;
    load(layer);
  }

  function chooseAll(creations: Creations): void {
    for (const layer of layers) {
      choose(layer, menuSoundOf(creations, layer.slot));
    }
  }

  function apply(): void {
    if (master === null || filter === null) {
      return;
    }

    for (const layer of layers) {
      if (Math.abs(shown[layer.slot] - wanted[layer.slot]) <= settle) {
        continue;
      }

      if (!layer.restart) {
        glide(layer.gain!.gain, levelOf(layer));
      } else if (wanted[layer.slot] <= settle) {
        fade(layer);
      } else if (layer.source === null) {
        begin(layer);
      } else {
        glide(layer.gain!.gain, levelOf(layer));
      }
    }

    if (Math.abs(shown.depth - wanted.depth) > settle) {
      glide(
        filter.frequency,
        openFilter * (deepFilter / openFilter) ** wanted.depth,
      );
    }

    glide(
      master.gain,
      wanted.level *
        (1 - (1 - deepLevel) * wanted.depth) *
        effectiveVolume("soundtrack"),
    );
    Object.assign(shown, wanted);
  }

  function start(): void {
    const context: AudioContext = audioContext();

    if (context.state === "suspended") {
      void context.resume();
    }

    if (master !== null) {
      return;
    }

    master = context.createGain();
    filter = context.createBiquadFilter();
    master.gain.value = 0;
    filter.type = "lowpass";
    filter.frequency.value = openFilter;
    filter.connect(master).connect(context.destination);
    swell = context.createGain();
    swell.gain.value = swellStart;
    swell.connect(filter);
    breath = context.createGain();
    breath.gain.value = 1;
    breath.connect(swell);

    for (const layer of layers) {
      layer.gain = context.createGain();
      layer.gain.gain.value = 0;
      layer.gain.connect(layer.slot === "music" ? breath : filter);
      load(layer);
    }

    apply();
  }

  function set(mix: Mix): void {
    const changed: boolean =
      menuSlots.some(
        (slot: MenuSlot) => Math.abs(mix[slot] - wanted[slot]) > settle,
      ) ||
      Math.abs(mix.depth - wanted.depth) > settle ||
      Math.abs(mix.level - wanted.level) > settle;

    wanted = { ...mix };

    if (changed) {
      apply();
    }
  }

  chooseAll(loadCreations());
  onSave(chooseAll);
  onMenuSound(() => chooseAll(loadCreations()));
  onVolume(() => {
    shown.level = -1;
    apply();
  });

  for (const name of ["pointerdown", "keydown"]) {
    window.addEventListener(name, () => {
      if (master !== null && audioContext().state === "suspended") {
        void audioContext().resume();
      }
    });
  }

  return { start: start, set: set };
}

export { createSoundscape, loadMenuSound, menuSoundOf };
export type { Soundscape, Mix };
