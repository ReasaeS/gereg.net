import {
  Container,
  Graphics,
  Rectangle,
  type FederatedWheelEvent,
} from "pixi.js";
import { getTheme } from "../theme/theme";
import { approach, smoothDamp, type Spring } from "../effects/tween/tween";
import {
  createHeader,
  headerHeight,
  headerSlant,
  rowHeight,
  rowWidth,
  type Control,
} from "./widgets";

type Rows = {
  view: Container;
  content: Container;
  place: (controls: Array<Control>, snap: boolean) => void;
  animate: (delta: number) => void;
  setViewport: (height: number) => void;
  top: () => void;
};

const rowSmoothing: number = 0.06; // s
const rowFade: number = 0.15; // s
const scrollSmoothing: number = 0.08; // s
const scrollBarWidth: number = 2; // units
const scrollBarGap: number = 3; // units
const scrollBarMinimum: number = 12; // units

function rowSpacing(control: Control): number {
  return control.header === true ? headerHeight : rowHeight;
}

function createSection(
  name: string,
  list: Array<Control>,
  open: () => boolean,
  toggle: () => void,
  visible: () => boolean = () => true,
): Array<Control> {
  const header: Control = createHeader(name, open, toggle);

  return [
    { ...header, shown: visible },
    ...list.map((control: Control) => {
      const shown: (() => boolean) | undefined = control.shown;

      return {
        ...control,
        shown: () => visible() && open() && (shown?.() ?? true),
      };
    }),
  ];
}

function createRows(): Rows {
  const view: Container = new Container();
  const content: Container = new Container();
  const mask: Graphics = new Graphics();
  const bar: Graphics = new Graphics();
  const scroll: Spring = { value: 0, velocity: 0 };
  const targets: Map<Container, number> = new Map();
  let controls: Array<Control> = new Array();
  let scrollTarget: number = 0;
  let contentHeight: number = 0;
  let viewportHeight: number = 1;

  function maxScroll(): number {
    return Math.max(contentHeight - viewportHeight, 0);
  }

  function place(list: Array<Control>, snap: boolean): void {
    let y: number = 0;

    for (const control of controls) {
      if (!list.includes(control)) {
        targets.delete(control.view);
      }
    }

    controls = list;

    for (const control of list) {
      const shown: boolean = control.shown?.() ?? true;

      control.view.eventMode = shown
        ? control.header === true
          ? "static"
          : "passive"
        : "none";

      if (shown) {
        if (snap || !control.view.visible) {
          control.view.y = y;
        }

        if (snap) {
          control.view.alpha = 1;
        }

        control.view.visible = true;
        targets.set(control.view, y);
        y += rowSpacing(control);
        control.refresh();
      } else {
        targets.delete(control.view);

        if (snap) {
          control.view.visible = false;
        }
      }
    }

    contentHeight = y;
  }

  function animate(delta: number): void {
    const blend: number = 1 - Math.exp(-delta / rowSmoothing);

    for (const control of controls) {
      const target: number | undefined = targets.get(control.view);
      const row: Container = control.view;

      if (target !== undefined) {
        row.y += (target - row.y) * blend;
        row.alpha = approach(row.alpha, 1, delta / rowFade);
      } else if (row.visible) {
        row.alpha = approach(row.alpha, 0, delta / rowFade);
        row.visible = row.alpha > 0;
      }
    }

    scrollTarget = Math.min(scrollTarget, maxScroll());
    smoothDamp(scroll, scrollTarget, scrollSmoothing, delta);
    content.y = -scroll.value;
    bar.clear();

    if (maxScroll() <= 0) {
      return;
    }

    const length: number = Math.max(
      (viewportHeight / contentHeight) * viewportHeight,
      scrollBarMinimum,
    );
    const offset: number =
      (scroll.value / maxScroll()) * (viewportHeight - length);

    bar
      .rect(rowWidth + scrollBarGap, 0, scrollBarWidth, viewportHeight)
      .fill({ color: getTheme().menuSelected, alpha: 0.6 })
      .rect(rowWidth + scrollBarGap, offset, scrollBarWidth, length)
      .fill(getTheme().highlight);
  }

  function setViewport(height: number): void {
    viewportHeight = height;
    mask
      .clear()
      .rect(-headerSlant, 0, rowWidth + headerSlant * 2, viewportHeight)
      .fill(0xffffff);
    view.hitArea = new Rectangle(0, 0, rowWidth, viewportHeight);
    scrollTarget = Math.min(scrollTarget, maxScroll());
  }

  function top(): void {
    scrollTarget = 0;
    scroll.value = 0;
    scroll.velocity = 0;
  }

  content.mask = mask;
  view.addChild(content, mask, bar);
  view.eventMode = "static";
  view.on("wheel", (event: FederatedWheelEvent) => {
    scrollTarget = Math.min(
      Math.max(scrollTarget + event.deltaY / view.worldTransform.d, 0),
      maxScroll(),
    );
  });

  return {
    view: view,
    content: content,
    place: place,
    animate: animate,
    setViewport: setViewport,
    top: top,
  };
}

export { createRows, createSection };
export type { Rows };
