import type {
  Background,
  Bar,
  Character,
  Creations,
  Emotion,
  Enemy,
  Game,
  Keyframe,
  Pattern,
  Ring,
  Run,
  Sigil,
  Sound,
  Spawn,
  Spell,
  Stage,
  Wallpaper,
} from "../types";
import type { Cursor, Item, Selection, Tab } from "./studio";

function createSelection(
  creations: Creations,
  tabs: Array<Tab>,
  tab: () => Tab,
  cursor: Cursor,
): Selection {
  function selection(name: string): number {
    return tabs.find((value: Tab) => value.name === name)?.selected ?? 0;
  }

  function byId<T extends { id: string }>(
    list: Array<T>,
    id: string | null,
  ): T | null {
    return list.find((value: T) => value.id === id) ?? null;
  }

  function current(): Item {
    return tab().items()[tab().selected]!;
  }

  function stage(): Stage {
    return creations.stages[selection("stage")]!;
  }

  function enemy(): Enemy {
    return creations.enemies[selection("enemy")]!;
  }

  function sigil(): Sigil {
    return creations.sigils[selection("sigil")]!;
  }

  function character(): Character {
    return creations.characters[selection("character")]!;
  }

  function emotion(): Emotion {
    cursor.emotion = Math.min(cursor.emotion, character().emotions.length - 1);

    return character().emotions[cursor.emotion]!;
  }

  function bar(): Bar {
    cursor.bar =
      enemy().rank !== "boss"
        ? 0
        : Math.min(cursor.bar, enemy().bars.length - 1);

    return enemy().bars[cursor.bar]!;
  }

  function ring(): Ring {
    cursor.ring = Math.min(cursor.ring, sigil().rings.length - 1);

    return sigil().rings[cursor.ring]!;
  }

  function keyframe(): Keyframe {
    cursor.keyframe = Math.min(cursor.keyframe, stage().keyframes.length - 1);

    return stage().keyframes[cursor.keyframe]!;
  }

  function spawn(): Spawn {
    cursor.spawn = Math.min(cursor.spawn, keyframe().spawns.length - 1);

    return keyframe().spawns[cursor.spawn]!;
  }

  function enemyById(id: string | null): Enemy | null {
    return byId(creations.enemies, id);
  }

  return {
    current: current,
    stage: stage,
    run: (): Run => creations.runs[selection("run")]!,
    game: (): Game => creations.games[selection("game")]!,
    pattern: () => creations.patterns[selection("pattern")]!,
    enemy: enemy,
    background: () => creations.backgrounds[selection("background")]!,
    wallpaper: () => creations.wallpapers[selection("wallpaper")]!,
    palette: () => creations.palettes[selection("palette")]!,
    sound: () => creations.sounds[selection("sound")]!,
    sigil: sigil,
    spell: () => creations.spells[selection("spell")]!,
    cutscene: () => creations.cutscenes[selection("cutscene")]!,
    character: character,
    emotion: emotion,
    bar: bar,
    ring: ring,
    keyframe: keyframe,
    spawn: spawn,
    patternById: (id: string | null) => byId<Pattern>(creations.patterns, id),
    enemyById: enemyById,
    backgroundById: (id: string | null) =>
      byId<Background>(creations.backgrounds, id),
    wallpaperById: (id: string | null) =>
      byId<Wallpaper>(creations.wallpapers, id),
    spellById: (id: string | null) => byId<Spell>(creations.spells, id),
    sigilById: (id: string | null) => byId<Sigil>(creations.sigils, id),
    soundById: (id: string | null) => byId<Sound>(creations.sounds, id),
    resolve: (value: Spawn) => enemyById(value.enemy),
  };
}

export { createSelection };
