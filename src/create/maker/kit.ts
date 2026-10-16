import { Container } from "pixi.js";
import type { Vector, Wave } from "../types";
import type { Rarity } from "../rarity";
import {
  chipHeight,
  createChip,
  createChoice,
  createColors,
  createSlider,
  createVector,
  rowHeight,
  rowWidth,
  type Chip,
  type Control,
  type Option,
} from "../../ui/widgets";
import { createSection } from "../../ui/rows";

type Kit = {
  rarityOptions: <T>(list: Array<Rarity<T>>) => () => Array<Option<T>>;
  slider: (
    name: string,
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
  ) => Array<Control>;
  actionRow: (
    first: string,
    firstAction: () => void,
    second: string,
    secondAction: () => void,
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
  sectionCount: () => number;
  openSection: (key: number) => void;
  closeSections: () => void;
};

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

function createKit(changed: () => void, refresh: () => void): Kit {
  const sectionOpen: Map<number, boolean> = new Map();
  let sections: number = 0;

  function rarityOptions<T>(list: Array<Rarity<T>>): () => Array<Option<T>> {
    return () =>
      list.map((entry: Rarity<T>) => ({
        value: entry.value,
        label: entry.label,
      }));
  }

  function slider(
    name: string,
    min: number,
    max: number | (() => number),
    step: number,
    get: () => number,
    set: (value: number) => void,
  ): Control {
    return createSlider(name, min, max, step, get, (value: number) => {
      set(value);
      changed();
      refresh();
    });
  }

  function choice<T>(
    name: string,
    options: () => Array<Option<T>>,
    get: () => T,
    set: (value: T) => void,
  ): Control {
    return createChoice(name, options, get, (value: T) => {
      set(value);
      changed();
      refresh();
    });
  }

  function colors(
    name: string,
    list: Array<string>,
    get: () => string,
    set: (value: string) => void,
  ): Control {
    return createColors(name, list, get, (value: string) => {
      set(value);
      changed();
    });
  }

  function section(
    name: string,
    list: Array<Control>,
    visible: () => boolean = () => true,
  ): Array<Control> {
    const key: number = sections++;
    const open: () => boolean = () => sectionOpen.get(key) ?? false;

    return createSection(
      name,
      list,
      open,
      () => {
        sectionOpen.set(key, !open());
        refresh();
      },
      visible,
    );
  }

  function actionRow(
    first: string,
    firstAction: () => void,
    second: string,
    secondAction: () => void,
  ): Control {
    const row: Container = new Container();
    const left: Chip = createChip(first, actionWidth, firstAction);
    const right: Chip = createChip(second, actionWidth, secondAction);

    left.view.y = (rowHeight - chipHeight) / 2;
    right.view.position.set(actionWidth + actionGap, left.view.y);
    row.addChild(left.view, right.view);

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

  return {
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
