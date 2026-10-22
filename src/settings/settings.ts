type Channel = "master" | "soundtrack" | "sfx" | "dialogue";

type VolumeListener = (channel: Channel, volume: number) => void;

type RateListener = (rate: number) => void;

type CrtListener = (on: boolean) => void;

type ResolutionListener = (lines: number) => void;

type TvListener = (on: boolean) => void;

type Tuning =
  "curvature" | "vignette" | "scanlines" | "fringe" | "glow" | "flicker";

type TuningListener = (tuning: Tuning, value: number) => void;

const channels: Array<Channel> = ["master", "soundtrack", "sfx", "dialogue"];
const volumeStorageKey: string = "geregnet.volume";
const defaultVolume: number = 0.8;
const volumeListeners: Array<VolumeListener> = new Array();
const volumes: Map<Channel, number> = loadVolumes();
const rates: Array<number> = [30, 60, 120, 144, 240]; // Hz
const rateStorageKey: string = "geregnet.framerate";
const defaultRate: number = 60; // Hz
const rateListeners: Array<RateListener> = new Array();
let rate: number = loadRate();
const crtStorageKey: string = "geregnet.crt";
const crtListeners: Array<CrtListener> = new Array();
let crt: boolean = loadCrt();

function loadCrt(): boolean {
  try {
    return localStorage.getItem(crtStorageKey) !== "off";
  } catch {
    return true;
  }
}

function getCrt(): boolean {
  return crt;
}

function setCrt(value: boolean): void {
  if (value === crt) {
    return;
  }

  crt = value;

  try {
    localStorage.setItem(crtStorageKey, value ? "on" : "off");
  } catch {
    console.warn("Could not save the CRT setting");
  }

  for (const listener of crtListeners) {
    listener(value);
  }
}

function onCrt(listener: CrtListener): void {
  crtListeners.push(listener);
  listener(crt);
}

const tunings: Array<Tuning> = [
  "curvature",
  "vignette",
  "scanlines",
  "fringe",
  "glow",
  "flicker",
];
const tuningStorageKey: string = "geregnet.tvshape";
const tuningDefaults: Map<Tuning, number> = new Map([
  ["curvature", 0.4],
  ["vignette", 0.3],
  ["scanlines", 0.47],
  ["fringe", 0.4],
  ["glow", 0.35],
  ["flicker", 0.1],
]);
const tuningListeners: Array<TuningListener> = new Array();
const tuningValues: Map<Tuning, number> = loadTunings();

function loadTunings(): Map<Tuning, number> {
  const loaded: Map<Tuning, number> = new Map();
  let saved: Record<string, unknown> = {};

  try {
    saved = JSON.parse(localStorage.getItem(tuningStorageKey) ?? "{}");
  } catch {
    saved = {};
  }

  for (const tuning of tunings) {
    const value: unknown = saved[tuning];

    loaded.set(
      tuning,
      typeof value === "number" && value >= 0 && value <= 1
        ? value
        : tuningDefaults.get(tuning)!,
    );
  }

  return loaded;
}

function getTuning(tuning: Tuning): number {
  return tuningValues.get(tuning)!;
}

function setTuning(tuning: Tuning, value: number): void {
  const clamped: number =
    Math.round(Math.min(Math.max(value, 0), 1) * 100) / 100;

  if (clamped === tuningValues.get(tuning)) {
    return;
  }

  tuningValues.set(tuning, clamped);

  try {
    localStorage.setItem(
      tuningStorageKey,
      JSON.stringify(Object.fromEntries(tuningValues)),
    );
  } catch {
    console.warn("Could not save the screen effect settings");
  }

  for (const listener of tuningListeners) {
    listener(tuning, clamped);
  }
}

function onTuning(listener: TuningListener): void {
  tuningListeners.push(listener);

  for (const tuning of tunings) {
    listener(tuning, tuningValues.get(tuning)!);
  }
}

const resolutions: Array<number> = [0, 720, 1080, 1440, 2160]; // px
const resolutionStorageKey: string = "geregnet.resolution";
const resolutionListeners: Array<ResolutionListener> = new Array();
let resolution: number = loadResolution();

function loadResolution(): number {
  try {
    const saved: number = Number(localStorage.getItem(resolutionStorageKey));

    return resolutions.includes(saved) ? saved : 0;
  } catch {
    return 0;
  }
}

function getResolution(): number {
  return resolution;
}

function setResolution(value: number): void {
  if (value === resolution || !resolutions.includes(value)) {
    return;
  }

  resolution = value;

  try {
    localStorage.setItem(resolutionStorageKey, String(value));
  } catch {
    console.warn("Could not save the resolution setting");
  }

  for (const listener of resolutionListeners) {
    listener(value);
  }
}

function onResolution(listener: ResolutionListener): void {
  resolutionListeners.push(listener);
}

function loadRate(): number {
  try {
    const saved: number = Number(localStorage.getItem(rateStorageKey));

    return rates.includes(saved) ? saved : defaultRate;
  } catch {
    return defaultRate;
  }
}

function getRate(): number {
  return rate;
}

function setRate(value: number): void {
  if (value === rate || !rates.includes(value)) {
    return;
  }

  rate = value;

  try {
    localStorage.setItem(rateStorageKey, String(value));
  } catch {
    console.warn("Could not save the framerate setting");
  }

  for (const listener of rateListeners) {
    listener(value);
  }
}

function onRate(listener: RateListener): void {
  rateListeners.push(listener);
}

const tvStorageKey: string = "geregnet.tv";
const tvListeners: Array<TvListener> = new Array();
let tv: boolean = loadTv();

function loadTv(): boolean {
  try {
    return localStorage.getItem(tvStorageKey) === "on";
  } catch {
    return false;
  }
}

function getTv(): boolean {
  return tv;
}

function setTv(value: boolean): void {
  if (value === tv) {
    return;
  }

  tv = value;

  try {
    localStorage.setItem(tvStorageKey, value ? "on" : "off");
  } catch {
    console.warn("Could not save the TV mode setting");
  }

  for (const listener of tvListeners) {
    listener(value);
  }
}

function onTv(listener: TvListener): void {
  tvListeners.push(listener);
  listener(tv);
}

function loadVolumes(): Map<Channel, number> {
  const loaded: Map<Channel, number> = new Map();
  let saved: Record<string, unknown> = {};

  try {
    saved = JSON.parse(localStorage.getItem(volumeStorageKey) ?? "{}");
  } catch {
    saved = {};
  }

  for (const channel of channels) {
    const value: unknown = saved[channel];

    loaded.set(
      channel,
      typeof value === "number"
        ? Math.min(Math.max(value, 0), 1)
        : defaultVolume,
    );
  }

  return loaded;
}

function getVolume(channel: Channel): number {
  return volumes.get(channel) ?? defaultVolume;
}

function effectiveVolume(channel: Channel): number {
  return channel === "master"
    ? getVolume("master")
    : getVolume("master") * getVolume(channel);
}

function setVolume(channel: Channel, value: number): void {
  const volume: number = Math.min(Math.max(value, 0), 1);

  if (volume === getVolume(channel)) {
    return;
  }

  volumes.set(channel, volume);

  try {
    localStorage.setItem(
      volumeStorageKey,
      JSON.stringify(Object.fromEntries(volumes)),
    );
  } catch {
    console.warn("Could not save the volume settings");
  }

  for (const listener of volumeListeners) {
    listener(channel, volume);
  }
}

const shakeStorageKey: string = "geregnet.shake";
const shakeListeners: Array<CrtListener> = new Array();
let shake: boolean = loadShake();

function loadShake(): boolean {
  try {
    return localStorage.getItem(shakeStorageKey) !== "off";
  } catch {
    return true;
  }
}

function getShake(): boolean {
  return shake;
}

function setShake(value: boolean): void {
  if (value === shake) {
    return;
  }

  shake = value;

  try {
    localStorage.setItem(shakeStorageKey, value ? "on" : "off");
  } catch {
    console.warn("Could not save the shake setting");
  }

  for (const listener of shakeListeners) {
    listener(value);
  }
}

function onShake(listener: CrtListener): void {
  shakeListeners.push(listener);
  listener(shake);
}

const hitboxStorageKey: string = "geregnet.hitbox";
const hitboxListeners: Array<CrtListener> = new Array();
let hitbox: boolean = loadHitbox();

function loadHitbox(): boolean {
  try {
    return localStorage.getItem(hitboxStorageKey) === "on";
  } catch {
    return false;
  }
}

function getHitbox(): boolean {
  return hitbox;
}

function setHitbox(value: boolean): void {
  if (value === hitbox) {
    return;
  }

  hitbox = value;

  try {
    localStorage.setItem(hitboxStorageKey, value ? "on" : "off");
  } catch {
    console.warn("Could not save the hitbox setting");
  }

  for (const listener of hitboxListeners) {
    listener(hitbox);
  }
}

function onHitbox(listener: CrtListener): void {
  hitboxListeners.push(listener);
}

const dimStorageKey: string = "geregnet.dim";
const dimListeners: Array<RateListener> = new Array();
let dim: number = loadDim();

function loadDim(): number {
  try {
    const saved: number = Number(localStorage.getItem(dimStorageKey) ?? 0);

    return Number.isFinite(saved) ? Math.min(Math.max(saved, 0), 1) : 0;
  } catch {
    return 0;
  }
}

function getDim(): number {
  return dim;
}

function setDim(value: number): void {
  const next: number = Math.min(Math.max(value, 0), 1);

  if (next === dim) {
    return;
  }

  dim = next;

  try {
    localStorage.setItem(dimStorageKey, String(next));
  } catch {
    console.warn("Could not save the background dim");
  }

  for (const listener of dimListeners) {
    listener(next);
  }
}

function onDim(listener: RateListener): void {
  dimListeners.push(listener);
  listener(dim);
}

function getFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

function setFullscreen(value: boolean): void {
  if (value === getFullscreen()) {
    return;
  }

  const request: Promise<void> = value
    ? document.documentElement.requestFullscreen()
    : document.exitFullscreen();

  request.catch(() => console.warn("Could not change fullscreen"));
}

function onFullscreen(listener: CrtListener): void {
  document.addEventListener("fullscreenchange", () =>
    listener(getFullscreen()),
  );
}

function onVolume(listener: VolumeListener): void {
  volumeListeners.push(listener);
}

export {
  channels,
  getVolume,
  effectiveVolume,
  setVolume,
  onVolume,
  rates,
  getRate,
  setRate,
  onRate,
  resolutions,
  getResolution,
  setResolution,
  onResolution,
  getCrt,
  setCrt,
  onCrt,
  getTv,
  setTv,
  onTv,
  getTuning,
  setTuning,
  onTuning,
  getShake,
  setShake,
  onShake,
  getHitbox,
  setHitbox,
  onHitbox,
  getFullscreen,
  setFullscreen,
  onFullscreen,
  getDim,
  setDim,
  onDim,
};
export type { Channel, Tuning };
