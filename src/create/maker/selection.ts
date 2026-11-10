import type {
  Background,
  Bar,
  Bullet,
  Character,
  Creations,
  Effect,
  Emotion,
  Enemy,
  Game,
  Keyframe,
  Ost,
  Pattern,
  Ring,
  Run,
  Vessel,
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
  const overrides: Map<string, Item> = new Map();

  function chosen<T>(name: string, list: Array<T>): T {
    return (overrides.get(name) as T | undefined) ?? list[selection(name)]!;
  }

  function withItem(name: string, item: Item, action: () => void): void {
    const previous: Item | undefined = overrides.get(name);

    overrides.set(name, item);

    try {
      action();
    } finally {
      if (previous === undefined) {
        overrides.delete(name);
      } else {
        overrides.set(name, previous);
      }
    }
  }

  function selection(name: string): number {
    return tabs.find((value: Tab) => value.name === name)?.selected ?? 0;
  }

  function byId<T extends { id: string }>(
    select: (source: Creations) => Array<T>,
    id: string | null,
  ): T | null {
    return select(creations).find((value: T) => value.id === id) ?? null;
  }

  function current(): Item {
    return tab().items()[tab().selected]!;
  }

  function stage(): Stage {
    return chosen("stage", creations.stages);
  }

  function enemy(): Enemy {
    return chosen("enemy", creations.enemies);
  }

  function sigil(): Sigil {
    return chosen("sigil", creations.sigils);
  }

  function character(): Character {
    return chosen("character", creations.characters);
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
    return byId((source: Creations) => source.enemies, id);
  }

  return {
    withItem: withItem,
    current: current,
    stage: stage,
    run: (): Run => chosen("run", creations.runs),
    game: (): Game => chosen("game", creations.games),
    pattern: () => chosen("pattern", creations.patterns),
    enemy: enemy,
    background: () => chosen("background", creations.backgrounds),
    wallpaper: () => chosen("wallpaper", creations.wallpapers),
    bullet: () => chosen("bullet", creations.bullets),
    vessel: () => chosen("vessel", creations.vessels),
    palette: () => chosen("palette", creations.palettes),
    sound: () => chosen("sound", creations.sounds),
    ost: (): Ost => chosen("ost", creations.osts),
    sigil: sigil,
    spell: () => chosen("spell", creations.spells),
    cutscene: () => chosen("cutscene", creations.cutscenes),
    effect: (): Effect => chosen("effect", creations.effects),
    character: character,
    emotion: emotion,
    bar: bar,
    ring: ring,
    keyframe: keyframe,
    spawn: spawn,
    patternById: (id: string | null) =>
      byId<Pattern>((source: Creations) => source.patterns, id),
    enemyById: enemyById,
    backgroundById: (id: string | null) =>
      byId<Background>((source: Creations) => source.backgrounds, id),
    wallpaperById: (id: string | null) =>
      byId<Wallpaper>((source: Creations) => source.wallpapers, id),
    bulletById: (id: string | null) =>
      byId<Bullet>((source: Creations) => source.bullets, id),
    vesselById: (id: string | null) =>
      byId<Vessel>((source: Creations) => source.vessels, id),
    spellById: (id: string | null) =>
      byId<Spell>((source: Creations) => source.spells, id),
    sigilById: (id: string | null) =>
      byId<Sigil>((source: Creations) => source.sigils, id),
    soundById: (id: string | null) =>
      byId<Sound>((source: Creations) => source.sounds, id),
    effectById: (id: string | null) =>
      byId<Effect>((source: Creations) => source.effects, id),
    resolve: (value: Spawn) => enemyById(value.enemy),
  };
}

export { createSelection };
