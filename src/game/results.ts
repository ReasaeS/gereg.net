import { Container, Graphics, type Text } from "pixi.js";
import { getTheme } from "../theme/theme";
import { bindingName } from "./input";
import { createGlide, type Glide } from "../ui/motion";
import { createShadowText, createText, screenResolution } from "../ui/text";

type Results = {
  view: Container;
  show: (title: string, rows: Array<[string, string]>, best: boolean) => void;
  hide: () => void;
  shown: () => boolean;
  setScale: (scale: number) => void;
};

const titleSize: number = 36; // px
const rowSize: number = 16; // px
const bestSize: number = 14; // px
const hintSize: number = 12; // px
const rowGap: number = 30; // units
const minRowGap: number = 22; // units
const panelFill: number = 0.96; // of field height
const titleGap: number = 64; // units
const bestGap: number = 26; // units
const hintGap: number = 44; // units
const panelWidth: number = 0.72; // of field width
const panelPadding: number = 36; // units
const panelSlant: number = 18; // units
const panelAlpha: number = 0.86;
const shadeAlpha: number = 0.35;
const shadowColor: string = "#020b30";
const growFrom: number = 1.12;
const resultsSmoothing: number = 0.16; // s
const rowStagger: number = 0.07; // s
const rowRise: number = 10; // units

function createResults(width: number, height: number): Results {
  const view: Container = new Container();
  const content: Container = new Container();
  const shade: Graphics = new Graphics();
  const panel: Graphics = new Graphics();
  const lines: Container = new Container();
  const title: Text = createShadowText(
    "",
    titleSize,
    "#ffffff",
    shadowColor,
    4,
  );
  const best: Text = createText(bestSize, getTheme().accent);
  const hint: Text = createText(hintSize, "#9fd8ff");
  const rowGlides: Array<Glide> = new Array();
  let open: boolean = false;
  let scale: number = 1;
  const shown: Glide = createGlide(
    0,
    (value: number) => {
      view.alpha = value;
      view.visible = value > 0;
      content.scale.set(growFrom + (1 - growFrom) * value);
    },
    resultsSmoothing,
  );

  function build(rows: Array<[string, string]>): void {
    const inner: number = width * panelWidth;
    const left: number = -inner / 2 + panelPadding;
    const right: number = inner / 2 - panelPadding;
    const fixed: number = titleGap + bestGap + hintGap + panelPadding * 2;
    const gap: number = Math.max(
      Math.min(rowGap, (height * panelFill - fixed) / rows.length),
      minRowGap,
    );
    const tall: number = fixed + rows.length * gap;
    const top: number = -tall / 2;

    for (const child of lines.removeChildren()) {
      child.destroy({ children: true });
    }

    rowGlides.length = 0;

    for (let index = 0; index < rows.length; index++) {
      const [name, value] = rows[index]!;
      const row: Container = new Container();
      const label: Text = createText(rowSize, "#9fd8ff");
      const amount: Text = createText(rowSize, "#ffffff");
      const y: number = top + panelPadding + titleGap + index * gap;

      label.text = name.toUpperCase();
      label.anchor.set(0, 0.5);
      label.x = left;
      amount.text = value;
      amount.anchor.set(1, 0.5);
      amount.x = right;
      row.addChild(label, amount);
      row.y = y;
      row.alpha = 0;
      lines.addChild(row);
      rowGlides.push(
        createGlide(0, (progress: number) => {
          if (!row.destroyed) {
            row.alpha = progress;
            row.y = y + rowRise * (1 - progress);
          }
        }),
      );
    }

    title.position.set(0, top + panelPadding + titleSize / 2);
    best.position.set(
      0,
      top + panelPadding + titleGap + rows.length * gap + bestGap / 2,
    );
    hint.position.set(0, -top - panelPadding);
    panel
      .clear()
      .poly([
        -inner / 2 + panelSlant,
        top,
        inner / 2,
        top,
        inner / 2 - panelSlant,
        -top,
        -inner / 2,
        -top,
      ])
      .fill({ color: "#01040f", alpha: panelAlpha })
      .stroke({ color: getTheme().highlight, width: 2 });
    setScale(scale);
  }

  function show(
    heading: string,
    rows: Array<[string, string]>,
    record: boolean,
  ): void {
    hint.text = bindingName("shot") + " CONTINUE  ·  R RETRY";
    open = true;
    title.text = heading;
    best.text = record ? "NEW BEST" : "";
    build(rows);
    shown.snap(0);
    shown.set(1);

    for (let index = 0; index < rowGlides.length; index++) {
      const glide: Glide = rowGlides[index]!;

      window.setTimeout(() => glide.set(1), (index + 1) * rowStagger * 1000);
    }
  }

  function setScale(value: number): void {
    scale = value;

    for (const text of [
      title,
      best,
      hint,
      ...lines.children.flatMap((row) => row.children as Array<Text>),
    ]) {
      text.resolution = screenResolution(scale * growFrom);
    }
  }

  shade.rect(0, 0, width, height).fill({ color: "#000000", alpha: shadeAlpha });
  title.anchor.set(0.5);
  best.anchor.set(0.5);
  hint.anchor.set(0.5);
  content.position.set(width / 2, height / 2);
  content.addChild(panel, title, lines, best, hint);
  view.addChild(shade, content);
  view.visible = false;
  view.alpha = 0;

  return {
    view: view,
    show: show,
    hide: () => {
      open = false;
      shown.set(0);
    },
    shown: () => open,
    setScale: setScale,
  };
}

export { createResults };
export type { Results };
