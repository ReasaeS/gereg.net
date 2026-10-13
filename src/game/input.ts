import type { Vector } from "../create/types";

type Keyboard = {
  pressed: (keys: Array<string>) => boolean;
  clear: () => void;
};

const leftKeys: Array<string> = ["ArrowLeft", "KeyA"];
const rightKeys: Array<string> = ["ArrowRight", "KeyD"];
const upKeys: Array<string> = ["ArrowUp", "KeyW"];
const downKeys: Array<string> = ["ArrowDown", "KeyS"];
const focusKeys: Array<string> = ["ShiftLeft", "ShiftRight"];
const shotKeys: Array<string> = ["KeyZ"];
const bombKeys: Array<string> = ["KeyX"];
const playKeys: Array<string> = [
  ...leftKeys,
  ...rightKeys,
  ...upKeys,
  ...downKeys,
  ...focusKeys,
  ...shotKeys,
  ...bombKeys,
];

function createKeyboard(enabled: () => boolean): Keyboard {
  const held: Set<string> = new Set();

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (
      !enabled() ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !playKeys.includes(event.code)
    ) {
      return;
    }

    held.add(event.code);
    event.preventDefault();
  });

  window.addEventListener("keyup", (event: KeyboardEvent) => {
    held.delete(event.code);
  });

  window.addEventListener("blur", () => {
    held.clear();
  });

  return {
    pressed: (keys: Array<string>) => keys.some((key: string) => held.has(key)),
    clear: () => held.clear(),
  };
}

function steering(pressed: (keys: Array<string>) => boolean): Vector {
  const x: number = (pressed(rightKeys) ? 1 : 0) - (pressed(leftKeys) ? 1 : 0);
  const y: number = (pressed(downKeys) ? 1 : 0) - (pressed(upKeys) ? 1 : 0);
  const scale: number = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;

  return { x: x * scale, y: y * scale };
}

export {
  leftKeys,
  rightKeys,
  upKeys,
  downKeys,
  focusKeys,
  shotKeys,
  bombKeys,
  playKeys,
  createKeyboard,
  steering,
};
export type { Keyboard };
