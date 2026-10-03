import {
  Assets,
  Container,
  Graphics,
  Point,
  Rectangle,
  Text,
  type Application,
  type Ticker,
} from "pixi.js";
import {
  cubicBezier,
  springStep,
  tween,
  type Easing,
  type Spring,
} from "../effects/tween/tween";
import { getTheme } from "../theme/theme";

const fontPath: string = "./fonts/BarlowCondensed-BlackItalic.ttf";
const fontFamily: Array<string> = [
  "Barlow Condensed",
  "Arial Black",
  "Impact",
  "sans-serif",
];
const fontSize: number = 132; // px
const menuLeft: number = 52; // vw
const menuTop: number = 20; // vh
const menuReach: number = 44; // vw
const menuReference: number = 1000; // px
const menuMinScale: number = 0.4;
const menuMaxScale: number = 1.2;
const menuTilt: number = -0.18; // rad
const itemSpacing: number = 122; // px
const itemShift: number = 46; // px
const idleAlpha: number = 0.9;
const shadowColor: string = "#020b30";
const shadowDistance: number = 9; // px
const highlightPadding: number = 30; // px
const selectScale: number = 1.14;
const springFrequency: number = 4.5; // Hz
const springDamping: number = 0.45;
const maxDelta: number = 0.05; // s
const enterDuration: number = 420; // ms
const enterStagger: number = 70; // ms
const enterDistance: number = 1200; // px
const enterEasing: Easing = cubicBezier(0.34, 1.56, 0.64, 1);
const bobAmount: number = 4; // px
const bobSpeed: number = 0.35; // Hz

const names: Array<string> = ["play", "customise", "create", "config"];

type MenuItem = {
  name: string;
  view: Container;
  label: Text;
  scale: Spring;
  enter: number; // px
  baseX: number; // px
  baseY: number; // px
};

type Highlight = {
  x: Spring;
  y: Spring;
  width: Spring;
};

const items: Array<MenuItem> = new Array();
const highlight: Highlight = {
  x: { value: 0, velocity: 0 },
  y: { value: 0, velocity: 0 },
  width: { value: 0, velocity: 0 },
};

let selected: number = 0;
let active: boolean = false;

function navigate(name: string): void {
  document.dispatchEvent(new CustomEvent<string>("navigate", { detail: name }));
}

function selectedPoint(): Point | null {
  const item: MenuItem | undefined = items[selected];

  if (item === undefined || !item.view.parent?.visible) {
    return null;
  }

  return item.view.parent.toGlobal(
    new Point(item.view.x - highlightPadding * 1.4, item.view.y),
  );
}

function select(index: number): void {
  selected = (index + items.length) % items.length;
}

function confirm(): void {
  if (active) {
    navigate(items[selected]!.name);
  }
}

function createItem(name: string, index: number): MenuItem {
  const view: Container = new Container();
  const label: Text = new Text({
    text: name.toUpperCase(),
    style: {
      fontFamily: fontFamily,
      fontSize: fontSize,
      fontStyle: "italic",
      fontWeight: "900",
      fill: 0xffffff,
      padding: shadowDistance * 2,
      dropShadow: {
        color: shadowColor,
        alpha: 0.85,
        blur: 0,
        distance: shadowDistance,
        angle: Math.PI / 3,
      },
    },
  });
  const item: MenuItem = {
    name: name,
    view: view,
    label: label,
    scale: { value: 1, velocity: 0 },
    enter: enterDistance,
    baseX: itemShift * index,
    baseY: itemSpacing * index,
  };

  label.anchor.set(0, 0.5);
  view.addChild(label);
  view.alpha = 0;
  view.hitArea = new Rectangle(
    -highlightPadding,
    -label.height / 2,
    label.width + highlightPadding * 2,
    label.height,
  );
  view.eventMode = "static";
  view.cursor = "pointer";
  view.interactiveChildren = false;

  view.on("pointerover", () => select(index));
  view.on("pointertap", () => {
    select(index);
    confirm();
  });

  return item;
}

function drawHighlight(graphics: Graphics, height: number): void {
  const x: number = highlight.x.value;
  const y: number = highlight.y.value;
  const width: number = highlight.width.value;
  const left: number = x - highlightPadding * 1.4;
  const right: number = x + width + highlightPadding * 1.8;
  const top: number = y - height / 2 + 4;
  const bottom: number = y + height / 2 - 6;

  graphics
    .clear()
    .poly([
      left + 22,
      top + 18,
      right + 30,
      top - 2,
      right + 14,
      bottom + 16,
      left - 8,
      bottom + 24,
    ])
    .fill(getTheme().accent)
    .poly([
      left,
      top + 8,
      right,
      top - 8,
      right - 16,
      bottom + 2,
      left + 12,
      bottom + 10,
    ])
    .fill(getTheme().highlight);
}

function menuWidth(): number {
  let width: number = 0;

  for (let index = 0; index < items.length; index++) {
    const item: MenuItem = items[index]!;
    width = Math.max(
      width,
      item.baseX + item.label.width * selectScale + highlightPadding * 3,
    );
  }

  return width;
}

function resetButtons(): void {
  for (let index = 0; index < items.length; index++) {
    items[index]!.enter = enterDistance;
    items[index]!.view.alpha = 0;
  }
}

function enterButtons(ticker: Ticker): Promise<void> {
  const total: number = enterDuration + enterStagger * (items.length - 1);

  return tween(ticker, total, (progress: number) => {
    for (let index = 0; index < items.length; index++) {
      const item: MenuItem = items[index]!;
      const local: number = Math.min(
        Math.max((progress * total - index * enterStagger) / enterDuration, 0),
        1,
      );

      item.enter = enterDistance * (1 - enterEasing(local));
      item.view.alpha = Math.min(local * 2, 1);
    }
  });
}

function setButtonsActive(value: boolean): void {
  active = value;
}

function buttonFaces(): Array<Container> {
  return items.map((item: MenuItem) => item.view);
}

async function createButtons(app: Application): Promise<Container> {
  await Assets.load({
    src: fontPath,
    data: { family: "Barlow Condensed", weights: ["900"], style: "italic" },
  });

  const root: Container = new Container();
  const marker: Graphics = new Graphics();
  let time: number = 0;

  root.addChild(marker);

  for (let index = 0; index < names.length; index++) {
    const item: MenuItem = createItem(names[index]!, index);
    items.push(item);
    root.addChild(item.view);
  }

  const width: number = menuWidth();
  const textHeight: number = items[0]?.label.height ?? fontSize;

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!active) {
      return;
    }

    if (event.code === "ArrowDown" || event.code === "KeyS") {
      select(selected + 1);
    } else if (event.code === "ArrowUp" || event.code === "KeyW") {
      select(selected - 1);
    } else if (event.code === "Enter" || event.code === "Space") {
      confirm();
    } else {
      return;
    }

    event.preventDefault();
  });

  app.ticker.add((ticker: Ticker) => {
    const delta: number = Math.min(ticker.deltaMS / 1000, maxDelta);
    const screenWidth: number = app.screen.width;
    const screenHeight: number = app.screen.height;
    const scale: number = Math.min(
      Math.max(screenHeight / menuReference, menuMinScale),
      (screenWidth * menuReach) / 100 / width,
      menuMaxScale,
    );

    time += delta;
    root.position.set(
      (screenWidth * menuLeft) / 100,
      (screenHeight * menuTop) / 100,
    );
    root.scale.set(scale);
    root.rotation = menuTilt;

    for (let index = 0; index < items.length; index++) {
      const item: MenuItem = items[index]!;
      const chosen: boolean = index === selected;
      const bob: number =
        Math.sin((time * bobSpeed + index * 0.25) * Math.PI * 2) * bobAmount;

      springStep(
        item.scale,
        chosen ? selectScale : 1,
        springFrequency,
        springDamping,
        delta,
      );
      item.view.position.set(item.baseX + item.enter, item.baseY + bob);
      item.view.scale.set(item.scale.value);
      item.label.tint = chosen ? getTheme().menuSelected : getTheme().menuText;
      item.label.alpha = chosen ? 1 : idleAlpha;
    }

    const target: MenuItem = items[selected]!;

    springStep(
      highlight.x,
      target.view.x,
      springFrequency,
      springDamping,
      delta,
    );
    springStep(
      highlight.y,
      target.view.y,
      springFrequency,
      springDamping,
      delta,
    );
    springStep(
      highlight.width,
      target.label.width * target.scale.value,
      springFrequency,
      springDamping,
      delta,
    );
    marker.alpha = target.view.alpha;
    drawHighlight(marker, textHeight);
  });

  return root;
}

export {
  selectedPoint,
  createButtons,
  buttonFaces,
  resetButtons,
  enterButtons,
  setButtonsActive,
  navigate,
};
