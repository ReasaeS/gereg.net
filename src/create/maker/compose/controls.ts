import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type FederatedPointerEvent,
  type FederatedWheelEvent,
  type Point,
} from "pixi.js";
import { createText } from "../../../ui/text";
import { createGlide, mix, type Glide } from "../../../ui/motion";
import type { Option } from "../../../ui/widgets";

type Button = {
  view: Container;
  label: Text;
  paint: () => void;
};

type Knob = {
  view: Container;
  refresh: () => void;
};

const buttonHeight: number = 14; // units
const buttonSize: number = 8; // units
const idleColor: string = "#4a555b";
const hoverColor: string = "#5d6a71";
const litColor: string = "#ff9b3c";
const edgeColor: string = "#1f272b";
const shineColor: string = "#ffffff";
const textColor: string = "#d4dde1";
const darkText: string = "#1d1d1d";
const knobColor: string = "#262d31";
const knobEdge: string = "#59666d";
const arcColor: string = "#ff9b3c";
const trackColor: string = "#1a2023";
const capColor: string = "#a9b4b9";
const menuColor: string = "#2f383d";
const menuHover: string = "#ff9b3c";
const menuRow: number = 12; // units
const menuRows: number = 18;
const menuBottom: number = 470; // units
const menuTop: number = 8; // units
const knobDrag: number = 120; // units
const doubleTap: number = 300; // ms
const sweepStart: number = Math.PI * 0.75;
const sweepSize: number = Math.PI * 1.5;
const capHeight: number = 8; // units
const capWidth: number = 16; // units
const chevronSize: number = 3; // units

function createButton(
  name: string,
  width: number,
  action: () => void,
  on: () => boolean = () => false,
): Button {
  const view: Container = new Container();
  const back: Graphics = new Graphics();
  const label: Text = createText(buttonSize, "#ffffff");
  const lit: Glide = createGlide(0, draw);
  const hover: Glide = createGlide(0, draw);

  function draw(): void {
    if (back.destroyed) {
      return;
    }

    back
      .clear()
      .rect(0, 0, width, buttonHeight)
      .fill(
        mix(mix(idleColor, hoverColor, hover.value()), litColor, lit.value()),
      )
      .rect(0, 0, width, 1)
      .fill({ color: shineColor, alpha: 0.12 })
      .rect(0, 0, width, buttonHeight)
      .stroke({ color: edgeColor, width: 1, alignment: 1 });
    label.tint = mix(textColor, darkText, lit.value());
  }

  function paint(): void {
    lit.set(on() ? 1 : 0);
  }

  label.text = name.toUpperCase();
  label.anchor.set(0.5);
  label.position.set(width / 2, buttonHeight / 2);
  view.addChild(back, label);
  view.eventMode = "static";
  view.cursor = "pointer";
  view.hitArea = new Rectangle(0, 0, width, buttonHeight);
  view.on("pointertap", action);
  view.on("pointerover", () => hover.set(1));
  view.on("pointerout", () => hover.set(0));
  lit.snap(0);
  draw();

  return { view: view, label: label, paint: paint };
}

function createKnob(
  radius: number,
  min: number,
  max: number,
  step: number,
  rest: number,
  get: () => number,
  set: (value: number) => void,
  centered: boolean = false,
): Knob {
  const view: Container = new Container();
  const body: Graphics = new Graphics();
  const shown: Glide = createGlide(0, draw);
  const hover: Glide = createGlide(0, draw);
  let dragging: boolean = false;
  let startY: number = 0;
  let startValue: number = 0;
  let lastTap: number = 0;
  let placed: boolean = false;

  function share(value: number): number {
    return Math.min(Math.max((value - min) / (max - min), 0), 1);
  }

  function draw(): void {
    const angle: number = sweepStart + sweepSize * shown.value();
    const from: number = centered ? sweepStart + sweepSize / 2 : sweepStart;
    const inner: number = radius * 0.62;

    if (body.destroyed) {
      return;
    }

    body
      .clear()
      .circle(0, 0, radius)
      .fill(mix(knobColor, "#323b40", hover.value()))
      .stroke({ color: knobEdge, width: 1 })
      .moveTo(
        Math.cos(Math.min(from, angle)) * (radius - 1.5),
        Math.sin(Math.min(from, angle)) * (radius - 1.5),
      )
      .arc(0, 0, radius - 1.5, Math.min(from, angle), Math.max(from, angle))
      .stroke({ color: arcColor, width: 2 })
      .moveTo(Math.cos(angle) * inner * 0.3, Math.sin(angle) * inner * 0.3)
      .lineTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
      .stroke({ color: textColor, width: 1.5 });
  }

  function refresh(): void {
    if (placed) {
      shown.set(share(get()));
    } else {
      placed = true;
      shown.snap(share(get()));
    }
  }

  function apply(value: number): void {
    set(Math.min(Math.max(Math.round(value / step) * step, min), max));
    refresh();
  }

  view.eventMode = "static";
  view.cursor = "ns-resize";
  view.hitArea = new Rectangle(-radius, -radius, radius * 2, radius * 2);
  view.on("pointerdown", (event: FederatedPointerEvent) => {
    const now: number = performance.now();

    if (now - lastTap < doubleTap) {
      apply(rest);
      lastTap = 0;
      return;
    }

    lastTap = now;
    dragging = true;
    startY = event.global.y;
    startValue = get();
  });
  view.on("globalpointermove", (event: FederatedPointerEvent) => {
    if (!dragging) {
      return;
    }

    const scale: number = view.worldTransform.d || 1;

    apply(
      startValue + ((startY - event.global.y) / scale / knobDrag) * (max - min),
    );
  });
  view.on("pointerup", () => {
    dragging = false;
  });
  view.on("pointerupoutside", () => {
    dragging = false;
  });
  view.on("wheel", (event: FederatedWheelEvent) => {
    apply(get() - Math.sign(event.deltaY) * step);
  });
  view.on("pointerover", () => hover.set(1));
  view.on("pointerout", () => hover.set(0));
  view.addChild(body);
  draw();

  return { view: view, refresh: refresh };
}

function createFader(
  height: number,
  min: number,
  max: number,
  rest: number,
  get: () => number,
  set: (value: number) => void,
): Knob {
  const view: Container = new Container();
  const track: Graphics = new Graphics();
  const cap: Graphics = new Graphics();
  const shown: Glide = createGlide(0, draw);
  let dragging: boolean = false;
  let lastTap: number = 0;
  let placed: boolean = false;

  function draw(): void {
    const y: number = height * (1 - shown.value());

    if (track.destroyed) {
      return;
    }

    track
      .clear()
      .rect(-1.5, 0, 3, height)
      .fill(trackColor)
      .rect(-1.5, y, 3, height - y)
      .fill({ color: arcColor, alpha: 0.6 });
    cap.position.set(0, y);
  }

  function refresh(): void {
    const amount: number = Math.min(
      Math.max((get() - min) / (max - min), 0),
      1,
    );

    if (placed) {
      shown.set(amount);
    } else {
      placed = true;
      shown.snap(amount);
    }
  }

  function pick(event: FederatedPointerEvent): void {
    const local: Point = view.toLocal(event.global);
    const amount: number = Math.min(Math.max(1 - local.y / height, 0), 1);

    set(min + (max - min) * amount);
    refresh();
  }

  cap
    .rect(-capWidth / 2, -capHeight / 2, capWidth, capHeight)
    .fill(capColor)
    .rect(-capWidth / 2, -0.5, capWidth, 1)
    .fill(edgeColor);
  view.eventMode = "static";
  view.cursor = "ns-resize";
  view.hitArea = new Rectangle(
    -capWidth / 2,
    -capHeight / 2,
    capWidth,
    height + capHeight,
  );
  view.on("pointerdown", (event: FederatedPointerEvent) => {
    const now: number = performance.now();

    if (now - lastTap < doubleTap) {
      set(rest);
      refresh();
      lastTap = 0;
      return;
    }

    lastTap = now;
    dragging = true;
    pick(event);
  });
  view.on("globalpointermove", (event: FederatedPointerEvent) => {
    if (dragging) {
      pick(event);
    }
  });
  view.on("pointerup", () => {
    dragging = false;
  });
  view.on("pointerupoutside", () => {
    dragging = false;
  });
  view.addChild(track, cap);
  draw();

  return { view: view, refresh: refresh };
}

function createDropdown<T>(
  width: number,
  options: () => Array<Option<T>>,
  get: () => T,
  set: (value: T) => void,
  overlay: () => Container,
): Button {
  const button: Button = createButton("", width, open);
  const chevron: Graphics = new Graphics()
    .poly([0, 0, chevronSize * 2, 0, chevronSize, chevronSize])
    .fill(textColor);
  const menu: Container = new Container();
  const fade: Glide = createGlide(0, (amount: number) => {
    if (menu.destroyed) {
      return;
    }

    menu.alpha = amount;
    menu.visible = amount > 0;
  });

  function paint(): void {
    button.label.text = (
      options().find((option: Option<T>) => option.value === get())?.label ??
      "-"
    ).toUpperCase();
  }

  function close(): void {
    menu.eventMode = "none";
    fade.set(0);
  }

  function open(): void {
    const list: Array<Option<T>> = options();
    const layer: Container = overlay();
    const corner: Point = layer.toLocal(button.view.getGlobalPosition());
    const columns: number = Math.ceil(list.length / menuRows);
    const rows: number = Math.min(list.length, menuRows);
    const catcher: Graphics = new Graphics()
      .rect(-2000, -2000, 5000, 5000)
      .fill({ color: "#000000", alpha: 0.001 });
    const back: Graphics = new Graphics()
      .rect(0, 0, width * columns, rows * menuRow)
      .fill(menuColor)
      .stroke({ color: edgeColor, width: 1, alignment: 1 });

    for (const child of menu.removeChildren()) {
      child.destroy({ children: true });
    }

    catcher.eventMode = "static";
    catcher.on("pointerdown", close);
    menu.addChild(catcher, back);
    list.forEach((option: Option<T>, index: number) => {
      const row: Container = new Container();
      const shade: Graphics = new Graphics();
      const text: Text = createText(buttonSize, "#ffffff");
      const chosen: boolean = option.value === get();
      const glow: Glide = createGlide(0, (amount: number) => {
        if (shade.destroyed) {
          return;
        }

        shade
          .clear()
          .rect(0, 0, width, menuRow)
          .fill({
            color: menuHover,
            alpha: amount * 0.85 + (chosen ? 0.25 : 0),
          });
        text.tint = mix(textColor, darkText, amount);
      });

      text.text = option.label.toUpperCase();
      text.anchor.set(0, 0.5);
      text.position.set(4, menuRow / 2);
      row.addChild(shade, text);
      row.position.set(
        Math.floor(index / menuRows) * width,
        (index % menuRows) * menuRow,
      );
      row.eventMode = "static";
      row.cursor = "pointer";
      row.hitArea = new Rectangle(0, 0, width, menuRow);
      row.on("pointerover", () => glow.set(1));
      row.on("pointerout", () => glow.set(0));
      row.on("pointertap", () => {
        set(option.value);
        paint();
        close();
      });
      glow.snap(0);
      menu.addChild(row);
    });
    menu.position.set(
      corner.x,
      Math.max(
        Math.min(corner.y + buttonHeight, menuBottom - rows * menuRow),
        menuTop,
      ),
    );
    catcher.position.set(-menu.x, -menu.y);
    layer.addChild(menu);
    menu.eventMode = "static";
    fade.snap(0);
    fade.set(1);
  }

  chevron.position.set(width - chevronSize * 2 - 4, buttonHeight / 2 - 1.5);
  button.view.addChild(chevron);
  button.label.anchor.set(0, 0.5);
  button.label.x = 5;
  menu.eventMode = "none";

  return {
    view: button.view,
    label: button.label,
    paint: () => {
      button.paint();
      paint();
    },
  };
}

export { buttonHeight, createButton, createKnob, createFader, createDropdown };
export type { Button, Knob };
