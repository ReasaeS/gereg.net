import type { Text } from "pixi.js";
import { animate } from "./motion";

type Retype = {
  set: (value: string, animated: boolean) => void;
};

const letterTime: number = 0.04; // s

function createRetype(text: Text): Retype {
  let from: string = text.text;
  let to: string = text.text;
  let changes: Array<number> = new Array();
  let elapsed: number = 0;
  let running: boolean = false;

  function show(count: number): void {
    const swapped: Set<number> = new Set(changes.slice(0, count));
    const length: number = Math.max(from.length, to.length);
    let shown: string = "";

    for (let index = 0; index < length; index++) {
      shown += swapped.has(index)
        ? (to[index] ?? "")
        : (from[index] ?? to[index] ?? "");
    }

    text.text = shown;
  }

  function step(delta: number): boolean {
    elapsed += delta;

    const count: number = Math.floor(elapsed / letterTime) + 1;

    if (count >= changes.length) {
      text.text = to;
      running = false;

      return false;
    }

    show(count);

    return true;
  }

  function set(value: string, animated: boolean): void {
    if (value === to) {
      return;
    }

    from = text.text;
    to = value;

    if (!animated) {
      text.text = to;

      return;
    }

    changes = new Array();

    for (let index = 0; index < Math.max(from.length, to.length); index++) {
      if (from[index] !== to[index]) {
        changes.push(index);
      }
    }

    elapsed = 0;
    show(1);

    if (!running) {
      running = true;
      animate(step);
    }
  }

  return { set: set };
}

export { createRetype };
export type { Retype };
