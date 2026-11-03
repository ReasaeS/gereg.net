import type { Creations } from "./types";

function defaultCreations(): Creations {
  return {
    stages: new Array(),
    runs: new Array(),
    games: new Array(),
    patterns: new Array(),
    enemies: new Array(),
    backgrounds: new Array(),
    wallpapers: new Array(),
    bullets: new Array(),
    vessels: new Array(),
    palettes: new Array(),
    sigils: new Array(),
    spells: new Array(),
    sounds: new Array(),
    osts: new Array(),
    characters: new Array(),
    cutscenes: new Array(),
  };
}

export { defaultCreations };
