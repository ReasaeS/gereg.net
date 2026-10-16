import type { Creations, Enemy, Pattern, Run, Stage } from "../types";
import { createId, defaultSigil, repairSpells } from "../defaults";
import { defaultName } from "../rarity";
import { blankEntry } from "../blank";
import type { Deal, Kind } from "../gallery/kinds";
import type { Item } from "./studio";

const nameLength: number = 24;
const kindWords: Map<Kind, string> = new Map([
  ["stage", "Stage"],
  ["run", "Run"],
  ["game", "Game"],
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
    run: creations.runs,
    game: creations.games,
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
    : kind === "run"
      ? (item as Run).difficulty
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

    if (stageItem.music === id) {
      stageItem.music = null;
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

function createEntry(creations: Creations, deal: Deal): Kind {
  if (deal.kind === "spell" && creations.sigils.length === 0) {
    creations.sigils.push({ ...defaultSigil(), name: "Sigil 1" });
  }

  const item: Item = blankEntry(creations, deal, false);

  listOf(creations, deal.kind).push(item);
  item.name = freshName(creations, deal.kind, item);

  return deal.kind;
}

function duplicateEntry(
  creations: Creations,
  kind: Kind,
  index: number,
): number {
  const list: Array<Item> = listOf(creations, kind);
  const item: Item | undefined = list[index];

  if (item === undefined) {
    return -1;
  }

  const copy: Item = structuredClone(item);
  const suffix: string = " copy";

  copy.id = createId();
  copy.name = defaultName.test(item.name)
    ? freshName(creations, kind, copy)
    : item.name.slice(0, nameLength - suffix.length) + suffix;

  return list.push(copy) - 1;
}

export {
  nameLength,
  listOf,
  freshName,
  renameDefault,
  deleteEntry,
  createEntry,
  duplicateEntry,
};
