import type { Vector } from "../create/types";

type Keyboard = {
  pressed: (keys: Array<string>) => boolean;
  clear: () => void;
};

type Binding = "left" | "right" | "up" | "down" | "focus" | "shot" | "bomb";

type BindingListener = () => void;

const leftKeys: Array<string> = new Array();
const rightKeys: Array<string> = new Array();
const upKeys: Array<string> = new Array();
const downKeys: Array<string> = new Array();
const focusKeys: Array<string> = new Array();
const shotKeys: Array<string> = new Array();
const bombKeys: Array<string> = new Array();
const playKeys: Array<string> = new Array();
const players: Array<() => boolean> = new Array();
const bindingStorageKey: string = "geregnet.controls";
const bindingList: Array<Binding> = [
  "left",
  "right",
  "up",
  "down",
  "focus",
  "shot",
  "bomb",
];
const bindingNames: Map<Binding, string> = new Map([
  ["left", "move left"],
  ["right", "move right"],
  ["up", "move up"],
  ["down", "move down"],
  ["focus", "focus"],
  ["shot", "shoot"],
  ["bomb", "bomb"],
]);
const defaultBindings: Map<Binding, string> = new Map([
  ["left", "KeyA"],
  ["right", "KeyD"],
  ["up", "KeyW"],
  ["down", "KeyS"],
  ["focus", "ShiftLeft"],
  ["shot", "KeyZ"],
  ["bomb", "KeyX"],
]);
const fixedKeys: Map<Binding, Array<string>> = new Map([
  ["left", ["ArrowLeft"]],
  ["right", ["ArrowRight"]],
  ["up", ["ArrowUp"]],
  ["down", ["ArrowDown"]],
  ["focus", new Array()],
  ["shot", new Array()],
  ["bomb", new Array()],
]);
const bindingKeys: Map<Binding, Array<string>> = new Map([
  ["left", leftKeys],
  ["right", rightKeys],
  ["up", upKeys],
  ["down", downKeys],
  ["focus", focusKeys],
  ["shot", shotKeys],
  ["bomb", bombKeys],
]);
const reservedKeys: Array<string> = [
  "Escape",
  "F7",
  "F8",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Enter",
  "NumpadEnter",
  "Tab",
  "Backspace",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "CapsLock",
];
const shiftKeys: Array<string> = ["ShiftLeft", "ShiftRight"];
const bindingListeners: Array<BindingListener> = new Array();
const bindings: Map<Binding, string> = new Map(defaultBindings);

function loadBindings(): void {
  try {
    const saved: Record<string, string> = JSON.parse(
      localStorage.getItem(bindingStorageKey) ?? "{}",
    ) as Record<string, string>;
    const used: Set<string> = new Set();

    for (const binding of bindingList) {
      const code: string | undefined = saved[binding];

      if (
        typeof code === "string" &&
        !reservedKeys.includes(code) &&
        !used.has(code)
      ) {
        bindings.set(binding, code);
      }

      used.add(bindings.get(binding)!);
    }

    if (used.size < bindingList.length) {
      for (const binding of bindingList) {
        bindings.set(binding, defaultBindings.get(binding)!);
      }
    }
  } catch {
    console.warn("Could not load the controls");
  }
}

function saveBindings(): void {
  try {
    localStorage.setItem(
      bindingStorageKey,
      JSON.stringify(Object.fromEntries(bindings)),
    );
  } catch {
    console.warn("Could not save the controls");
  }
}

function applyBindings(): void {
  playKeys.length = 0;

  for (const binding of bindingList) {
    const keys: Array<string> = bindingKeys.get(binding)!;
    const code: string = bindings.get(binding)!;

    keys.length = 0;
    keys.push(...fixedKeys.get(binding)!, code);

    if (shiftKeys.includes(code)) {
      keys.push(...shiftKeys.filter((key: string) => key !== code));
    }

    playKeys.push(...keys);
  }

  for (const listener of bindingListeners) {
    listener();
  }
}

function getBinding(binding: Binding): string {
  return bindings.get(binding)!;
}

function setBinding(binding: Binding, code: string): boolean {
  if (reservedKeys.includes(code)) {
    return false;
  }

  const previous: string = bindings.get(binding)!;

  for (const other of bindingList) {
    const taken: string = bindings.get(other)!;

    if (
      other !== binding &&
      (taken === code ||
        (shiftKeys.includes(taken) && shiftKeys.includes(code)))
    ) {
      bindings.set(other, previous);
    }
  }

  bindings.set(binding, code);
  saveBindings();
  applyBindings();

  return true;
}

function resetBindings(): void {
  for (const binding of bindingList) {
    bindings.set(binding, defaultBindings.get(binding)!);
  }

  saveBindings();
  applyBindings();
}

function onBindings(listener: BindingListener): void {
  bindingListeners.push(listener);
}

function keyName(code: string): string {
  if (shiftKeys.includes(code)) {
    return "SHIFT";
  }

  if (code.startsWith("Key")) {
    return code.slice(3);
  }

  if (code.startsWith("Digit")) {
    return code.slice(5);
  }

  if (code.startsWith("Numpad")) {
    return "NUM " + code.slice(6).toUpperCase();
  }

  return code.replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();
}

function bindingName(binding: Binding): string {
  return keyName(getBinding(binding));
}

loadBindings();
applyBindings();

function createKeyboard(enabled: () => boolean): Keyboard {
  const held: Set<string> = new Set();

  players.push(enabled);

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

function playing(): boolean {
  return players.some((enabled: () => boolean) => enabled());
}

function steering(pressed: (keys: Array<string>) => boolean): Vector {
  const x: number = (pressed(rightKeys) ? 1 : 0) - (pressed(leftKeys) ? 1 : 0);
  const y: number = (pressed(downKeys) ? 1 : 0) - (pressed(upKeys) ? 1 : 0);
  const scale: number = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;

  return { x: x * scale, y: y * scale };
}

export {
  bindingList,
  bindingNames,
  getBinding,
  setBinding,
  resetBindings,
  onBindings,
  keyName,
  bindingName,
  leftKeys,
  rightKeys,
  upKeys,
  downKeys,
  focusKeys,
  shotKeys,
  bombKeys,
  playKeys,
  createKeyboard,
  playing,
  steering,
};
export type { Keyboard, Binding };
