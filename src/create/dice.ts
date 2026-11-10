import type { CardPick, Creations, Dice, DiceTable, Weighted } from "./types";
import { newSeed, seeded } from "./scenery";
import type { Option } from "../ui/widgets";
import type { Kind } from "./gallery/kinds";

type Meta = {
  name: string;
  kind: "number" | "choice" | "cards";
  min: number;
  max: () => number;
  step: number;
  options: () => Array<Option<unknown>>;
  get: () => unknown;
  set: (value: unknown) => void;
  view: unknown;
  cardKind: Kind | null;
};

type SectionMeta = {
  name: string;
  metas: Array<Meta>;
};

type Item = {
  id: string;
};

type Runner = (kind: string, item: Item, action: () => void) => void;

type Rolled = {
  key: string;
  item: Item;
};

const seedLimit: number = 99999;
const weightLimit: number = 10;
const entryLimit: number = 8;
const defaultWeight: number = 5;
const listKinds: Array<[keyof Creations, string]> = [
  ["stages", "stage"],
  ["runs", "run"],
  ["games", "game"],
  ["patterns", "pattern"],
  ["enemies", "enemy"],
  ["backgrounds", "background"],
  ["wallpapers", "wallpaper"],
  ["bullets", "bullet"],
  ["vessels", "vessel"],
  ["palettes", "palette"],
  ["sigils", "sigil"],
  ["spells", "spell"],
  ["sounds", "sound"],
  ["osts", "ost"],
  ["characters", "character"],
  ["cutscenes", "cutscene"],
  ["effects", "effect"],
];
const registry: Map<string, Array<SectionMeta>> = new Map();
const rolledCards: Map<string, Rolled> = new Map();
let runner: Runner | null = null;
let rolling: boolean = false;

function registerTab(kind: string, sections: Array<SectionMeta>): void {
  registry.set(kind, sections);
}

function useRunner(value: Runner): void {
  runner = value;
}

function isRolling(): boolean {
  return rolling;
}

function blankTable(): DiceTable {
  return { weights: {}, entries: new Array(), cards: new Array() };
}

function tableFrom(meta: Meta): DiceTable {
  const table: DiceTable = blankTable();
  const value: unknown = meta.get();

  if (meta.kind === "number") {
    table.entries.push({
      value: typeof value === "number" ? value : meta.min,
      weight: defaultWeight,
    });
  } else if (meta.kind === "choice") {
    table.weights[String(value)] = defaultWeight;
  } else if (typeof value === "string") {
    table.cards.push({ card: value, weight: defaultWeight });
  }

  return table;
}

function diceOf(creations: Creations, id: string): Dice | null {
  return creations.dice[id] ?? null;
}

function isDiced(creations: Creations, id: string, section: string): boolean {
  return diceOf(creations, id)?.sections[section] !== undefined;
}

function tableOf(
  creations: Creations,
  id: string,
  section: string,
  meta: Meta,
): DiceTable {
  const tables: Record<string, DiceTable> | undefined =
    creations.dice[id]?.sections[section];

  if (tables === undefined) {
    return blankTable();
  }

  tables[meta.name] = tables[meta.name] ?? tableFrom(meta);

  return tables[meta.name]!;
}

function toggleDice(
  creations: Creations,
  id: string,
  section: SectionMeta,
): void {
  const dice: Dice = creations.dice[id] ?? { seed: newSeed(), sections: {} };

  if (dice.sections[section.name] !== undefined) {
    delete dice.sections[section.name];
  } else {
    dice.sections[section.name] = Object.fromEntries(
      section.metas.map((meta: Meta) => [meta.name, tableFrom(meta)]),
    );
  }

  if (Object.keys(dice.sections).length === 0) {
    delete creations.dice[id];
  } else {
    creations.dice[id] = dice;
  }
}

function weighted(weights: Array<number>, random: () => number): number {
  const total: number = weights.reduce(
    (sum: number, weight: number) => sum + Math.max(weight, 0),
    0,
  );

  if (total <= 0) {
    return -1;
  }

  let roll: number = random() * total;

  for (let index = 0; index < weights.length; index++) {
    roll -= Math.max(weights[index]!, 0);

    if (roll < 0) {
      return index;
    }
  }

  return weights.length - 1;
}

function drawValue(
  meta: Meta,
  table: DiceTable,
  random: () => number,
): { value: unknown } | null {
  if (meta.kind === "number") {
    const index: number = weighted(
      table.entries.map((entry: Weighted) => entry.weight),
      random,
    );

    return index < 0 ? null : { value: table.entries[index]!.value };
  }

  if (meta.kind === "choice") {
    const options: Array<Option<unknown>> = meta.options();
    const index: number = weighted(
      options.map(
        (option: Option<unknown>) => table.weights[String(option.value)] ?? 0,
      ),
      random,
    );

    return index < 0 ? null : { value: options[index]!.value };
  }

  const picks: Array<CardPick> = table.cards.filter(
    (entry: CardPick) => entry.card !== null,
  );
  const index: number = weighted(
    picks.map((entry: CardPick) => entry.weight),
    random,
  );

  return index < 0 ? null : { value: picks[index]!.card };
}

function rollItem<T extends Item>(
  creations: Creations,
  kind: string,
  item: T,
): T {
  const dice: Dice | null = diceOf(creations, item.id);
  const sections: Array<SectionMeta> | undefined = registry.get(kind);

  if (dice === null || sections === undefined || runner === null || rolling) {
    return item;
  }

  const key: string = JSON.stringify(item) + JSON.stringify(dice);
  const cached: Rolled | undefined = rolledCards.get(item.id);

  if (cached !== undefined && cached.key === key) {
    return cached.item as T;
  }

  const clone: T = structuredClone(item);
  const random: () => number = seeded(dice.seed + 1);

  rolling = true;

  try {
    runner(kind, clone, () => {
      for (const section of sections) {
        const tables: Record<string, DiceTable> | undefined =
          dice.sections[section.name];

        if (tables === undefined) {
          continue;
        }

        for (const meta of section.metas) {
          const table: DiceTable | undefined = tables[meta.name];
          const drawn: { value: unknown } | null =
            table === undefined ? null : drawValue(meta, table, random);

          if (drawn !== null) {
            meta.set(drawn.value);
          }
        }
      }
    });
  } finally {
    rolling = false;
  }

  rolledCards.set(item.id, { key: key, item: clone });

  return clone;
}

function rollById<T extends Item>(
  creations: Creations,
  kind: string,
  item: T | null,
): T | null {
  return item === null ? null : rollItem(creations, kind, item);
}

function rollCreations(creations: Creations): Creations {
  if (Object.keys(creations.dice ?? {}).length === 0) {
    return creations;
  }

  const rolled: Creations = { ...creations };

  for (const [key, kind] of listKinds) {
    Object.assign(rolled, {
      [key]: (creations[key] as Array<Item>).map((item: Item) =>
        rollItem(creations, kind, item),
      ),
    });
  }

  return rolled;
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, min), max)
    : fallback;
}

function repairTable(table: Partial<DiceTable> | undefined): DiceTable {
  const source: Partial<DiceTable> = table ?? {};

  return {
    weights: Object.fromEntries(
      Object.entries(source.weights ?? {}).map(
        ([key, weight]: [string, number]) => [
          key,
          clampNumber(weight, 0, weightLimit, 0),
        ],
      ),
    ),
    entries: (Array.isArray(source.entries) ? source.entries : new Array())
      .slice(0, entryLimit)
      .map((entry: Weighted) => ({
        value: clampNumber(entry?.value, -Infinity, Infinity, 0),
        weight: clampNumber(entry?.weight, 0, weightLimit, defaultWeight),
      })),
    cards: (Array.isArray(source.cards) ? source.cards : new Array())
      .slice(0, entryLimit)
      .map((entry: CardPick) => ({
        card: typeof entry?.card === "string" ? entry.card : null,
        weight: clampNumber(entry?.weight, 0, weightLimit, defaultWeight),
      })),
  };
}

function repairDice(creations: Creations): void {
  const source: Record<string, Dice> =
    creations.dice !== null && typeof creations.dice === "object"
      ? creations.dice
      : {};

  creations.dice = Object.fromEntries(
    Object.entries(source).map(([id, dice]: [string, Dice]) => [
      id,
      {
        seed: Math.round(clampNumber(dice?.seed, 0, seedLimit, newSeed())),
        sections: Object.fromEntries(
          Object.entries(dice?.sections ?? {}).map(
            ([name, tables]: [string, Record<string, DiceTable>]) => [
              name,
              Object.fromEntries(
                Object.entries(tables ?? {}).map(
                  ([key, table]: [string, DiceTable]) => [
                    key,
                    repairTable(table),
                  ],
                ),
              ),
            ],
          ),
        ),
      },
    ]),
  );
}

function chance(weights: Array<number>, index: number): number {
  const total: number = weights.reduce(
    (sum: number, weight: number) => sum + Math.max(weight, 0),
    0,
  );

  return total <= 0 ? 0 : Math.max(weights[index] ?? 0, 0) / total;
}

export {
  seedLimit,
  weightLimit,
  entryLimit,
  defaultWeight,
  registerTab,
  useRunner,
  isRolling,
  isDiced,
  tableOf,
  toggleDice,
  diceOf,
  rollItem,
  rollById,
  rollCreations,
  repairDice,
  chance,
};
export type { Meta, SectionMeta };
