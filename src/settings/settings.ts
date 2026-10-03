type Sky = "day" | "night";

type SkyListener = (sky: Sky) => void;

const skyStorageKey: string = "geregnet.sky";
const skyListeners: Array<SkyListener> = new Array();
let sky: Sky = loadSky();

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

export { getSky, setSky, onSky };
export type { Sky };
