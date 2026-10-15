type Channel = "master" | "soundtrack" | "sfx" | "dialogue";

type VolumeListener = (channel: Channel, volume: number) => void;

type RateListener = (rate: number) => void;

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
};
export type { Channel };
