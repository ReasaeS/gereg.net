import { Container, Graphics, type Text } from "pixi.js";
import { getTheme } from "../theme/theme";
import { animate, createGlide, type Glide } from "../ui/motion";
import { createShadowText, createText, screenResolution } from "../ui/text";

type Loading = {
  view: Container;
  show: (detail: string) => void;
  hide: () => void;
  setScale: (scale: number) => void;
};

const titleSize: number = 30; // px
const detailSize: number = 16; // px
const detailGap: number = 30; // units
const lineWidth: number = 120; // units
const lineGap: number = 22; // units
const shadowColor: string = "#020b30";
const coverColor: string = "#01040f";
const coverAlpha: number = 0.94;
const growFrom: number = 1.1;
const loadingSmoothing: number = 0.08; // s
const trackAlpha: number = 0.25;
const sweepWidth: number = 36; // units
const sweepPeriod: number = 1.4; // s

function createLoading(width: number, height: number): Loading {
  const view: Container = new Container();
  const content: Container = new Container();
  const cover: Graphics = new Graphics();
  const line: Graphics = new Graphics();
  const sweep: Graphics = new Graphics();
  let phase: number = 0;
  let sweeping: boolean = false;
  let wanted: boolean = false;
  const title: Text = createShadowText(
    "LOADING",
    titleSize,
    "#ffffff",
    shadowColor,
    4,
  );
  const detail: Text = createText(detailSize, "#9fd8ff");
  const texts: Array<Text> = [title, detail];
  const shown: Glide = createGlide(
    0,
    (value: number) => {
      view.alpha = value;
      view.visible = value > 0;
      content.scale.set(growFrom + (1 - growFrom) * value);
    },
    loadingSmoothing,
  );

  cover
    .rect(0, 0, width, height)
    .fill({ color: coverColor, alpha: coverAlpha });
  line
    .rect(-lineWidth / 2, -1, lineWidth, 2)
    .fill({ color: getTheme().accent, alpha: trackAlpha });
  line.y = lineGap;
  sweep
    .rect(-sweepWidth / 2, -1, sweepWidth, 2)
    .fill({ color: getTheme().accent });
  sweep.y = lineGap;
  title.anchor.set(0.5);
  detail.anchor.set(0.5);
  detail.y = lineGap + detailGap;
  content.position.set(width / 2, height / 2 - lineGap);
  content.addChild(title, line, sweep, detail);
  view.addChild(cover, content);
  view.eventMode = "static";
  view.visible = false;
  view.alpha = 0;

  function step(delta: number): boolean {
    phase = (phase + delta / sweepPeriod) % 1;
    sweep.x = ((lineWidth - sweepWidth) / 2) * Math.sin(Math.PI * 2 * phase);
    sweeping = wanted || view.visible;

    return sweeping;
  }

  function show(name: string): void {
    detail.text = name;
    wanted = true;
    shown.set(1);

    if (!sweeping) {
      sweeping = true;
      phase = 0;
      animate(step);
    }
  }

  function setScale(scale: number): void {
    for (const text of texts) {
      text.resolution = screenResolution(scale * growFrom);
    }
  }

  return {
    view: view,
    show: show,
    hide: () => {
      wanted = false;
      shown.set(0);
    },
    setScale: setScale,
  };
}

export { createLoading };
export type { Loading };
