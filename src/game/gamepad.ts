import type { Ticker } from "pixi.js";
import { playing } from "./input";

type Binding = {
  code: string;
  key: string;
};

const stickDeadzone: number = 0.5;
const triggerThreshold: number = 0.5;
const repeatDelay: number = 400; // ms
const repeatInterval: number = 80; // ms
const sector: number = Math.PI / 4; // rad
const leftBinding: Binding = { code: "ArrowLeft", key: "ArrowLeft" };
const rightBinding: Binding = { code: "ArrowRight", key: "ArrowRight" };
const upBinding: Binding = { code: "ArrowUp", key: "ArrowUp" };
const downBinding: Binding = { code: "ArrowDown", key: "ArrowDown" };
const directionBindings: Array<Binding> = [
  leftBinding,
  rightBinding,
  upBinding,
  downBinding,
];
const playBindings: Array<[number, Binding]> = [
  [0, { code: "KeyZ", key: "z" }],
  [1, { code: "KeyX", key: "x" }],
  [4, { code: "ShiftLeft", key: "Shift" }],
  [5, { code: "ShiftLeft", key: "Shift" }],
  [6, { code: "ShiftLeft", key: "Shift" }],
  [7, { code: "ShiftLeft", key: "Shift" }],
  [8, { code: "Escape", key: "Escape" }],
  [9, { code: "Enter", key: "Enter" }],
];
const menuBindings: Array<[number, Binding]> = [
  [0, { code: "Enter", key: "Enter" }],
  [1, { code: "Escape", key: "Escape" }],
];
const advanceButton: number = 0;
const padUp: number = 12;
const padDown: number = 13;
const padLeft: number = 14;
const padRight: number = 15;

function send(type: string, binding: Binding, repeat: boolean): void {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      code: binding.code,
      key: binding.key,
      repeat: repeat,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function buttonDown(pad: Gamepad, index: number): boolean {
  const button: GamepadButton | undefined = pad.buttons[index];

  return (
    button !== undefined && (button.pressed || button.value > triggerThreshold)
  );
}

function stickDirection(pad: Gamepad): [number, number] {
  const x: number = pad.axes[0] ?? 0;
  const y: number = pad.axes[1] ?? 0;

  if (Math.hypot(x, y) < stickDeadzone) {
    return [0, 0];
  }

  const angle: number = Math.round(Math.atan2(y, x) / sector) * sector;

  return [Math.round(Math.cos(angle)), Math.round(Math.sin(angle))];
}

function padDirection(pad: Gamepad): [number, number] {
  const x: number =
    (buttonDown(pad, padRight) ? 1 : 0) - (buttonDown(pad, padLeft) ? 1 : 0);
  const y: number =
    (buttonDown(pad, padDown) ? 1 : 0) - (buttonDown(pad, padUp) ? 1 : 0);

  if (x !== 0 || y !== 0) {
    return [x, y];
  }

  return stickDirection(pad);
}

function readHeld(bindings: Array<[number, Binding]>): Set<Binding> {
  const held: Set<Binding> = new Set();

  for (const pad of navigator.getGamepads()) {
    if (pad === null || !pad.connected) {
      continue;
    }

    const [x, y]: [number, number] = padDirection(pad);

    if (x < 0) {
      held.add(leftBinding);
    } else if (x > 0) {
      held.add(rightBinding);
    }

    if (y < 0) {
      held.add(upBinding);
    } else if (y > 0) {
      held.add(downBinding);
    }

    for (const [index, binding] of bindings) {
      if (buttonDown(pad, index)) {
        held.add(binding);
      }
    }
  }

  return held;
}

function advanceDown(): boolean {
  for (const pad of navigator.getGamepads()) {
    if (pad !== null && pad.connected && buttonDown(pad, advanceButton)) {
      return true;
    }
  }

  return false;
}

function anyInput(): boolean {
  for (const pad of navigator.getGamepads()) {
    if (pad === null || !pad.connected) {
      continue;
    }

    const [x, y]: [number, number] = stickDirection(pad);

    if (x !== 0 || y !== 0) {
      return true;
    }

    for (let index = 0; index < pad.buttons.length; index++) {
      if (buttonDown(pad, index)) {
        return true;
      }
    }
  }

  return false;
}

function startGamepad(
  ticker: Ticker,
  advance: () => boolean,
  touched: () => void,
): void {
  const previous: Set<string> = new Set();
  const repeats: Map<string, number> = new Map();
  let buttonHeld: boolean = false;
  let swallowed: boolean = false;

  ticker.add((current: Ticker) => {
    if (anyInput()) {
      touched();
    }

    const menu: boolean = !playing();
    const held: Set<Binding> = readHeld(menu ? menuBindings : playBindings);
    const codes: Set<string> = new Set();
    const button: boolean = menu && advanceDown();

    if (button && !buttonHeld) {
      swallowed = advance();
    }

    buttonHeld = button;

    if (swallowed) {
      if (held.size > 0) {
        return;
      }

      swallowed = false;
    }

    for (const binding of held) {
      if (codes.has(binding.code)) {
        continue;
      }

      codes.add(binding.code);

      if (!previous.has(binding.code)) {
        send("keydown", binding, false);
        repeats.set(binding.code, repeatDelay);
        continue;
      }

      if (!directionBindings.includes(binding)) {
        continue;
      }

      const left: number = (repeats.get(binding.code) ?? 0) - current.deltaMS;

      if (left <= 0) {
        send("keydown", binding, true);
        repeats.set(binding.code, left + repeatInterval);
      } else {
        repeats.set(binding.code, left);
      }
    }

    for (const code of previous) {
      if (!codes.has(code)) {
        send("keyup", { code: code, key: keyFor(code) }, false);
        repeats.delete(code);
      }
    }

    previous.clear();

    for (const code of codes) {
      previous.add(code);
    }
  });
}

function rumble(strength: number, duration: number): void {
  for (const pad of navigator.getGamepads()) {
    void pad?.vibrationActuator
      ?.playEffect("dual-rumble", {
        duration: duration,
        strongMagnitude: strength,
        weakMagnitude: Math.min(strength * 1.5, 1),
      })
      .catch(() => undefined);
  }
}

function keyFor(code: string): string {
  const binding: Binding | undefined = [
    ...directionBindings,
    ...playBindings.map((entry: [number, Binding]) => entry[1]),
    ...menuBindings.map((entry: [number, Binding]) => entry[1]),
  ].find((candidate: Binding) => candidate.code === code);

  return binding?.key ?? code;
}

export { startGamepad, rumble };
