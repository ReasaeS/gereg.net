import { Container, Text, type Application, type Ticker } from "pixi.js";
import { cubicBezier, tween, type Easing } from "../effects/tween/tween";
import { getTheme } from "../theme/theme";

const fontFamily: Array<string> = [
  "Barlow Condensed",
  "Arial Black",
  "Impact",
  "sans-serif",
];
const titleSize: number = 150; // px
const hintSize: number = 40; // px
const titleColor: string = "#ffffff";
const hintColor: string = "#9fd8ff";
const shadowColor: string = "#01030a";
const shadowDistance: number = 9; // px
const pageLeft: number = 8; // vw
const pageTop: number = 14; // vh
const pageTilt: number = -0.18; // rad
const pageReference: number = 1000; // px
const pageMinScale: number = 0.4;
const pageMaxScale: number = 1.2;
const hintGap: number = 30; // px
const enterDuration: number = 450; // ms
const enterDistance: number = 400; // px
const enterEasing: Easing = cubicBezier(0.34, 1.56, 0.64, 1);
const leaveDuration: number = 250; // ms

type PageContent = {
  view: Container;
  setActive: (active: boolean) => void;
};

type Page = {
  view: Container;
  root: Container;
  content: PageContent | null;
  offset: number; // px
};

function createText(text: string, size: number, color: string): Text {
  return new Text({
    text: text,
    style: {
      fontFamily: fontFamily,
      fontSize: size,
      fontStyle: "italic",
      fontWeight: "900",
      fill: color,
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
}

function createPage(
  app: Application,
  name: string,
  content: PageContent | null,
): Page {
  const view: Container = new Container();
  const root: Container = new Container();
  const page: Page = { view: view, root: root, content: content, offset: 0 };
  const title: Text = createText(name.toUpperCase(), titleSize, titleColor);
  const hint: Text = createText("ESC  BACK", hintSize, hintColor);

  hint.position.set(title.width * 0.08, title.height + hintGap);
  root.addChild(title, hint);
  view.addChild(root);
  view.visible = false;

  if (content !== null) {
    view.addChild(content.view);
  }

  app.ticker.add(() => {
    const scale: number = Math.min(
      Math.max(app.screen.height / pageReference, pageMinScale),
      pageMaxScale,
    );

    root.position.set(
      (app.screen.width * pageLeft) / 100 - page.offset * scale,
      (app.screen.height * pageTop) / 100,
    );
    root.scale.set(scale);
    root.rotation = pageTilt;
    title.tint = getTheme().menuText;
  });

  return page;
}

function showPage(ticker: Ticker, page: Page): Promise<void> {
  page.view.visible = true;

  return tween(ticker, enterDuration, (progress: number) => {
    page.offset = enterDistance * (1 - enterEasing(progress));
    page.view.alpha = Math.min(progress * 2, 1);
  }).then(() => {
    page.content?.setActive(true);
  });
}

function hidePage(ticker: Ticker, page: Page): Promise<void> {
  page.content?.setActive(false);

  return tween(ticker, leaveDuration, (progress: number) => {
    page.offset = enterDistance * progress * progress;
    page.view.alpha = 1 - progress;
  }).then(() => {
    page.view.visible = false;
  });
}

export { createPage, showPage, hidePage };
export type { Page, PageContent };
