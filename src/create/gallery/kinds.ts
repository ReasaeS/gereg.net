import type {
  Background,
  Character,
  Creations,
  Cutscene,
  Enemy,
  Palette,
  Pattern,
  Sigil,
  Sound,
  Spell,
  Stage,
  Wallpaper,
} from "../types";
import {
  cosmetics,
  difficulties,
  attacks,
  defaultName,
  ranks,
  rarityOf,
  type Rarity,
} from "../rarity";

type Kind =
  | "stage"
  | "pattern"
  | "enemy"
  | "background"
  | "wallpaper"
  | "palette"
  | "sigil"
  | "spell"
  | "sound"
  | "character"
  | "cutscene";

type Category = "stage" | "cosmetic" | "enemy" | "pattern";

type Action = "delete" | "rename" | "publish";

type Creation =
  | Stage
  | Pattern
  | Enemy
  | Background
  | Wallpaper
  | Palette
  | Sigil
  | Spell
  | Sound
  | Character
  | Cutscene;

type Entry = {
  kind: Kind;
  index: number;
  item: Creation;
};

type Order = "rarity" | "name" | "created";

type Search = {
  query: string;
  order: Order;
  reversed: boolean;
  types: Set<string>;
};

const categoryList: Array<Category> = ["stage", "enemy", "pattern", "cosmetic"];
const categoryNames: Map<Category, string> = new Map([
  ["stage", "stages"],
  ["cosmetic", "cosmetics"],
  ["enemy", "enemies"],
  ["pattern", "patterns"],
]);
const itemNames: Map<Category, string> = new Map([
  ["stage", "stage"],
  ["cosmetic", "cosmetic"],
  ["enemy", "enemy"],
  ["pattern", "pattern"],
]);

const orderList: Array<Order> = ["rarity", "name", "created"];
const orderNames: Map<Order, string> = new Map([
  ["rarity", "rarity"],
  ["name", "a - z"],
  ["created", "created"],
]);

function categoryTypes(category: Category): Array<Rarity<unknown>> {
  if (category === "stage") {
    return difficulties;
  }

  if (category === "enemy") {
    return ranks;
  }

  if (category === "pattern") {
    return attacks;
  }

  return cosmetics;
}

function entryRarity(entry: Entry): Rarity<unknown> {
  if (entry.kind === "stage") {
    return rarityOf(difficulties, (entry.item as Stage).difficulty);
  }

  if (entry.kind === "enemy") {
    return rarityOf(ranks, (entry.item as Enemy).rank);
  }

  if (entry.kind === "pattern") {
    return rarityOf(attacks, (entry.item as Pattern).frame);
  }

  if (entry.kind === "spell") {
    return rarityOf(attacks, "spell");
  }

  return rarityOf(cosmetics, entry.kind);
}

function compareEntries(
  category: Category,
  first: Entry,
  second: Entry,
): number {
  const tier: number =
    (entryRarity(first).tier - entryRarity(second).tier) *
    (category === "stage" ? -1 : 1);
  const firstDefault: RegExpExecArray | null = defaultName.exec(
    first.item.name,
  );
  const secondDefault: RegExpExecArray | null = defaultName.exec(
    second.item.name,
  );

  if (tier !== 0) {
    return tier;
  }

  if (firstDefault !== null && secondDefault !== null) {
    return Number(firstDefault[2]) - Number(secondDefault[2]);
  }

  if (firstDefault !== null || secondDefault !== null) {
    return firstDefault !== null ? 1 : -1;
  }

  return compareNames(first, second);
}

function listEntries(source: Creations, category: Category): Array<Entry> {
  const list: Array<Entry> = new Array();

  function add(kind: Kind, items: Array<Creation>): void {
    for (let index = 0; index < items.length; index++) {
      list.push({ kind: kind, index: index, item: items[index]! });
    }
  }

  if (category === "stage") {
    add("stage", source.stages);
  } else if (category === "pattern") {
    add("pattern", source.patterns);
    add("spell", source.spells);
  } else if (category === "enemy") {
    add("enemy", source.enemies);
  } else {
    add("background", source.backgrounds);
    add("wallpaper", source.wallpapers);
    add("palette", source.palettes);
    add("sigil", source.sigils);
    add("sound", source.sounds);
    add("cutscene", source.cutscenes);
    add("character", source.characters);
  }

  return list.sort((first: Entry, second: Entry) =>
    compareEntries(category, first, second),
  );
}

function compareNames(first: Entry, second: Entry): number {
  return first.item.name.localeCompare(second.item.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareOrder(
  order: Order,
  category: Category,
  first: Entry,
  second: Entry,
): number {
  let result: number = 0;

  if (order === "name") {
    result = compareNames(first, second);
  } else if (order === "created" && first.item.id !== second.item.id) {
    result = first.item.id < second.item.id ? -1 : 1;
  }

  if (result !== 0) {
    return result;
  }

  return compareEntries(category, first, second);
}

function searchEntries(
  source: Creations,
  category: Category,
  search: Search,
): Array<Entry> {
  const query: string = search.query.trim().toLowerCase();
  const direction: number = search.reversed ? -1 : 1;

  return listEntries(source, category)
    .filter(
      (entry: Entry) =>
        (search.types.size === 0 ||
          search.types.has(entryRarity(entry).label)) &&
        entry.item.name.toLowerCase().includes(query),
    )
    .sort(
      (first: Entry, second: Entry) =>
        compareOrder(search.order, category, first, second) * direction,
    );
}

export {
  categoryList,
  categoryNames,
  itemNames,
  orderList,
  orderNames,
  categoryTypes,
  entryRarity,
  listEntries,
  searchEntries,
};
export type { Kind, Category, Action, Creation, Entry, Order, Search };
