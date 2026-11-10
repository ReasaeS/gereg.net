import type { Game, GameEffect, GameSounds, Sound } from "../create/types";
import { playEffect } from "../create/sound";
import { defaultGameSounds, effectSound } from "../create/defaults";

type PlayerEffect = "shot" | "hit" | "bomb";

type CardEffect = "fire" | "defeat" | "declare" | "pickup";

type Effect = PlayerEffect | CardEffect | GameEffect;

type PlayerListener = (effect: PlayerEffect, id: string | null) => void;

const playerEffects: Array<PlayerEffect> = ["shot", "hit", "bomb"];
const playerStorageKey: string = "geregnet.playerSounds";
const gaps: Record<Effect, number> = {
  shot: 0.075,
  hit: 0.06,
  bomb: 0.3,
  fire: 0.05,
  defeat: 0.04,
  declare: 0.3,
  pickup: 0.2,
  graze: 0.04,
  item: 0.03,
  power: 0.5,
  miss: 0.5,
  capture: 0.5,
  timeout: 0.2,
  cancel: 0.3,
  extend: 0.5,
  bombget: 0.5,
}; // s
const lastPlayed: Map<Effect, number> = new Map();
const playerListeners: Array<PlayerListener> = new Array();
const players: Map<PlayerEffect, string | null> = loadPlayerSounds();
let library: Map<string, Sound> | null = null;
let gameSounds: GameSounds = defaultGameSounds();
let hushed: boolean = false;

function loadPlayerSounds(): Map<PlayerEffect, string | null> {
  const loaded: Map<PlayerEffect, string | null> = new Map();
  let saved: Partial<Record<PlayerEffect, unknown>> = {};

  try {
    saved = JSON.parse(localStorage.getItem(playerStorageKey) ?? "{}");
  } catch {
    saved = {};
  }

  for (const effect of playerEffects) {
    const value: unknown = saved[effect];

    loaded.set(
      effect,
      typeof value === "string" || value === null ? value : effectSound(effect),
    );
  }

  return loaded;
}

function playerSound(effect: PlayerEffect): string | null {
  return players.get(effect) ?? null;
}

function setPlayerSound(effect: PlayerEffect, id: string | null): void {
  if (playerSound(effect) === id) {
    return;
  }

  players.set(effect, id);

  try {
    localStorage.setItem(
      playerStorageKey,
      JSON.stringify(Object.fromEntries(players)),
    );
  } catch {
    console.warn("Could not save the player sounds");
  }

  for (const listener of playerListeners) {
    listener(effect, id);
  }
}

function resetPlayerSounds(): void {
  for (const effect of playerEffects) {
    setPlayerSound(effect, effectSound(effect));
  }
}

function onPlayerSound(listener: PlayerListener): void {
  playerListeners.push(listener);
}

function useEffects(sounds: Array<Sound> | null, game: Game | null): void {
  library =
    sounds === null
      ? null
      : new Map(sounds.map((sound: Sound) => [sound.id, sound]));
  gameSounds = { ...defaultGameSounds(), ...game?.sounds };
}

function hush(on: boolean): void {
  hushed = on;
}

function idOf(effect: Effect, card: string | null | undefined): string | null {
  if (card !== undefined) {
    return card;
  }

  if (effect === "shot" || effect === "hit" || effect === "bomb") {
    return playerSound(effect);
  }

  if (effect === "fire" || effect === "defeat" || effect === "declare") {
    return effectSound(effect);
  }

  if (effect === "pickup") {
    return effectSound("power");
  }

  return gameSounds[effect];
}

function cue(effect: Effect, card?: string | null): void {
  if (library === null || hushed) {
    return;
  }

  const id: string | null = idOf(effect, card);
  const sound: Sound | undefined = id === null ? undefined : library.get(id);
  const now: number = performance.now() / 1000;

  if (
    sound === undefined ||
    now - (lastPlayed.get(effect) ?? -Infinity) < gaps[effect]
  ) {
    return;
  }

  lastPlayed.set(effect, now);
  playEffect(sound);
}

export {
  playerEffects,
  playerSound,
  setPlayerSound,
  resetPlayerSounds,
  onPlayerSound,
  useEffects,
  hush,
  cue,
};
export type { PlayerEffect, Effect };
