import { Container, Text } from "pixi.js";
import { pixelRatio } from "./density";

const fontFamily: Array<string> = [
  "Barlow Condensed",
  "Arial Black",
  "Impact",
  "sans-serif",
];

function createText(size: number, color: string = "#ffffff"): Text {
  return new Text({
    text: "",
    style: {
      fontFamily: fontFamily,
      fontSize: size,
      fontStyle: "italic",
      fontWeight: "900",
      fill: color,
    },
  });
}

function createShadowText(
  text: string,
  size: number,
  color: string,
  shadowColor: string,
  shadowDistance: number,
): Text {
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

function sharpen(target: Container, resolution: number): void {
  if (target instanceof Text && target.resolution !== resolution) {
    target.resolution = resolution;
  }

  for (const child of target.children) {
    sharpen(child, resolution);
  }
}

function screenResolution(scale: number): number {
  return scale * pixelRatio;
}

export { fontFamily, createText, createShadowText, sharpen, screenResolution };
