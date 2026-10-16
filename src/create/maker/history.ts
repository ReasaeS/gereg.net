import type { Creations } from "../types";
import { usedFiles } from "../storage";
import type { Cursor } from "./studio";

type Place = {
  tab: string;
  selected: number;
  cursor: Cursor;
};

type Snapshot = {
  data: string;
  place: Place;
  time: number; // ms
};

type History = {
  begin: () => void;
  record: () => void;
  undo: () => Place | null;
  redo: () => Place | null;
  finish: () => void;
  files: () => Set<string>;
};

const historyLimit: number = 100;
const mergeTime: number = 600; // ms

function createHistory(creations: Creations, place: () => Place): History {
  let stack: Array<Snapshot> = new Array();
  let index: number = -1;
  let restoring: boolean = false;

  function snapshot(): Snapshot {
    return {
      data: JSON.stringify(creations),
      place: place(),
      time: performance.now(),
    };
  }

  function begin(): void {
    stack = [snapshot()];
    index = 0;
  }

  function record(): void {
    if (restoring || index < 0) {
      return;
    }

    const next: Snapshot = snapshot();
    const top: Snapshot = stack[index]!;

    if (next.data === top.data) {
      return;
    }

    stack.length = index + 1;

    if (index > 0 && next.time - top.time < mergeTime) {
      top.data = next.data;
      top.place = next.place;
      top.time = next.time;
      return;
    }

    stack.push(next);
    index++;

    if (stack.length > historyLimit) {
      stack.shift();
      index--;
    }
  }

  function restore(target: number): Place | null {
    const chosen: Snapshot | undefined = stack[target];

    if (chosen === undefined) {
      return null;
    }

    const parsed: Creations = JSON.parse(chosen.data) as Creations;

    restoring = true;
    index = target;

    for (const key of Object.keys(creations) as Array<keyof Creations>) {
      const list: Array<unknown> = creations[key] as Array<unknown>;

      list.splice(0, list.length, ...(parsed[key] as Array<unknown>));
    }

    return {
      tab: chosen.place.tab,
      selected: chosen.place.selected,
      cursor: { ...chosen.place.cursor },
    };
  }

  function files(): Set<string> {
    const used: Set<string> = new Set();

    for (const value of stack) {
      for (const id of usedFiles(JSON.parse(value.data) as Creations)) {
        used.add(id);
      }
    }

    return used;
  }

  return {
    begin: begin,
    record: record,
    undo: () => (index > 0 ? restore(index - 1) : null),
    redo: () => (index < stack.length - 1 ? restore(index + 1) : null),
    finish: () => {
      restoring = false;
    },
    files: files,
  };
}

export { createHistory };
export type { History, Place };
