type Sky = "day" | "night";

type SkyListener = (sky: Sky) => void;

type Channel = "master" | "soundtrack" | "sfx" | "dialogue";

type VolumeListener = (channel: Channel, volume: number) => void;

const skyStorageKey: string = "geregnet.sky";
const skyListeners: Array<SkyListener> = new Array();
let sky: Sky = loadSky();
const channels: Array<Channel> = ["master", "soundtrack", "sfx", "dialogue"];
const volumeStorageKey: string = "geregnet.volume";
const defaultVolume: number = 0.8;
const volumeListeners: Array<VolumeListener> = new Array();
const volumes: Map<Channel, number> = loadVolumes();

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

function loadSky(): Sky {
  try {
    return localStorage.getItem(skyStorageKey) === "night" ? "night" : "day";
  } catch {
    return "day";
  }
}

function getSky(): Sky {
  return sky;
}

function setSky(value: Sky): void {
  if (value === sky) {
    return;
  }

  sky = value;

  try {
    localStorage.setItem(skyStorageKey, value);
  } catch {
    console.warn("Could not save the sky setting");
  }

  for (let index = 0; index < skyListeners.length; index++) {
    skyListeners[index]!(value);
  }
}

function onSky(listener: SkyListener): void {
  skyListeners.push(listener);
  listener(sky);
}

export {
  channels,
  getSky,
  setSky,
  onSky,
  getVolume,
  effectiveVolume,
  setVolume,
  onVolume,
};
export type { Sky, Channel };
