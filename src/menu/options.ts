import {
  ColorMatrixFilter,
  Container,
  Graphics,
  Rectangle,
  Text,
  type Application,
  type Ticker,
} from "pixi.js";
import { approach, ease } from "../effects/tween/tween";

const buttonTop: number = 200; // px
const buttonThick: number = 150; // px
const buttonGap: number = 20; // px
const buttonWidth: number = 33; // vw
const buttonGrow: number = 5;
const buttonBorder: number = 4;
const textSaturationBoost: number = 25;
const textLightnessBoost: number = 45;
const bottomSaturationDrop: number = 20;
const bottomLightnessDrop: number = 12;
const glowSize: number = 12;
const glowLightness: number = 55;
const textPadding: number = 40;
const indigoHue: number = 275;
const indigoPull: number = 0.5;
const hoverDuration: number = 150; // ms
const hoverBrightness: number = 1.3;

type Info = {
  name: string;
  hue: number;
  saturation: number;
  lightness: number;
};

type Colors = {
  background: string;
  text: string;
  bottom: string;
  glow: string;
};

type MenuButton = {
  view: Container;
  face: Graphics;
  filters: Array<ColorMatrixFilter>;
  colors: Colors;
  hovered: boolean;
  hover: number;
};

const info: Array<Info> = [
  { name: "play", hue: 0, saturation: 50, lightness: 25 },
  { name: "stats", hue: 130, saturation: 50, lightness: 25 },
  { name: "config", hue: 220, saturation: 50, lightness: 25 },
  { name: "about", hue: 0, saturation: 0, lightness: 25 },
];

function navigate(name: string): void {
  document.dispatchEvent(new CustomEvent<string>("navigate", { detail: name }));
}

function hsl(hue: number, saturation: number, lightness: number): string {
  return "hsl(" + hue + ", " + saturation + "%, " + lightness + "%)";
}

function pullHue(hue: number): number {
  const difference: number = ((indigoHue - hue + 540) % 360) - 180;
  return (hue + difference * indigoPull + 360) % 360;
}

function buttonColors(aInfo: Info): Colors {
  const hue: number = pullHue(aInfo.hue);
  const textSaturation: number =
    aInfo.saturation === 0
      ? 0
      : Math.min(100, aInfo.saturation + textSaturationBoost);
  const textLightness: number = Math.min(
    100,
    aInfo.lightness + textLightnessBoost,
  );

  const bottomSaturation: number = Math.max(
    0,
    aInfo.saturation - bottomSaturationDrop,
  );
  const bottomLightness: number = Math.max(
    0,
    aInfo.lightness - bottomLightnessDrop,
  );

  return {
    background: hsl(hue, aInfo.saturation, aInfo.lightness),
    text: hsl(hue, textSaturation, textLightness),
    bottom: hsl(hue, bottomSaturation, bottomLightness),
    glow: hsl(hue, aInfo.saturation === 0 ? 0 : 100, glowLightness),
  };
}

function glowText(
  name: string,
  color: string,
  glow: string,
  blur: number,
): Text {
  const text: Text = new Text({
    text: name.toUpperCase(),
    style: {
      fontFamily: "monospace",
      fontSize: buttonThick / 2,
      fill: color,
      padding: blur * 2,
      dropShadow: {
        color: glow,
        alpha: 1,
        blur: blur,
        distance: 0,
        angle: 0,
      },
    },
  });
  text.anchor.set(0, 0.5);

  return text;
}

function createLabel(name: string, colors: Colors): Container {
  const label: Container = new Container();
  label.addChild(glowText(name, colors.text, colors.glow, glowSize * 2));
  label.addChild(glowText(name, colors.text, colors.glow, glowSize));
  label.addChild(glowText(name, colors.text, colors.text, glowSize / 4));
  label.position.set(buttonBorder + textPadding, buttonThick / 2);

  return label;
}

function paintButton(button: MenuButton, width: number): void {
  const border: number = buttonBorder;
  const height: number = buttonThick;

  button.face
    .clear()
    .rect(0, 0, width, height)
    .fill(button.colors.background)
    .poly([0, 0, width, 0, width, border, border, border])
    .fill(button.colors.text)
    .poly([0, 0, border, border, border, height - border, 0, height])
    .fill(button.colors.text)
    .poly([
      0,
      height,
      border,
      height - border,
      width,
      height - border,
      width,
      height,
    ])
    .fill(button.colors.bottom);
  button.view.hitArea = new Rectangle(0, 0, width, height);
}

function createButton(aInfo: Info, index: number): MenuButton {
  const view: Container = new Container();
  const button: MenuButton = {
    view: view,
    face: new Graphics(),
    filters: [new ColorMatrixFilter()],
    colors: buttonColors(aInfo),
    hovered: false,
    hover: 0,
  };

  view.addChild(button.face);
  view.addChild(createLabel(aInfo.name, button.colors));
  view.y = buttonTop + (buttonThick + buttonGap) * index;
  view.eventMode = "static";
  view.cursor = "pointer";
  view.interactiveChildren = false;

  view.on("pointerover", () => {
    button.hovered = true;
  });
  view.on("pointerout", () => {
    button.hovered = false;
  });
  view.on("pointertap", () => navigate(aInfo.name));

  return button;
}

const buttons: Array<MenuButton> = new Array();

function buttonFaces(): Array<Container> {
  return buttons.map((button: MenuButton) => button.face);
}

function createButtons(app: Application): Container {
  const buttonDiv: Container = new Container();

  for (let index = 0; index < info.length; index++) {
    const button: MenuButton = createButton(info[index]!, index);
    buttons.push(button);
    buttonDiv.addChild(button.view);
  }

  app.ticker.add((ticker: Ticker) => {
    for (let index = 0; index < buttons.length; index++) {
      const button: MenuButton = buttons[index]!;
      button.hover = approach(
        button.hover,
        button.hovered ? 1 : 0,
        ticker.deltaMS / hoverDuration,
      );

      const grow: number = ease(button.hover);
      const width: number =
        (app.screen.width * (buttonWidth + buttonGrow * grow)) / 100;

      paintButton(button, width);
      button.view.x = app.screen.width - width;

      if (grow === 0) {
        button.view.filters = null;
      } else {
        button.filters[0]!.brightness(1 + (hoverBrightness - 1) * grow, false);
        button.view.filters = button.filters;
      }
    }
  });

  return buttonDiv;
}

export { createButtons, buttonFaces, navigate };
export type { Info };
