import { Container, Text, type Application, type Ticker } from "pixi.js";
import { frameDelta } from "../effects/tween/tween";
import { createGlide, type Glide } from "../ui/motion";

type Terminal = {
  view: Container;
  show: () => void;
  hide: () => void;
};

const monoFamily: Array<string> = [
  "JetBrains Mono",
  "Cascadia Mono",
  "Consolas",
  "Menlo",
  "monospace",
];
const screenMargin: number = 28; // px
const lineSize: number = 15; // px
const lineHeight: number = 22; // px
const textColor: string = "#cfeeff";
const firstDelay: number = 0.3; // s
const lineDelay: number = 0.18; // s
const lines: Array<string> = [
  "GEREGNET SYSTEM 0.1",
  "",
  "MEMORY CHECK ............ OK",
  "LOADING SPRITES ......... OK",
  "LOADING STAGES .......... OK",
  "FLOODING SEA ............ OK",
  "STARTING RAIN ........... OK",
  "",
  "READY.",
  "CLICK THE RING TO START.",
];

function createTerminal(app: Application): Terminal {
  const view: Container = new Container();
  const rows: Array<Text> = lines.map(
    (line: string) =>
      new Text({
        text: line,
        style: { fontFamily: monoFamily, fontSize: lineSize, fill: textColor },
      }),
  );
  const fade: Glide = createGlide(1, (alpha: number) => {
    view.alpha = alpha;
    view.visible = alpha > 0;
  });
  let elapsed: number = 0;

  function update(delta: number): void {
    elapsed += delta;

    const count: number = Math.floor((elapsed - firstDelay) / lineDelay) + 1;

    for (let index = 0; index < rows.length; index++) {
      rows[index]!.visible = index < count;
    }
  }

  function show(): void {
    elapsed = 0;
    update(0);
    fade.set(1);
  }

  function hide(): void {
    fade.set(0);
  }

  for (let index = 0; index < rows.length; index++) {
    rows[index]!.position.set(screenMargin, screenMargin + index * lineHeight);
  }

  view.addChild(...rows);
  view.eventMode = "none";
  update(0);

  app.ticker.add((ticker: Ticker) => {
    if (view.visible) {
      update(frameDelta(ticker));
    }
  });

  return { view: view, show: show, hide: hide };
}

export { createTerminal };
export type { Terminal };
