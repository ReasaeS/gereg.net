import { Container, Graphics, Rectangle, Text } from "pixi.js";
import { getTheme } from "../theme/theme";
import { createText } from "./text";
import { createGlide, mix, type Glide } from "./motion";

type Button = {
  view: Container;
  back: Graphics;
  label: Text;
  active: () => boolean;
  width: number; // px
  lit: Glide;
  hover: Glide;
};

const buttonFontSize: number = 26; // px
const buttonWidth: number = 150; // px
const buttonHeight: number = 40; // px
const buttonGap: number = 8; // px
const buttonSlant: number = 10; // px
const buttonIdleAlpha: number = 0.55;
const hoverAlpha: number = 0.25;
const hoverShift: number = 4; // px
const labelInset: number = 10; // px

function drawButton(button: Button): void {
  const lit: number = button.lit.value();
  const hover: number = button.hover.value();

  button.back
    .clear()
    .poly([
      buttonSlant,
      0,
      button.width,
      0,
      button.width - buttonSlant,
      buttonHeight,
      0,
      buttonHeight,
    ])
    .fill({
      color: mix(getTheme().menuSelected, getTheme().highlight, lit),
      alpha:
        buttonIdleAlpha +
        (1 - buttonIdleAlpha) * lit +
        hoverAlpha * hover * (1 - lit),
    });
  button.label.tint = mix(getTheme().menuText, getTheme().menuSelected, lit);
  button.label.x = buttonSlant + labelInset + hoverShift * hover;
}

function createButton(
  name: string,
  active: () => boolean,
  action: () => void,
  width: number = buttonWidth,
): Button {
  const view: Container = new Container();
  const back: Graphics = new Graphics();
  const label: Text = createText(buttonFontSize);
  const button: Button = {
    view: view,
    back: back,
    label: label,
    active: active,
    width: width,
    lit: createGlide(active() ? 1 : 0, () => drawButton(button)),
    hover: createGlide(0, () => drawButton(button)),
  };

  label.text = name.toUpperCase();
  label.anchor.set(0, 0.5);
  label.y = buttonHeight / 2;
  view.addChild(back, label);
  view.eventMode = "static";
  view.cursor = "pointer";
  view.hitArea = new Rectangle(0, 0, width, buttonHeight);
  view.on("pointertap", action);
  view.on("pointerover", () => button.hover.set(1));
  view.on("pointerout", () => button.hover.set(0));
  drawButton(button);

  return button;
}

function paintButton(button: Button): void {
  button.lit.set(button.active() ? 1 : 0);
  drawButton(button);
}

export { buttonWidth, buttonHeight, buttonGap, createButton, paintButton };
export type { Button };
