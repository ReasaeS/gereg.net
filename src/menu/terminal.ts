import {
  Container,
  Graphics,
  Text,
  type Application,
  type Rectangle,
  type Ticker,
} from "pixi.js";
import { frameDelta } from "../effects/tween/tween";
import { createGlide, type Glide } from "../ui/motion";
import { createRetype, type Retype } from "../ui/retype";
import { introBounds } from "./landing";
import { seaHeight } from "../worlds/vivid";

type Category = "LOADING" | "SYS" | "TIP" | "INFO";

type Terminal = {
  view: Container;
  show: () => void;
  hide: () => void;
  snapHidden: () => void;
  fade: (value: number) => void;
  progress: (total: number) => void;
  advance: () => void;
  tip: (list: Array<string>) => void;
  info: (line: () => string) => void;
  print: (
    line: string,
    category?: Category,
    blinking?: boolean,
  ) => (next: string) => void;
  finished: () => boolean;
};

const monoFamily: Array<string> = [
  "JetBrains Mono",
  "Cascadia Mono",
  "Consolas",
  "Menlo",
  "monospace",
];
const screenMargin: number = 20; // px
const lineSize: number = 15; // px
const lineHeight: number = 22; // px
const textColor: string = "#cfeeff";
const firstDelay: number = 0.3; // s
const lineDelay: number = 0.18; // s
const headerText: string =
  "GEREG.NET SYSTEM // Please Wait .. Por Favor Espere";
const headerColor: string = "#ffffff";
const headerTextColor: string = "#000000";
const headerPadding: number = 4; // px
const footerColor: string = "#000000";
const dividerGlyph: string = "─";
const footerText: string = "You are visiting GEREG.NET.";
const footerMark: string = "[GER]";
const tagWidth: number = 10; // characters
const barWidth: number = 24; // characters
const barFull: string = "█";
const barEmpty: string = "░";
const barSmoothing: number = 0.2; // s
const tipInterval: number = 8; // s
const blinkPeriod: number = 1; // s
const blinkOn: number = 0.6; // of period

function createTerminal(app: Application): Terminal {
  const view: Container = new Container();
  const header: Graphics = new Graphics();
  const title: Text = new Text({
    text: headerText,
    style: {
      fontFamily: monoFamily,
      fontSize: lineSize,
      fill: headerTextColor,
    },
  });
  const footer: Graphics = new Graphics();
  const note: Text = new Text({
    text: footerText,
    style: { fontFamily: monoFamily, fontSize: lineSize, fill: textColor },
  });
  const mark: Text = new Text({
    text: footerMark,
    style: { fontFamily: monoFamily, fontSize: lineSize, fill: textColor },
  });
  const divider: Text = new Text({
    text: dividerGlyph,
    style: { fontFamily: monoFamily, fontSize: lineSize, fill: textColor },
  });
  const glyphWidth: number = divider.width;
  const rows: Array<Text> = new Array();
  let bar: Text | null = null;
  const infos: Array<{ row: Text; line: () => string }> = new Array();
  let tips: Array<string> = new Array();
  let tipIndex: number = 0;
  let tipRow: Text | null = null;
  let tipRetype: Retype | null = null;
  let tipElapsed: number = 0;
  let blinkTime: number = 0;
  const blinking: Array<Text> = new Array();
  let total: number = 0;
  let done: number = 0;
  const shown: Glide = createGlide(0, drawBar, barSmoothing);
  const fade: Glide = createGlide(1, (alpha: number) => {
    view.alpha = alpha;
    view.visible = alpha > 0;
  });
  let elapsed: number = 0;

  function shownCount(): number {
    return Math.floor((elapsed - firstDelay) / lineDelay) + 1;
  }

  function update(delta: number): void {
    elapsed += delta;

    const count: number = shownCount();

    for (let index = 0; index < rows.length; index++) {
      rows[index]!.visible = index < count;
    }
  }

  function tagged(category: Category, text: string): string {
    return `[${category}]`.padEnd(tagWidth) + text;
  }

  function print(line: string): number {
    const row: Text = new Text({
      text: line,
      style: { fontFamily: monoFamily, fontSize: lineSize, fill: textColor },
    });

    rows.push(row);
    view.addChild(row);
    layout();
    update(0);

    return rows.length - 1;
  }

  function barText(value: number): string {
    const filled: number = Math.min(
      Math.max(Math.round(value * barWidth), 0),
      barWidth,
    );

    return tagged(
      "LOADING",
      `${barFull.repeat(filled)}${barEmpty.repeat(barWidth - filled)} ${String(Math.round(value * 100)).padStart(3)}%`,
    );
  }

  function drawBar(value: number): void {
    const text: string = barText(value);

    if (bar !== null && bar.text !== text) {
      bar.text = text;
    }
  }

  function progress(count: number): void {
    total = count;
    done = 0;
    bar = rows[print(barText(0))]!;
  }

  function tip(list: Array<string>): void {
    tips = list;
    tipIndex = Math.floor(Math.random() * tips.length);
    tipRow = rows[print(tagged("TIP", tips[tipIndex]!))]!;
    tipRetype = createRetype(tipRow);
  }

  function cycleTip(delta: number): void {
    if (tipRow === null || tipRetype === null || !tipRow.visible) {
      return;
    }

    tipElapsed += delta;

    if (tipElapsed < tipInterval || tips.length < 2) {
      return;
    }

    tipElapsed = 0;
    tipIndex =
      (tipIndex + 1 + Math.floor(Math.random() * (tips.length - 1))) %
      tips.length;
    tipRetype.set(tagged("TIP", tips[tipIndex]!), true);
  }

  function advance(): void {
    done++;
    shown.set(done / total);
  }

  function show(): void {
    elapsed = 0;
    update(0);
    fade.snap(1);
  }

  function restart(): void {
    elapsed = 0;
    update(0);
  }

  function hide(): void {
    fade.set(0);
  }

  function layout(): void {
    const bounds: Rectangle = introBounds();
    const headerHeight: number = lineHeight + headerPadding * 2;

    header.clear().rect(0, 0, bounds.width, headerHeight).fill(headerColor);
    title.position.set(screenMargin, headerHeight / 2);

    for (let index = 0; index < rows.length; index++) {
      rows[index]!.position.set(
        screenMargin,
        headerHeight + screenMargin + index * lineHeight,
      );
    }

    const dividerY: number =
      app.screen.height * (1 - seaHeight / 100) - bounds.y;
    const noteY: number = dividerY + lineHeight;
    const footerTop: number = dividerY - lineHeight / 2;
    const dividerText: string = dividerGlyph.repeat(
      Math.max(Math.ceil(bounds.width / glyphWidth), 0),
    );

    footer
      .clear()
      .rect(0, footerTop, bounds.width, bounds.height - footerTop)
      .fill(footerColor);

    if (divider.text !== dividerText) {
      divider.text = dividerText;
    }

    divider.width = bounds.width;
    divider.position.set(0, dividerY);

    for (let index = 0; index < infos.length; index++) {
      infos[index]!.row.position.set(
        screenMargin,
        dividerY - (infos.length - index) * lineHeight,
      );
    }
    note.position.set(screenMargin, noteY);
    mark.position.set(bounds.width - screenMargin, noteY);

    view.position.set(bounds.x, bounds.y);
  }

  layout();

  title.anchor.set(0, 0.5);
  note.anchor.set(0, 0.5);
  mark.anchor.set(1, 0.5);
  divider.anchor.set(0, 0.5);
  view.addChild(header, title, footer, divider, note, mark);
  view.eventMode = "none";
  update(0);

  app.ticker.add((ticker: Ticker) => {
    if (view.visible) {
      layout();
      update(frameDelta(ticker));
      cycleTip(frameDelta(ticker));
      blinkTime = (blinkTime + frameDelta(ticker)) % blinkPeriod;

      for (const row of blinking) {
        row.alpha = blinkTime < blinkPeriod * blinkOn ? 1 : 0;
      }

      for (const info of infos) {
        const text: string = tagged("INFO", info.line());

        if (info.row.text !== text) {
          info.row.text = text;
        }
      }
    }
  });

  return {
    view: view,
    show: show,
    hide: hide,
    snapHidden: () => fade.snap(0),
    fade: (value: number) => {
      if (!view.visible && value > 0) {
        restart();
      }

      fade.snap(value);
    },
    progress: progress,
    advance: advance,
    tip: tip,
    info: (line: () => string) => {
      const row: Text = new Text({
        text: tagged("INFO", line()),
        style: { fontFamily: monoFamily, fontSize: lineSize, fill: textColor },
      });

      row.anchor.set(0, 0.5);
      infos.push({ row: row, line: line });
      view.addChild(row);
      layout();
    },
    print: (line: string, category?: Category, blink: boolean = false) => {
      const row: Text =
        rows[print(category === undefined ? line : tagged(category, line))]!;
      const retype: Retype = createRetype(row);

      if (blink) {
        blinking.push(row);
      }

      return (next: string) => {
        retype.set(
          category === undefined ? next : tagged(category, next),
          row.visible,
        );
      };
    },
    finished: () =>
      done >= total && shown.value() === 1 && shownCount() >= rows.length,
  };
}

export { createTerminal };
export type { Category, Terminal };
