import type { Creations, Enemy, Pattern, Stage } from "../types";
import {
  defaultBackground,
  defaultCharacter,
  defaultCutscene,
  defaultEnemy,
  defaultPalette,
  defaultPattern,
  defaultSigil,
  defaultSound,
  defaultSpell,
  defaultStage,
  defaultWallpaper,
  repairSpells,
} from "../defaults";
import { defaultName, type Attack, type Cosmetic } from "../rarity";
import { cleanName } from "../transcript";
import type { Category, Kind } from "../gallery/kinds";
import type { Item } from "./studio";

const nameLength: number = 24;
const kindWords: Map<Kind, string> = new Map([
  ["stage", "Stage"],
  ["pattern", "Pattern"],
  ["enemy", "Enemy"],
  ["background", "Background"],
  ["wallpaper", "Wallpaper"],
  ["palette", "Palette"],
  ["sigil", "Sigil"],
  ["spell", "Spell"],
  ["sound", "Sound"],
  ["character", "Character"],
  ["cutscene", "Cutscene"],
]);

function listOf(creations: Creations, kind: Kind): Array<Item> {
  const lists: Record<Kind, Array<Item>> = {
    stage: creations.stages,
    pattern: creations.patterns,
    enemy: creations.enemies,
    background: creations.backgrounds,
    wallpaper: creations.wallpapers,
    palette: creations.palettes,
    sigil: creations.sigils,
    spell: creations.spells,
    sound: creations.sounds,
    character: creations.characters,
    cutscene: creations.cutscenes,
  };

  return lists[kind];
}

function rarityKey(kind: Kind, item: Item): string {
  return kind === "stage"
    ? (item as Stage).difficulty
    : kind === "enemy"
      ? (item as Enemy).rank
      : kind === "pattern"
        ? (item as Pattern).frame
        : kind;
}

function freshName(creations: Creations, kind: Kind, item: Item): string {
  const word: string = kindWords.get(kind)!;
  const key: string = rarityKey(kind, item);
  const taken: Set<string> = new Set(
    listOf(creations, kind)
      .filter((other: Item) => other !== item && rarityKey(kind, other) === key)
      .map((other: Item) => other.name),
  );
  let number: number = 1;

  while (taken.has(word + " " + number)) {
    number++;
  }

  return word + " " + number;
}

function renameDefault(creations: Creations, kind: Kind, item: Item): void {
  if (defaultName.test(item.name)) {
    item.name = freshName(creations, kind, item);
  }
}

function forgetStageLook(creations: Creations, id: string): void {
  for (const stageItem of creations.stages) {
    if (stageItem.background === id) {
      stageItem.background = null;
    }

    if (stageItem.wallpaper === id) {
      stageItem.wallpaper = null;
    }

    if (stageItem.palette === id) {
      stageItem.palette = null;
    }
  }
}

function forgetCosmetic(creations: Creations, id: string): void {
  for (const cutsceneItem of creations.cutscenes) {
    if (cutsceneItem.voice === id) {
      cutsceneItem.voice = null;
    }
  }

  for (const spellItem of creations.spells) {
    if (spellItem.background === id) {
      spellItem.background = null;
    }

    if (spellItem.pattern === id) {
      spellItem.pattern = null;
    }
  }

  repairSpells(creations);
}

function forgetAttack(creations: Creations, id: string): void {
  for (const enemyItem of creations.enemies) {
    if (enemyItem.pattern === id) {
      enemyItem.pattern = null;
    }

    for (const barItem of enemyItem.bars) {
      if (barItem.spell === id) {
        barItem.spell = null;
      }
    }
  }
}

function forgetSpawns(creations: Creations, id: string): void {
  for (const stageItem of creations.stages) {
    for (const keyframeItem of stageItem.keyframes) {
      for (const spawnItem of keyframeItem.spawns) {
        if (spawnItem.enemy === id) {
          spawnItem.enemy = null;
        }
      }
    }
  }
}

function convertAttack(
  creations: Creations,
  from: Kind,
  index: number,
  to: Attack,
): number {
  const item: Item = listOf(creations, from)[index]!;

  listOf(creations, from).splice(index, 1);
  forgetAttack(creations, item.id);
  forgetCosmetic(creations, item.id);

  if (to === "spell") {
    if (creations.sigils.length === 0) {
      creations.sigils.push({ ...defaultSigil(), name: "Sigil 1" });
    }

    return (
      creations.spells.push({
        ...defaultSpell(creations.sigils[0]!.id),
        id: item.id,
        name: item.name,
      }) - 1
    );
  }

  return (
    creations.patterns.push({
      ...defaultPattern(),
      frame: to,
      id: item.id,
      name: item.name,
    }) - 1
  );
}

function convertCosmetic(
  creations: Creations,
  from: Kind,
  index: number,
  to: Cosmetic,
): number {
  const item: Item = listOf(creations, from)[index]!;

  listOf(creations, from).splice(index, 1);
  forgetStageLook(creations, item.id);
  forgetCosmetic(creations, item.id);

  if (to === "wallpaper") {
    return (
      creations.wallpapers.push({
        ...defaultWallpaper(),
        id: item.id,
        name: item.name,
      }) - 1
    );
  }

  if (to === "palette") {
    return (
      creations.palettes.push({
        ...defaultPalette(),
        id: item.id,
        name: item.name,
      }) - 1
    );
  }

  if (to === "sigil") {
    return (
      creations.sigils.push({
        ...defaultSigil(),
        id: item.id,
        name: item.name,
      }) - 1
    );
  }

  if (to === "sound") {
    return (
      creations.sounds.push({
        ...defaultSound(),
        id: item.id,
        name: item.name,
      }) - 1
    );
  }

  if (to === "character") {
    return (
      creations.characters.push({
        ...defaultCharacter(item.name),
        id: item.id,
        name: cleanName(item.name) || "Character",
      }) - 1
    );
  }

  if (to === "cutscene") {
    return (
      creations.cutscenes.push({
        ...defaultCutscene(creations.characters),
        id: item.id,
        name: item.name,
      }) - 1
    );
  }

  return (
    creations.backgrounds.push({
      ...defaultBackground(),
      id: item.id,
      name: item.name,
    }) - 1
  );
}

function deleteEntry(creations: Creations, kind: Kind, index: number): void {
  const item: Item | undefined = listOf(creations, kind)[index];

  if (item === undefined) {
    return;
  }

  listOf(creations, kind).splice(index, 1);
  forgetCosmetic(creations, item.id);
  forgetAttack(creations, item.id);
  forgetStageLook(creations, item.id);
  forgetSpawns(creations, item.id);
}

function createEntry(creations: Creations, category: Category): Kind {
  const kind: Kind = category === "cosmetic" ? "background" : category;

  if (category === "stage") {
    creations.stages.push(
      defaultStage(
        creations.enemies[0]?.id ?? null,
        creations.backgrounds[0]?.id ?? null,
        creations.wallpapers[0]?.id ?? null,
        creations.palettes[0]?.id ?? null,
      ),
    );
  } else if (category === "pattern") {
    creations.patterns.push(defaultPattern());
  } else if (category === "enemy") {
    creations.enemies.push(defaultEnemy(creations.patterns[0]?.id ?? null));
  } else {
    creations.backgrounds.push(defaultBackground());
  }

  const list: Array<Item> = listOf(creations, kind);
  const item: Item = list[list.length - 1]!;

  item.name = freshName(creations, kind, item);

  return kind;
}

export {
  nameLength,
  listOf,
  freshName,
  renameDefault,
  convertAttack,
  convertCosmetic,
  deleteEntry,
  createEntry,
};
