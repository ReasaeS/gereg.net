import type {
  Background,
  Bullet,
  Character,
  Creations,
  Cutscene,
  Enemy,
  Frame,
  Game,
  Ost,
  Palette,
  Pattern,
  Rank,
  Sigil,
  Sound,
  SoundSource,
  Run,
  Vessel,
  Spell,
  Stage,
  Wallpaper,
} from "../types";
import {
  audio,
  cosmetics,
  difficulties,
  story,
  visuals,
  attacks,
  defaultName,
  forms,
  gameRarity,
  ranks,
  rarityOf,
  type Cosmetic,
  type Rarity,
} from "../rarity";
import { isMusic } from "../sound";

type Kind =
  | "stage"
  | "run"
  | "game"
  | "pattern"
  | "enemy"
  | "background"
  | "wallpaper"
  | "bullet"
  | "vessel"
  | "palette"
  | "sigil"
  | "spell"
  | "sound"
  | "ost"
  | "character"
  | "cutscene";

type Category = "stage" | "enemy" | "pattern" | "visual" | "audio" | "story";

type Action = "rename" | "duplicate" | "export" | "delete";

type Creation =
  | Stage
  | Run
  | Game
  | Pattern
  | Enemy
  | Background
  | Wallpaper
  | Bullet
  | Vessel
  | Palette
  | Sigil
  | Spell
  | Sound
  | Ost
  | Character
  | Cutscene;

type Entry = {
  kind: Kind;
  index: number;
  item: Creation;
};

type Deal = {
  kind: Kind;
  frame: Frame | null;
  rank: Rank | null;
  source: SoundSource | null;
  rarity: Rarity<unknown>;
  text: string;
};

type Order = "rarity" | "name" | "created";

type Search = {
  query: string;
  order: Order;
  reversed: boolean;
  types: Set<string>;
};

const categoryList: Array<Category> = [
  "stage",
  "enemy",
  "pattern",
  "visual",
  "audio",
  "story",
];
const categoryNames: Map<Category, string> = new Map([
  ["stage", "stages"],
  ["enemy", "enemies"],
  ["pattern", "patterns"],
  ["visual", "visuals"],
  ["audio", "audio"],
  ["story", "story"],
]);
const itemNames: Map<Category, string> = new Map([
  ["stage", "stage"],
  ["enemy", "enemy"],
  ["pattern", "pattern"],
  ["visual", "visual"],
  ["audio", "audio"],
  ["story", "story"],
]);

const packOrder: Array<Kind> = ["game", "run", "stage"];
const collections: Array<Kind> = ["game", "run"];

const dealTexts: Map<string, string> = new Map([
  ["stage", "A level"],
  ["run", "Stages in a row"],
  ["game", "Runs for each difficulty"],
  ["objective", "Fires at the field"],
  ["subjective", "Fires from the enemy"],
  ["spell", "A boss spell card"],
  ["regular", "One health bar"],
  ["subboss", "A mid-stage threat"],
  ["boss", "Several spell bars"],
  ["background", "A scrolling sky"],
  ["wallpaper", "The frame around play"],
  ["bullet", "An energy shot"],
  ["vessel", "A craft for enemies"],
  ["palette", "Menu colours"],
  ["sigil", "Rings behind a spell"],
  ["sound", "A sound effect"],
  ["music", "A song or track"],
  ["ambience", "Wind, rain and waves"],
  ["ost", "Songs for a game"],
  ["cutscene", "A conversation"],
  ["character", "A speaker"],
]);

const soundSources: Array<[Cosmetic, SoundSource]> = [
  ["sound", "synth"],
  ["music", "song"],
  ["ambience", "ambient"],
];

const orderList: Array<Order> = ["rarity", "name", "created"];

function categoryOf(kind: Kind): Category {
  if (kind === "stage" || kind === "enemy") {
    return kind;
  }

  if (kind === "run" || kind === "game") {
    return "stage";
  }

  if (kind === "pattern" || kind === "spell") {
    return "pattern";
  }

  if (kind === "sound" || kind === "ost") {
    return "audio";
  }

  if (kind === "cutscene" || kind === "character") {
    return "story";
  }

  return "visual";
}

function categoryTypes(category: Category): Array<Rarity<unknown>> {
  if (category === "stage") {
    return [...difficulties, gameRarity];
  }

  if (category === "enemy") {
    return ranks;
  }

  if (category === "pattern") {
    return attacks;
  }

  return cosmeticTypes(category);
}

function cosmeticTypes(category: Category): Array<Rarity<Cosmetic>> {
  if (category === "audio") {
    return audio;
  }

  if (category === "story") {
    return story;
  }

  return visuals;
}

function categoryDeals(category: Category): Array<Deal> {
  function deal(
    kind: Kind,
    frame: Frame | null,
    rarity: Rarity<unknown>,
    rank: Rank | null = null,
    source: SoundSource | null = null,
  ): Deal {
    return {
      kind: kind,
      frame: frame,
      rank: rank,
      source: source,
      rarity: rarity,
      text:
        dealTexts.get(
          frame ??
            rank ??
            soundSources.find(
              ([, value]: [Cosmetic, SoundSource]) => value === source,
            )?.[0] ??
            kind,
        ) ?? "",
    };
  }

  if (category === "stage") {
    return forms.map((form: Rarity<Kind>) => deal(form.value, null, form));
  }

  if (category === "pattern") {
    return attacks.map((attack: Rarity<Frame | "spell">) =>
      attack.value === "spell"
        ? deal("spell", null, attack)
        : deal("pattern", attack.value, attack),
    );
  }

  if (category === "enemy") {
    return ranks.map((rank: Rarity<Rank>) =>
      deal("enemy", null, rank, rank.value),
    );
  }

  if (category === "audio") {
    return audio.map((sound: Rarity<Cosmetic>) =>
      sound.value === "ost"
        ? deal("ost", null, sound)
        : deal(
            "sound",
            null,
            sound,
            null,
            soundSources.find(
              ([key]: [Cosmetic, SoundSource]) => key === sound.value,
            )?.[1] ?? "synth",
          ),
    );
  }

  return cosmeticTypes(category).map((cosmetic: Rarity<Cosmetic>) =>
    deal(cosmetic.value as Kind, null, cosmetic),
  );
}

function entryRarity(entry: Entry): Rarity<unknown> {
  if (entry.kind === "stage") {
    return rarityOf(difficulties, (entry.item as Stage).difficulty);
  }

  if (entry.kind === "run") {
    return rarityOf(difficulties, (entry.item as Run).difficulty);
  }

  if (entry.kind === "game") {
    return gameRarity;
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

  if (entry.kind === "sound") {
    const sound: Sound = entry.item as Sound;

    return rarityOf(
      audio,
      sound.source === "ambient"
        ? "ambience"
        : isMusic(sound)
          ? "music"
          : "sound",
    );
  }

  return rarityOf(cosmetics, entry.kind);
}

function compareEntries(
  category: Category,
  first: Entry,
  second: Entry,
): number {
  const collection: number =
    Number(collections.includes(second.kind)) -
    Number(collections.includes(first.kind));
  const tier: number =
    (entryRarity(first).tier - entryRarity(second).tier) *
    (category === "stage" ? -1 : 1);
  const firstDefault: RegExpExecArray | null = defaultName.exec(
    first.item.name,
  );
  const secondDefault: RegExpExecArray | null = defaultName.exec(
    second.item.name,
  );

  if (collection !== 0) {
    return collection;
  }

  if (tier !== 0) {
    return tier;
  }

  if (first.kind !== second.kind && packOrder.includes(first.kind)) {
    return packOrder.indexOf(first.kind) - packOrder.indexOf(second.kind);
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
    add("game", source.games);
    add("run", source.runs);
    add("stage", source.stages);
  } else if (category === "pattern") {
    add("pattern", source.patterns);
    add("spell", source.spells);
  } else if (category === "enemy") {
    add("enemy", source.enemies);
  } else if (category === "audio") {
    add("sound", source.sounds);
    add("ost", source.osts);
  } else if (category === "story") {
    add("cutscene", source.cutscenes);
    add("character", source.characters);
  } else {
    add("background", source.backgrounds);
    add("wallpaper", source.wallpapers);
    add("bullet", source.bullets);
    add("vessel", source.vessels);
    add("palette", source.palettes);
    add("sigil", source.sigils);
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
  categoryTypes,
  categoryOf,
  categoryDeals,
  entryRarity,
  listEntries,
  searchEntries,
};
export type { Kind, Category, Action, Creation, Deal, Entry, Order, Search };
