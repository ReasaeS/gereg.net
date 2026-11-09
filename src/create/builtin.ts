import type { Sound } from "./types";
import { repairAmbience } from "./ambience";
import { repairScore } from "./arrange";

const soundFolder: string = "./sounds/";
const builtinCards: Array<string> = [
  "menu/storm",
  "menu/shore",
  "menu/rain",
  "menu/theme",
  "game/shot",
  "game/hit",
  "game/bomb",
  "game/fire",
  "game/defeat",
  "game/declare",
  "game/graze",
  "game/item",
  "game/power",
  "game/miss",
  "game/capture",
  "game/timeout",
  "game/cancel",
  "game/extend",
  "game/bombget",
];

async function loadSoundCard(path: string): Promise<Sound | null> {
  try {
    const bundle: {
      root?: unknown;
      creations?: { sounds?: Array<Sound> };
    } = await (await fetch(soundFolder + path + ".geregnet.json")).json();

    return (
      bundle.creations?.sounds?.find(
        (entry: Sound) => entry.id === bundle.root,
      ) ?? null
    );
  } catch {
    console.warn("Could not load the sound card " + path);
    return null;
  }
}

async function loadBuiltinSounds(): Promise<Array<Sound>> {
  const sounds: Array<Sound | null> = await Promise.all(
    builtinCards.map(loadSoundCard),
  );

  return sounds
    .filter((sound: Sound | null): sound is Sound => sound !== null)
    .map((sound: Sound) => ({
      ...sound,
      score: repairScore(sound.score),
      ambience: repairAmbience(sound.ambience),
    }));
}

export { loadSoundCard, loadBuiltinSounds };
