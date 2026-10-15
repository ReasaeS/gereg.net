import { Container, Text, type Application, type Ticker } from "pixi.js";
import { frameDelta, tween } from "../effects/tween/tween";
import { createGlide, type Glide } from "../ui/motion";
import {
  createShadowText,
  createText,
  sharpen,
  screenResolution,
} from "../ui/text";

type Credit = {
  role: string;
  name: string;
};

type Credits = {
  view: Container;
  open: () => void;
  close: () => Promise<void>;
};

const credits: Array<Credit> = [{ role: "Creator", name: "Mr Storm" }];
const zoomTime: number = 0.3; // s per e-fold
const zoomRamp: number = 0.2; // s
const maxDistance: number = 8;
const textDelay: number = 1.4; // s
const textSmoothing: number = 0.35; // s
const closeTime: number = 900; // ms
const roleSize: number = 30; // px
const nameSize: number = 96; // px
const roleColor: string = "#9fd8ff";
const shadowColor: string = "#020b30";
const creditGap: number = 150; // px
const textReference: number = 1000; // px

function createCredits(
  app: Application,
  setDistance: (distance: number) => void,
): Credits {
  const view: Container = new Container();
  const lines: Container = new Container();
  const shown: Glide = createGlide(
    0,
    (value: number) => {
      view.alpha = value;
      view.visible = value > 0;
    },
    textSmoothing,
  );
  let running: boolean = false;
  let closing: boolean = false;
  let elapsed: number = 0;
  let distance: number = 0;
  let textScale: number = 0;

  for (let index = 0; index < credits.length; index++) {
    const credit: Credit = credits[index]!;
    const top: number = (index - (credits.length - 1) / 2) * creditGap;
    const role: Text = createText(roleSize, roleColor);
    const name: Text = createShadowText(
      credit.name.toUpperCase(),
      nameSize,
      "#ffffff",
      shadowColor,
      8,
    );

    role.text = credit.role.toUpperCase();
    role.anchor.set(0.5, 1);
    role.y = top - nameSize / 2;
    name.anchor.set(0.5, 0.5);
    name.y = top + roleSize / 2;
    lines.addChild(role, name);
  }

  view.addChild(lines);
  view.visible = false;
  view.alpha = 0;

  function layoutText(): void {
    const scale: number = app.screen.height / textReference;

    if (scale !== textScale) {
      textScale = scale;
      sharpen(lines, screenResolution(scale));
    }

    lines.scale.set(scale);
    lines.position.set(app.screen.width / 2, app.screen.height / 2);
  }

  app.ticker.add((ticker: Ticker) => {
    if (!running) {
      return;
    }

    layoutText();

    if (closing) {
      return;
    }

    const delta: number = frameDelta(ticker);

    elapsed += delta;
    distance = Math.min(
      distance + (Math.min(elapsed / zoomRamp, 1) * delta) / zoomTime,
      maxDistance,
    );
    setDistance(distance);

    if (elapsed >= textDelay) {
      shown.set(1);
    }
  });

  function open(): void {
    running = true;
    closing = false;
    elapsed = 0;
    distance = 0;
    shown.snap(0);
  }

  function close(): Promise<void> {
    const from: number = distance;

    closing = true;
    shown.set(0);

    return tween(app.ticker, closeTime, (progress: number) => {
      distance = from * Math.pow(1 - progress, 3);
      setDistance(distance);
    }).then(() => {
      running = false;
      closing = false;
      shown.snap(0);
    });
  }

  return { view: view, open: open, close: close };
}

export { createCredits };
export type { Credits };
