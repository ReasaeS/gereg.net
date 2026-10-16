import { Color, Text, type ColorSource, type Graphics } from "pixi.js";
import { getTheme } from "../../theme/theme";

const tileWidth: number = 190; // px
const tileHeight: number = 300; // px
const tileRadius: number = 10; // px
const artInset: number = 16; // px
const artTop: number = 18; // px
const artHeight: number = 140; // px
const nameMargin: number = 14; // px
const diamondSize: number = 5; // px
const trim: string = getTheme().highlight;
const trimLit: string = getTheme().accent;
const detailColor: string = "#9fd8ff";
const cardFace: string = getTheme().menuSelected;
const cardInner: string = getTheme().seaDeep;
const cardBack: string = getTheme().seaMiddle;
const serifFamily: Array<string> = ["Georgia", "Times New Roman", "serif"];

function createSerif(size: number, color: string): Text {
  return new Text({
    text: "",
    style: {
      fontFamily: serifFamily,
      fontSize: size,
      fontWeight: "700",
      letterSpacing: size * 0.12,
      fill: color,
    },
  });
}

function diamond(graphics: Graphics, x: number, y: number, size: number): void {
  graphics.poly([x, y - size, x + size, y, x, y + size, x - size, y]);
}

function fit(text: Text): void {
  text.scale.set(1);
  text.scale.set(Math.min((tileWidth - nameMargin * 2) / text.width, 1));
}

function blend(from: ColorSource, to: ColorSource, amount: number): number {
  const [fromRed, fromGreen, fromBlue] = new Color(from).toRgbArray() as [
    number,
    number,
    number,
  ];
  const [toRed, toGreen, toBlue] = new Color(to).toRgbArray() as [
    number,
    number,
    number,
  ];

  return new Color([
    fromRed + (toRed - fromRed) * amount,
    fromGreen + (toGreen - fromGreen) * amount,
    fromBlue + (toBlue - fromBlue) * amount,
  ]).toNumber();
}

export {
  tileWidth,
  tileHeight,
  tileRadius,
  artInset,
  artTop,
  artHeight,
  diamondSize,
  trim,
  trimLit,
  detailColor,
  cardFace,
  cardInner,
  cardBack,
  createSerif,
  diamond,
  fit,
  blend,
};
