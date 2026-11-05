import { Container, Text } from "pixi.js";
import { renderRatio } from "./density";

const fontFamily: Array<string> = [
  "Barlow Condensed",
  "Arial Black",
  "Impact",
  "sans-serif",
];

const labelFamily: Array<string> = [
  "Segoe UI",
  "Roboto",
  "Helvetica Neue",
  "Arial",
  "sans-serif",
];
const outlineColor: string = "#0b0f12";
const outlineShare: number = 0.3;
const shadowShare: number = 0.15;

function textResolution(): number {
  return Math.max(renderRatio(), 1);
}

function createText(size: number, color: string = "#ffffff"): Text {
  return new Text({
    text: "",
    resolution: textResolution(),
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
    resolution: textResolution(),
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

function createLabelText(
  size: number,
  color: string = "#ffffff",
  outline: boolean = true,
): Text {
  return new Text({
    text: "",
    resolution: textResolution(),
    style: {
      fontFamily: labelFamily,
      fontSize: size,
      fontWeight: "700",
      fill: color,
      padding: outline ? size * outlineShare * 2 : 0,
      ...(outline
        ? {
            stroke: {
              color: outlineColor,
              width: size * outlineShare,
              join: "round",
            },
            dropShadow: {
              color: outlineColor,
              alpha: 0.7,
              blur: 0,
              distance: size * shadowShare,
              angle: Math.PI / 2,
            },
          }
        : {}),
    },
  });
}

function fitText(text: Text, label: string, width: number): void {
  text.text = label;

  for (
    let length = label.length - 1;
    length > 0 && text.width > width;
    length--
  ) {
    text.text = label.slice(0, length) + "…";
  }

  text.visible = text.width <= width;
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
  return Math.max(scale * renderRatio(), 1);
}

export {
  fontFamily,
  createText,
  createShadowText,
  createLabelText,
  fitText,
  sharpen,
  screenResolution,
};
