import type { Ambience } from "./types";

type Filter = {
  low: number;
  band: number;
  high: number;
  tune: (cutoff: number, resonance: number) => void;
  step: (input: number) => void;
};

type Drop = {
  phase: number;
  step: number;
  level: number;
  fade: number;
};

type Preset = {
  name: string;
  levels: Array<number>;
};

type Layer = (
  target: Float32Array,
  ambience: Ambience,
  random: () => number,
  rate: number,
) => void;

const ambientLayers: Array<string> = [
  "Wind",
  "Rain",
  "Ocean",
  "Stream",
  "Fire",
  "Crickets",
  "Birds",
  "Thunder",
  "Seagulls",
];
const ambientPresets: Array<Preset> = [
  { name: "Breezy plain", levels: [0.8, 0, 0, 0, 0, 0, 0.15, 0, 0] },
  { name: "Seaside", levels: [0.3, 0, 0.9, 0, 0, 0, 0, 0, 0.45] },
  { name: "Rainstorm", levels: [0.4, 0.9, 0, 0, 0, 0, 0, 0.7, 0] },
  { name: "Campfire", levels: [0.15, 0, 0, 0, 0.8, 0.6, 0, 0, 0] },
  { name: "Forest", levels: [0.25, 0, 0, 0.3, 0, 0, 0.7, 0, 0] },
  { name: "Creek", levels: [0, 0, 0, 0.9, 0, 0, 0.3, 0, 0] },
  { name: "Summer night", levels: [0.1, 0, 0, 0, 0, 0.9, 0, 0, 0] },
];
const ambientLengthMin: number = 4; // s
const ambientLengthMax: number = 30; // s
const defaultLength: number = 12; // s
const crossfade: number = 1.5; // s
const tuneEvery: number = 32; // samples
const toneRange: number = 3; // octaves
const layerPeaks: Array<number> = [
  0.5, 0.4, 0.6, 0.45, 0.5, 0.22, 0.3, 0.8, 0.35,
];
const ambientDrive: number = 1.2;
const ambientLevel: number = 0.85;
const rainDrops: number = 60; // per s
const dropMost: number = 48;
const streamVoices: number = 3;
const firePops: number = 6; // per s
const cricketVoices: number = 3;
const birdGap: number = 2.2; // s
const thunderSpacing: number = 14; // s
const gullGap: number = 3.5; // s
const gullRise: number = 0.3;

function toneOf(ambience: Ambience): number {
  return 2 ** ((ambience.brightness - 0.5) * toneRange);
}

function createRandom(seed: number): () => number {
  let state: number = Math.imul(seed, 2654435761) >>> 0 || 1;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createPink(random: () => number): () => number {
  let first: number = 0;
  let second: number = 0;
  let third: number = 0;

  return () => {
    const white: number = random() * 2 - 1;

    first = 0.99765 * first + white * 0.099046;
    second = 0.963 * second + white * 0.2965164;
    third = 0.57 * third + white * 1.0526913;

    return (first + second + third + white * 0.1848) * 0.25;
  };
}

function createBrown(random: () => number): () => number {
  let value: number = 0;

  return () => {
    value = (value + 0.02 * (random() * 2 - 1)) / 1.02;
    return value * 3.5;
  };
}

function createDrift(
  random: () => number,
  speed: number,
  rate: number,
): () => number {
  const span: number = Math.max(Math.round(rate / speed), 1);
  let from: number = random();
  let to: number = random();
  let count: number = Math.floor(random() * span);

  return () => {
    if (count >= span) {
      count = 0;
      from = to;
      to = random();
    }

    const amount: number = count / span;

    count++;

    return from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * amount));
  };
}

function createFilter(rate: number): Filter {
  let first: number = 0;
  let second: number = 0;
  let third: number = 0;
  let damping: number = 1;
  let band: number = 0;
  let low: number = 0;
  const filter: Filter = {
    low: 0,
    band: 0,
    high: 0,
    tune: (cutoff: number, resonance: number) => {
      const warp: number = Math.tan(
        (Math.PI * Math.min(Math.max(cutoff, 10), rate * 0.45)) / rate,
      );

      damping = 1 / resonance;
      first = 1 / (1 + warp * (warp + damping));
      second = warp * first;
      third = warp * second;
    },
    step: (input: number) => {
      const rest: number = input - low;
      const nextBand: number = first * band + second * rest;
      const nextLow: number = low + second * band + third * rest;

      band = 2 * nextBand - band;
      low = 2 * nextLow - low;
      filter.low = nextLow;
      filter.band = nextBand;
      filter.high = input - damping * nextBand - nextLow;
    },
  };

  filter.tune(1000, 0.7);

  return filter;
}

function wind(
  target: Float32Array,
  ambience: Ambience,
  random: () => number,
  rate: number,
): void {
  const tone: number = toneOf(ambience);
  const pink: () => number = createPink(random);
  const gust: () => number = createDrift(
    random,
    0.12 + ambience.motion * 0.4,
    rate,
  );
  const swirl: () => number = createDrift(
    random,
    0.25 + ambience.motion * 0.8,
    rate,
  );
  const body: Filter = createFilter(rate);
  const whistle: Filter = createFilter(rate);

  for (let index = 0; index < target.length; index++) {
    const strength: number = gust();
    const turn: number = swirl();
    const input: number = pink();

    if (index % tuneEvery === 0) {
      body.tune(
        tone * (220 + 700 * strength * ambience.motion + 300 * turn),
        0.9,
      );
      whistle.tune(tone * (500 + 1500 * turn), 9);
    }

    body.step(input);
    whistle.step(input);
    target[index]! +=
      (body.band + whistle.band * 0.35 * strength) *
      (1 - ambience.motion * 0.7 + ambience.motion * 0.7 * strength);
  }
}

function rain(
  target: Float32Array,
  ambience: Ambience,
  random: () => number,
  rate: number,
): void {
  const tone: number = toneOf(ambience);
  const pink: () => number = createPink(random);
  const swell: () => number = createDrift(
    random,
    0.1 + ambience.motion * 0.4,
    rate,
  );
  const hiss: Filter = createFilter(rate);
  const drops: Array<Drop> = new Array();

  hiss.tune(tone * 1800, 0.7);

  for (let index = 0; index < target.length; index++) {
    const amount: number =
      1 - ambience.motion * 0.6 + ambience.motion * 0.6 * swell();
    let sample: number = 0;

    hiss.step(pink());
    sample = hiss.high * amount;

    if (random() < (rainDrops / rate) * amount && drops.length < dropMost) {
      drops.push({
        phase: 0,
        step: (tone * (1800 + 3500 * random())) / rate,
        level: 0.15 + 0.85 * random() ** 2,
        fade: Math.exp(-1 / ((0.002 + 0.006 * random()) * rate)),
      });
    }

    for (let drop = drops.length - 1; drop >= 0; drop--) {
      const current: Drop = drops[drop]!;

      sample += Math.sin(Math.PI * 2 * current.phase) * current.level * 0.25;
      current.phase += current.step;
      current.level *= current.fade;

      if (current.level < 0.001) {
        drops.splice(drop, 1);
      }
    }

    target[index]! += sample;
  }
}

function ocean(
  target: Float32Array,
  ambience: Ambience,
  random: () => number,
  rate: number,
): void {
  const tone: number = toneOf(ambience);
  const pink: () => number = createPink(random);
  const brown: () => number = createBrown(random);
  const surf: Filter = createFilter(rate);
  const foam: Filter = createFilter(rate);
  let period: number = wavePeriod(ambience, random);
  let waveAt: number = random() * period;
  let strength: number = 0.6 + 0.4 * random();

  foam.tune(tone * 2500, 0.7);

  for (let index = 0; index < target.length; index++) {
    waveAt += 1 / rate;

    if (waveAt >= period) {
      waveAt -= period;
      period = wavePeriod(ambience, random);
      strength = 0.6 + 0.4 * random();
    }

    const rise: number = period * 0.35;
    const swell: number =
      waveAt < rise
        ? Math.sin(((Math.PI / 2) * waveAt) / rise) ** 2
        : Math.exp(-(waveAt - rise) / (period * 0.22));

    if (index % tuneEvery === 0) {
      surf.tune(tone * (150 + 1400 * swell), 0.7);
    }

    surf.step(brown() * 0.5 + pink() * 0.5);
    foam.step(pink());
    target[index]! +=
      (surf.low * (0.12 + 0.88 * swell) + foam.high * swell ** 3 * 0.6) *
      strength;
  }
}

function wavePeriod(ambience: Ambience, random: () => number): number {
  return 7 * (1 + (random() - 0.5) * (0.2 + ambience.motion * 0.8));
}

function stream(
  target: Float32Array,
  ambience: Ambience,
  random: () => number,
  rate: number,
): void {
  const tone: number = toneOf(ambience);
  const pink: () => number = createPink(random);
  const flow: () => number = createDrift(random, 1.5, rate);
  const glide: number = 1 - Math.exp(-1 / (0.015 * rate));
  const filters: Array<Filter> = new Array();
  const cutoffs: Array<number> = new Array();
  const goals: Array<number> = new Array();
  const timers: Array<number> = new Array();

  for (let voice = 0; voice < streamVoices; voice++) {
    filters.push(createFilter(rate));
    cutoffs.push(tone * (350 + 1800 * random()));
    goals.push(cutoffs[voice]!);
    timers.push(0);
  }

  for (let index = 0; index < target.length; index++) {
    const input: number = pink();
    let sample: number = 0;

    for (let voice = 0; voice < streamVoices; voice++) {
      const filter: Filter = filters[voice]!;

      if (timers[voice]! <= 0) {
        goals[voice] = tone * (350 + 1800 * random());
        timers[voice] =
          (0.03 + 0.09 * random()) * rate * (1.3 - ambience.motion * 0.6);
      }

      timers[voice]!--;
      cutoffs[voice]! += (goals[voice]! - cutoffs[voice]!) * glide;

      if (index % tuneEvery === 0) {
        filter.tune(cutoffs[voice]!, 7);
      }

      filter.step(input);
      sample += filter.band;
    }

    target[index]! += sample * (0.6 + 0.4 * flow());
  }
}

function fire(
  target: Float32Array,
  ambience: Ambience,
  random: () => number,
  rate: number,
): void {
  const tone: number = toneOf(ambience);
  const brown: () => number = createBrown(random);
  const flicker: () => number = createDrift(random, 4, rate);
  const bed: Filter = createFilter(rate);
  const crack: Filter = createFilter(rate);
  const chance: number = (firePops * (0.5 + ambience.motion)) / rate;
  let pop: number = 0;
  let fade: number = 0;
  let burst: number = 0;
  let wait: number = 0;

  bed.tune(tone * 350, 0.7);
  crack.tune(tone * 1200, 0.7);

  for (let index = 0; index < target.length; index++) {
    if (random() < chance) {
      burst = random() < 0.3 ? 3 + Math.floor(random() * 6) : 1;
      wait = 0;
    }

    if (burst > 0 && wait <= 0) {
      burst--;
      wait = random() * 0.012 * rate;
      pop = Math.max(pop, random() ** 3);
      fade = Math.exp(-1 / ((0.0008 + 0.003 * random()) * rate));
    }

    wait--;
    bed.step(brown());
    crack.step((random() * 2 - 1) * pop);
    pop *= fade;
    target[index]! += bed.low * (0.5 + 0.5 * flicker()) * 0.6 + crack.high;
  }
}

function crickets(
  target: Float32Array,
  ambience: Ambience,
  random: () => number,
  rate: number,
): void {
  const tone: number = toneOf(ambience);

  for (let voice = 0; voice < cricketVoices; voice++) {
    const pitch: number = tone * (3600 + 1400 * random());
    const period: number = 0.55 + 0.5 * random();
    const pulses: number = 2 + Math.floor(random() * 3);
    const pulseRate: number = 25 + 15 * random();
    const level: number = 0.5 + 0.5 * random();
    const span: number = Math.round((pulses / pulseRate) * rate);

    for (
      let start = random() * period * rate;
      start < target.length;
      start += period * rate * (1 + (random() - 0.5) * ambience.motion * 0.8)
    ) {
      const first: number = Math.floor(start);

      for (
        let offset = 0;
        offset < span && first + offset < target.length;
        offset++
      ) {
        const time: number = offset / rate;
        const pulse: number = Math.sin(Math.PI * ((time * pulseRate) % 1)) ** 2;

        target[first + offset]! +=
          Math.sin(Math.PI * 2 * pitch * time) * pulse * level;
      }
    }
  }
}

function birds(
  target: Float32Array,
  ambience: Ambience,
  random: () => number,
  rate: number,
): void {
  const tone: number = toneOf(ambience);
  let at: number = random() * birdGap * rate;

  while (at < target.length) {
    const notes: number = 2 + Math.floor(random() * 4);
    const base: number = tone * (2400 + 2200 * random());
    const trill: boolean = random() < 0.5;

    for (let note = 0; note < notes; note++) {
      const length: number = Math.round(
        (trill ? 0.04 : 0.09 + 0.08 * random()) * rate,
      );
      const from: number = base * (0.85 + 0.3 * random());
      const to: number = from * (trill ? 1.3 : 0.6 + 0.9 * random());
      const level: number = 0.5 + 0.5 * random();
      const first: number = Math.floor(at);
      let phase: number = 0;

      for (
        let offset = 0;
        offset < length && first + offset < target.length;
        offset++
      ) {
        const amount: number = offset / length;
        const wobble: number =
          1 + 0.04 * Math.sin((Math.PI * 2 * 45 * offset) / rate);

        phase += ((from + (to - from) * amount) * wobble) / rate;
        target[first + offset]! +=
          Math.sin(Math.PI * 2 * phase) *
          Math.sin(Math.PI * amount) ** 2 *
          level;
      }

      at += length + (0.03 + 0.06 * random()) * rate;
    }

    at +=
      birdGap * (0.4 + 1.2 * random()) * (1.3 - ambience.motion * 0.6) * rate;
  }
}

function thunder(
  target: Float32Array,
  ambience: Ambience,
  random: () => number,
  rate: number,
): void {
  const tone: number = toneOf(ambience);
  const strikes: number = Math.max(
    Math.round(
      (target.length / rate / thunderSpacing) * (0.5 + ambience.motion),
    ),
    1,
  );

  for (let strike = 0; strike < strikes; strike++) {
    const first: number = Math.floor(random() * 0.75 * target.length);
    const duration: number = 3 + 4 * random(); // s
    const brown: () => number = createBrown(random);
    const roll: () => number = createDrift(random, 3 + 3 * random(), rate);
    const rumble: Filter = createFilter(rate);
    const crack: Filter = createFilter(rate);

    rumble.tune(tone * (120 + 160 * random()), 0.8);
    crack.tune(tone * 900, 0.7);

    for (
      let offset = 0;
      offset < duration * rate && first + offset < target.length;
      offset++
    ) {
      const time: number = offset / rate;
      const swell: number =
        Math.min(time / 0.25, 1) * Math.exp(-time / (duration * 0.35));

      rumble.step(brown());
      crack.step(random() * 2 - 1);
      target[first + offset]! +=
        rumble.low * swell * (0.4 + 0.6 * roll()) +
        crack.high * Math.exp(-time / 0.05) * 0.5;
    }
  }
}

function seagulls(
  target: Float32Array,
  ambience: Ambience,
  random: () => number,
  rate: number,
): void {
  const tone: number = toneOf(ambience);
  const formant: Filter = createFilter(rate);
  let at: number = random() * gullGap * rate;

  while (at < target.length) {
    const notes: number = random() < 0.4 ? 1 : 3 + Math.floor(random() * 6);
    const base: number = tone * (650 + 350 * random());
    const level: number = 0.3 + 0.7 * random();
    let spacing: number = 0.28 + 0.1 * random(); // s

    for (let note = 0; note < notes; note++) {
      const length: number = Math.round(
        (notes === 1 ? 0.4 + 0.15 * random() : 0.16 + 0.08 * random()) * rate,
      );
      const from: number = base * 0.85;
      const peak: number = base * (1.1 + 0.25 * random());
      const end: number = base * 0.7;
      const first: number = Math.floor(at);
      let phase: number = 0;

      formant.tune(tone * (1800 + 600 * random()), 2.5);

      for (
        let offset = 0;
        offset < length && first + offset < target.length;
        offset++
      ) {
        const amount: number = offset / length;
        const pitch: number =
          amount < gullRise
            ? from + ((peak - from) * amount) / gullRise
            : peak + ((end - peak) * (amount - gullRise)) / (1 - gullRise);

        phase += (pitch * (1 + 0.03 * (random() * 2 - 1))) / rate;

        const angle: number = Math.PI * 2 * phase;
        const wave: number =
          Math.sin(angle) +
          0.6 * Math.sin(angle * 2) +
          0.45 * Math.sin(angle * 3) +
          0.3 * Math.sin(angle * 4);

        formant.step(wave);
        target[first + offset]! +=
          (formant.band * 0.7 + wave * 0.15) *
          Math.min(amount / 0.08, 1) *
          (1 - amount) ** 0.6 *
          level;
      }

      at += notes === 1 ? length : spacing * rate;
      spacing *= 0.88;
    }

    at +=
      gullGap * (0.5 + 1.5 * random()) * (1.3 - ambience.motion * 0.6) * rate;
  }
}

const layers: Array<Layer> = [
  wind,
  rain,
  ocean,
  stream,
  fire,
  crickets,
  birds,
  thunder,
  seagulls,
];

function renderAmbience(
  ambience: Ambience,
  rate: number,
): Float32Array<ArrayBuffer> {
  const length: number = Math.max(Math.round(ambience.length * rate), 1);
  const fade: number = Math.min(
    Math.round(crossfade * rate),
    Math.floor(length / 2),
  );
  const mix: Float32Array = new Float32Array(length + fade);
  const layer: Float32Array = new Float32Array(length + fade);
  const result: Float32Array<ArrayBuffer> = new Float32Array(length);

  for (let index = 0; index < layers.length; index++) {
    const level: number = ambience.levels[index] ?? 0;
    let peak: number = 0;

    if (level <= 0) {
      continue;
    }

    layer.fill(0);
    layers[index]!(
      layer,
      ambience,
      createRandom(ambience.seed * layers.length + index + 1),
      rate,
    );

    for (const value of layer) {
      peak = Math.max(peak, Math.abs(value));
    }

    if (peak === 0) {
      continue;
    }

    const gain: number = (layerPeaks[index]! * level) / peak;

    for (let sample = 0; sample < mix.length; sample++) {
      mix[sample]! += layer[sample]! * gain;
    }
  }

  for (let index = 0; index < length; index++) {
    const value: number =
      index < fade
        ? mix[index]! * Math.sqrt(index / fade) +
          mix[length + index]! * Math.sqrt(1 - index / fade)
        : mix[index]!;

    result[index] = Math.tanh(value * ambientDrive) * ambientLevel;
  }

  return result;
}

function defaultAmbience(): Ambience {
  return {
    levels: [...ambientPresets[1]!.levels],
    brightness: 0.5,
    motion: 0.5,
    length: defaultLength,
    seed: 1,
  };
}

function repairAmbience(value: Ambience | undefined): Ambience {
  const fallback: Ambience = defaultAmbience();

  if (value === undefined) {
    return fallback;
  }

  return {
    levels: ambientLayers.map(
      (_: string, index: number) => value.levels?.[index] ?? 0,
    ),
    brightness: value.brightness ?? fallback.brightness,
    motion: value.motion ?? fallback.motion,
    length: Math.min(
      Math.max(value.length ?? fallback.length, ambientLengthMin),
      ambientLengthMax,
    ),
    seed: value.seed ?? fallback.seed,
  };
}

export {
  ambientLayers,
  ambientPresets,
  ambientLengthMin,
  ambientLengthMax,
  renderAmbience,
  defaultAmbience,
  repairAmbience,
};
export type { Preset };
