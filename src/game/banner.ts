import { Container, Graphics, type Text } from "pixi.js";
import { getTheme } from "../theme/theme";
import { createGlide, type Glide } from "../ui/motion";
import { createShadowText, createText, screenResolution } from "../ui/text";

type Banner = {
  view: Container;
  show: (title: string, detail: string, best: boolean) => void;
  hide: () => void;
  setScale: (scale: number) => void;
};

const titleSize: number = 38; // px
const detailSize: number = 16; // px
const bestSize: number = 14; // px
const detailGap: number = 34; // units
const bestGap: number = 22; // units
const stripHeight: number = 110; // units
const stripAlpha: number = 0.7;
const shadowColor: string = "#020b30";
const growFrom: number = 1.25;
const bannerSmoothing: number = 0.18; // s

function createBanner(width: number, height: number): Banner {
  const view: Container = new Container();
  const content: Container = new Container();
  const strip: Graphics = new Graphics();
  const title: Text = createShadowText(
    "",
    titleSize,
    "#ffffff",
    shadowColor,
    4,
  );
  const detail: Text = createText(detailSize, "#9fd8ff");
  const best: Text = createText(bestSize, getTheme().accent);
  const texts: Array<Text> = [title, detail, best];
  const shown: Glide = createGlide(
    0,
    (value: number) => {
      view.alpha = value;
      view.visible = value > 0;
      content.scale.set(growFrom + (1 - growFrom) * value);
    },
    bannerSmoothing,
  );

  strip
    .rect(0, -stripHeight / 2, width, stripHeight)
    .fill({ color: "#01040f", alpha: stripAlpha });
  strip.y = height / 2;
  title.anchor.set(0.5);
  detail.anchor.set(0.5);
  detail.y = detailGap;
  best.anchor.set(0.5);
  best.y = detailGap + bestGap;
  content.position.set(width / 2, height / 2 - detailGap / 2);
  content.addChild(title, detail, best);
  view.addChild(strip, content);
  view.visible = false;
  view.alpha = 0;

  function show(heading: string, line: string, record: boolean): void {
    title.text = heading;
    detail.text = line;
    best.text = record ? "NEW BEST" : "";
    shown.snap(0);
    shown.set(1);
  }

  function setScale(scale: number): void {
    for (const text of texts) {
      text.resolution = screenResolution(scale * growFrom);
    }
  }

  return {
    view: view,
    show: show,
    hide: () => shown.set(0),
    setScale: setScale,
  };
}

export { createBanner };
export type { Banner };
