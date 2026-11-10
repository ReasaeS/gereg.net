import { Container } from "pixi.js";
import type {
  CardPick,
  Creations,
  Dice,
  DiceTable,
  Vector,
  Wave,
  Weighted,
} from "../types";
import type { Rarity } from "../rarity";
import type { Kind } from "../gallery/kinds";
import {
  chipHeight,
  createChip,
  createChoice,
  createColors,
  createSlider,
  createVector,
  createNumberField,
  createTableHead,
  createTableLine,
  rowHeight,
  rowWidth,
  type Cell,
  type Chip,
  type Control,
  type Name,
  type Option,
} from "../../ui/widgets";
import { createSection } from "../../ui/rows";
import {
  chance,
  defaultWeight,
  diceOf,
  entryLimit,
  isDiced,
  seedLimit,
  tableOf,
  toggleDice,
  weightLimit,
  type Meta,
  type SectionMeta,
} from "../dice";
import { newSeed } from "../scenery";

type Kit = {
  rarityOptions: <T>(list: Array<Rarity<T>>) => () => Array<Option<T>>;
  slider: (
    name: Name,
    min: number,
    max: number | (() => number),
    step: number,
    get: () => number,
    set: (value: number) => void,
  ) => Control;
  choice: <T>(
    name: string,
    options: () => Array<Option<T>>,
    get: () => T,
    set: (value: T) => void,
    kind?: Kind,
  ) => Control;
  colors: (
    name: string,
    list: Array<string>,
    get: () => string,
    set: (value: string) => void,
  ) => Control;
  section: (
    name: string,
    list: Array<Control>,
    visible?: () => boolean,
    dice?: boolean,
  ) => Array<Control>;
  claimSections: () => Array<SectionMeta>;
  actionRow: (
    first: string,
    firstAction: () => void,
    second?: string,
    secondAction?: () => void,
  ) => Control;
  vector: (
    name: string,
    min: number,
    max: number,
    step: number,
    get: () => Vector,
    set: (value: Vector) => void,
  ) => Control;
  waveRows: <T>(
    list: () => Array<Wave<T>>,
    amplitude: (name: string, get: () => T, set: (value: T) => void) => Control,
    blank: () => T,
    visible: () => boolean,
    moved?: () => void,
  ) => Array<Control>;
  derivativeActions: <T>(
    list: () => Array<T>,
    names: Array<string>,
    blank: () => T,
  ) => Control;
  buttonRow: (name: string, action: () => void) => Control;
  pickCard: (
    name: string,
    kinds: Array<Kind>,
    options: Array<Option<string>>,
    current: string | null,
    choose: (value: string) => void,
  ) => void;
  sectionCount: () => number;
  openSection: (key: number) => void;
  closeSections: () => void;
};

const cellLength: number = 15;
const actionGap: number = 6; // units
const actionWidth: number = (rowWidth - actionGap) / 2; // units
const waveNames: Array<string> = ["wave 1", "wave 2", "wave 3"];
const waveFrequency: number = 0.5; // Hz
const frequencyMin: number = 0.05; // Hz
const frequencyMax: number = 5; // Hz
const frequencyStep: number = 0.05; // Hz
const phaseLimit: number = 180; // deg
const waveAmplitude: number = 60; // units
const phaseShiftLimit: number = 360; // deg/s

type Browse = <T>(
  name: string,
  kind: Kind | Array<Kind>,
  options: Array<Option<T>>,
  current: T,
  choose: (value: T) => void,
) => void;

function nameText(name: Name): string {
  return typeof name === "string" ? name : name();
}

function shortText(text: string): string {
  return text.length > cellLength ? text.slice(0, cellLength - 2) + ".." : text;
}

function createKit(
  changed: () => void,
  refresh: () => void,
  browse: Browse,
  creations: Creations,
  current: () => { id: string },
): Kit {
  const sectionOpen: Map<number, boolean> = new Map();
  let sections: number = 0;
  let pending: Array<Meta> = new Array();
  let claimed: Array<SectionMeta> = new Array();

  function claimSections(): Array<SectionMeta> {
    const list: Array<SectionMeta> = claimed;

    claimed = new Array();
    pending = new Array();

    return list;
  }

  function edited(): void {
    changed();
    refresh();
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  function entryNames(): Array<string> {
    return new Array(entryLimit)
      .fill("")
      .map((_: string, index: number) => "option " + (index + 1));
  }

  function weightCell(get: () => number, set: (value: number) => void): Cell {
    return {
      text: () => String(get()),
      step: (direction: number) => {
        set(clamp(get() + direction, 0, weightLimit));
        edited();
      },
    };
  }

  function numberTable(table: () => DiceTable, meta: Meta): Array<Control> {
    const entries: () => Array<Weighted> = (): Array<Weighted> =>
      table().entries;
    const names: Array<string> = entryNames();

    return [
      createTableHead([shortText(meta.name), "Weight", "Chance"]),
      ...names.map((_: string, index: number) => {
        const entry: () => Weighted = (): Weighted =>
          entries()[index] ?? { value: meta.min, weight: 0 };

        return {
          ...createTableLine(
            [
              {
                text: () => String(Math.round(entry().value * 100) / 100),
                step: (direction: number) => {
                  entry().value = clamp(
                    Math.round(
                      (entry().value + direction * meta.step) / meta.step,
                    ) * meta.step,
                    meta.min,
                    meta.max(),
                  );
                  edited();
                },
              },
              weightCell(
                () => entry().weight,
                (value: number) => {
                  entry().weight = value;
                },
              ),
            ],
            () =>
              chance(
                entries().map((value: Weighted) => value.weight),
                index,
              ),
            index % 2 === 1,
          ),
          shown: () => entries().length > index,
        };
      }),
      derivativeActions(entries, names, (): Weighted => ({
        value: entries()[entries().length - 1]?.value ?? meta.min,
        weight: defaultWeight,
      })),
    ];
  }

  function choiceTable(table: () => DiceTable, meta: Meta): Array<Control> {
    const count: number = Math.max(meta.options().length, 1);
    const weights: () => Array<number> = (): Array<number> =>
      meta
        .options()
        .map(
          (option: Option<unknown>) =>
            table().weights[String(option.value)] ?? 0,
        );

    return [
      createTableHead([shortText(meta.name), "Weight", "Chance"]),
      ...new Array(count).fill(0).map((_: number, index: number) => {
        const key: () => string = (): string =>
          String(meta.options()[index]?.value);

        return {
          ...createTableLine(
            [
              {
                text: () => shortText(meta.options()[index]?.label ?? ""),
              },
              weightCell(
                () => table().weights[key()] ?? 0,
                (value: number) => {
                  table().weights[key()] = value;
                },
              ),
            ],
            () => chance(weights(), index),
            index % 2 === 1,
          ),
          shown: () => meta.options().length > index,
        };
      }),
    ];
  }

  function cardTable(
    table: () => DiceTable,
    meta: Meta,
    kind: Kind,
  ): Array<Control> {
    const entries: () => Array<CardPick> = (): Array<CardPick> => table().cards;
    const names: Array<string> = entryNames();
    const options: () => Array<Option<string>> = (): Array<Option<string>> =>
      meta
        .options()
        .filter(
          (option: Option<unknown>): option is Option<string> =>
            typeof option.value === "string",
        );

    return [
      createTableHead([shortText(meta.name), "Weight", "Chance"]),
      ...names.map((_: string, index: number) => {
        const entry: () => CardPick = (): CardPick =>
          entries()[index] ?? { card: null, weight: 0 };

        return {
          ...createTableLine(
            [
              {
                text: () =>
                  shortText(
                    options().find(
                      (option: Option<string>) => option.value === entry().card,
                    )?.label ?? "Choose",
                  ),
                tap: () =>
                  pickCard(
                    meta.name,
                    [kind],
                    options(),
                    entry().card,
                    (value: string) => {
                      entry().card = value;
                    },
                  ),
              },
              weightCell(
                () => entry().weight,
                (value: number) => {
                  entry().weight = value;
                },
              ),
            ],
            () =>
              chance(
                entries().map((value: CardPick) =>
                  value.card === null ? 0 : value.weight,
                ),
                index,
              ),
            index % 2 === 1,
          ),
          shown: () => entries().length > index,
        };
      }),
      derivativeActions(entries, names, (): CardPick => ({
        card: options()[0]?.value ?? null,
        weight: defaultWeight,
      })),
    ];
  }

  function diceRows(name: string, metas: Array<Meta>): Array<Control> {
    const seed: () => number = (): number =>
      diceOf(creations, current().id)?.seed ?? 0;

    function reseed(value: number): void {
      const dice: Dice | null = diceOf(creations, current().id);

      if (dice !== null) {
        dice.seed = clamp(Math.round(value), 0, seedLimit);
        edited();
      }
    }

    return [
      createNumberField("Seed", seed, reseed, seedLimit),
      actionRow("Reroll", () => reseed(newSeed())),
      ...metas.flatMap((meta: Meta) => {
        const table: () => DiceTable = (): DiceTable =>
          tableOf(creations, current().id, name, meta);

        return meta.kind === "number"
          ? numberTable(table, meta)
          : meta.kind === "choice"
            ? choiceTable(table, meta)
            : cardTable(table, meta, meta.cardKind!);
      }),
    ];
  }

  function rarityOptions<T>(list: Array<Rarity<T>>): () => Array<Option<T>> {
    return () =>
      list.map((entry: Rarity<T>) => ({
        value: entry.value,
        label: entry.label,
      }));
  }

  function slider(
    name: Name,
    min: number,
    max: number | (() => number),
    step: number,
    get: () => number,
    set: (value: number) => void,
  ): Control {
    const control: Control = createSlider(
      name,
      min,
      max,
      step,
      get,
      (value: number) => {
        set(value);
        changed();
        refresh();
      },
    );

    pending.push({
      name: nameText(name),
      kind: "number",
      min: min,
      max: typeof max === "number" ? () => max : max,
      step: step,
      options: () => new Array(),
      get: get,
      set: (value: unknown) => set(value as number),
      view: control.view,
      cardKind: null,
    });

    return control;
  }

  function choice<T>(
    name: string,
    options: () => Array<Option<T>>,
    get: () => T,
    set: (value: T) => void,
    kind?: Kind,
  ): Control {
    function apply(value: T): void {
      set(value);
      changed();
      refresh();
    }

    const control: Control = createChoice(
      name,
      options,
      get,
      apply,
      kind === undefined
        ? undefined
        : () => browse(name, kind, options(), get(), apply),
    );

    pending.push({
      name: name,
      kind: kind === undefined ? "choice" : "cards",
      min: 0,
      max: () => 0,
      step: 1,
      options: options as () => Array<Option<unknown>>,
      get: get,
      set: (value: unknown) => set(value as T),
      view: control.view,
      cardKind: kind ?? null,
    });

    return control;
  }

  function colors(
    name: string,
    list: Array<string>,
    get: () => string,
    set: (value: string) => void,
  ): Control {
    const control: Control = createColors(name, list, get, (value: string) => {
      set(value);
      changed();
    });

    pending.push({
      name: name,
      kind: "choice",
      min: 0,
      max: () => 0,
      step: 1,
      options: () =>
        list.map((color: string) => ({ value: color, label: color })),
      get: get,
      set: (value: unknown) => set(value as string),
      view: control.view,
      cardKind: null,
    });

    return control;
  }

  function section(
    name: string,
    list: Array<Control>,
    visible: () => boolean = () => true,
    dice: boolean = true,
  ): Array<Control> {
    const key: number = sections++;
    const open: () => boolean = () => sectionOpen.get(key) ?? false;
    const metas: Array<Meta> = pending;
    const toggleOpen: () => void = () => {
      sectionOpen.set(key, !open());
      refresh();
    };

    pending = new Array();

    if (!dice || metas.length === 0) {
      return createSection(name, list, open, toggleOpen, visible);
    }

    const owned: SectionMeta = { name: name, metas: metas };
    const views: Set<unknown> = new Set(metas.map((meta: Meta) => meta.view));
    const diced: () => boolean = () => isDiced(creations, current().id, name);

    claimed.push(owned);

    return createSection(
      name,
      [
        ...list.map((control: Control) => {
          const shown: (() => boolean) | undefined = control.shown;

          return views.has(control.view)
            ? { ...control, shown: () => !diced() && (shown?.() ?? true) }
            : control;
        }),
        ...diceRows(name, metas).map((control: Control) => {
          const shown: (() => boolean) | undefined = control.shown;

          return { ...control, shown: () => diced() && (shown?.() ?? true) };
        }),
      ],
      open,
      toggleOpen,
      visible,
      {
        on: diced,
        toggle: () => {
          toggleDice(creations, current().id, owned);
          sectionOpen.set(key, true);
          edited();
        },
      },
    );
  }

  function actionRow(
    first: string,
    firstAction: () => void,
    second?: string,
    secondAction?: () => void,
  ): Control {
    const row: Container = new Container();
    const left: Chip = createChip(first, actionWidth, firstAction);

    left.view.y = (rowHeight - chipHeight) / 2;
    row.addChild(left.view);

    if (second !== undefined && secondAction !== undefined) {
      const right: Chip = createChip(second, actionWidth, secondAction);

      right.view.position.set(actionWidth + actionGap, left.view.y);
      row.addChild(right.view);
    }

    return { view: row, refresh: () => undefined };
  }

  function vector(
    name: string,
    min: number,
    max: number,
    step: number,
    get: () => Vector,
    set: (value: Vector) => void,
  ): Control {
    return createVector(name, min, max, step, get, (value: Vector) => {
      set(value);
      changed();
      refresh();
    });
  }

  function waveRows<T>(
    list: () => Array<Wave<T>>,
    amplitude: (name: string, get: () => T, set: (value: T) => void) => Control,
    blank: () => T,
    visible: () => boolean,
    moved: () => void = () => {},
  ): Array<Control> {
    return [
      ...waveNames.flatMap((name: string, order: number) => {
        const shown: () => boolean = () => visible() && list().length > order;

        return [
          {
            ...amplitude(
              name + " amplitude",
              () => list()[order]?.amplitude ?? blank(),
              (value: T) => {
                list()[order]!.amplitude = value;
                moved();
              },
            ),
            shown: shown,
          },
          {
            ...slider(
              name + " frequency",
              frequencyMin,
              frequencyMax,
              frequencyStep,
              () => list()[order]?.frequency ?? waveFrequency,
              (value: number) => {
                list()[order]!.frequency = value;
                moved();
              },
            ),
            shown: shown,
          },
          {
            ...slider(
              name + " phase",
              -phaseLimit,
              phaseLimit,
              5,
              () => list()[order]?.phase ?? 0,
              (value: number) => {
                list()[order]!.phase = value;
                moved();
              },
            ),
            shown: shown,
          },
          {
            ...slider(
              name + " phase shift",
              -phaseShiftLimit,
              phaseShiftLimit,
              5,
              () => list()[order]?.phaseShift ?? 0,
              (value: number) => {
                list()[order]!.phaseShift = value;
                moved();
              },
            ),
            shown: shown,
          },
        ];
      }),
      {
        ...derivativeActions(list, waveNames, () => ({
          amplitude: blank(),
          frequency: waveFrequency,
          phase: 0,
          phaseShift: 0,
        })),
        shown: visible,
      },
    ];
  }

  function derivativeActions<T>(
    list: () => Array<T>,
    names: Array<string>,
    blank: () => T,
  ): Control {
    const row: Container = new Container();
    const width: number = actionWidth;
    const add: Chip = createChip("", width, () => {
      if (list().length >= names.length) {
        return;
      }

      list().push(blank());
      changed();
      refresh();
    });
    const remove: Chip = createChip("", width, () => {
      list().pop();
      changed();
      refresh();
    });

    add.view.y = (rowHeight - chipHeight) / 2;
    remove.view.position.set(width + actionGap, add.view.y);
    row.addChild(add.view, remove.view);

    return {
      view: row,
      refresh: () => {
        const count: number = list().length;

        add.view.visible = count < names.length;
        remove.view.visible = count > 0;
        add.label.text = "ADD " + (names[count] ?? "").toUpperCase();
        remove.label.text = "REMOVE " + (names[count - 1] ?? "").toUpperCase();
        remove.view.x = add.view.visible ? width + actionGap : 0;
      },
    };
  }

  function buttonRow(name: string, action: () => void): Control {
    const row: Container = new Container();
    const button: Chip = createChip(name, rowWidth, action);

    button.view.y = (rowHeight - chipHeight) / 2;
    row.addChild(button.view);

    return { view: row, refresh: () => undefined };
  }

  function pickCard(
    name: string,
    kinds: Array<Kind>,
    options: Array<Option<string>>,
    current: string | null,
    choose: (value: string) => void,
  ): void {
    browse(name, kinds, options, current ?? "", (value: string) => {
      choose(value);
      changed();
      refresh();
    });
  }

  return {
    claimSections: claimSections,
    pickCard: pickCard,
    rarityOptions: rarityOptions,
    slider: slider,
    choice: choice,
    colors: colors,
    section: section,
    actionRow: actionRow,
    vector: vector,
    waveRows: waveRows,
    derivativeActions: derivativeActions,
    buttonRow: buttonRow,
    sectionCount: () => sections,
    openSection: (key: number) => {
      sectionOpen.set(key, true);
    },
    closeSections: () => {
      sectionOpen.clear();
    },
  };
}

export { createKit, phaseLimit, waveAmplitude };
export type { Kit };
