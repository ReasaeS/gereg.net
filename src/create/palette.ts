import { Graphics, type Container } from "pixi.js";
import { getTheme } from "../theme/theme";
import { defaultPalette } from "./defaults";
import type { Palette } from "./types";

const plainPalette: Palette = defaultPalette();
const artWidth: number = 100; // units
const artHeight: number = 124; // units
const artFill: number = 0.8;
const badgeHeight: number = 12; // units
const badgeSlant: number = 4; // units
const rowTop: number = 24; // units
const rowGap: number = 13; // units
const rowCount: number = 6;
const barHeight: number = 4; // units
const litRow: number = 2;
const swatchY: number = 116; // units
const swatchRadius: number = 6; // units

function paletteOf(palette: Palette | null): Palette {
  return palette ?? plainPalette;
}

function drawPalette(
  art: Container,
  palette: Palette | null,
  width: number,
  height: number,
): void {
  const value: Palette = paletteOf(palette);
  const mock: Graphics = new Graphics();
  const scale: number =
    Math.min(width / artWidth, height / artHeight) * artFill;
  const dark: string = getTheme().menuSelected;

  mock
    .poly([
      badgeSlant,
      0,
      artWidth,
      0,
      artWidth - badgeSlant,
      badgeHeight,
      0,
      badgeHeight,
    ])
    .fill(value.accent)
    .rect(artWidth / 2 - 12, badgeHeight / 2 - 1.5, 24, 3)
    .fill(value.text);

  for (let index = 0; index < rowCount; index++) {
    const y: number = rowTop + index * rowGap;
    const lit: boolean = index === litRow;
    const labelWidth: number = 22 + ((index * 7) % 12);
    const valueWidth: number = 30 + ((index * 11) % 20);

    if (lit) {
      mock
        .rect(-3, y - rowGap / 2 + barHeight / 2, artWidth + 6, rowGap)
        .fill(value.highlight);
    }

    mock
      .rect(0, y, labelWidth, barHeight)
      .fill(lit ? dark : value.label)
      .rect(artWidth - valueWidth, y, valueWidth, barHeight)
      .fill(lit ? dark : value.text);
  }

  for (const [index, color] of [
    value.accent,
    value.highlight,
    value.text,
    value.label,
  ].entries()) {
    mock
      .circle(14 + index * 24, swatchY, swatchRadius)
      .fill(color)
      .stroke({ color: "#ffffff", width: 1, alpha: 0.3 });
  }

  mock.scale.set(scale);
  mock.position.set(
    width / 2 - (artWidth * scale) / 2,
    height / 2 - (artHeight * scale) / 2,
  );
  art.addChild(mock);
}

export { drawPalette, paletteOf };
