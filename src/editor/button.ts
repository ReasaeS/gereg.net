import { Container, Graphics, Rectangle, Text } from "pixi.js";
import { getTheme } from "../theme/theme";

type Button = {
  view: Container;
  back: Graphics;
  label: Text;
  active: () => boolean;
};

const fontFamily: Array<string> = [
  "Barlow Condensed",
  "Arial Black",
  "Impact",
  "sans-serif",
];
const buttonFontSize: number = 26; // px
const buttonWidth: number = 150; // px
const buttonHeight: number = 40; // px
const buttonGap: number = 8; // px
const buttonSlant: number = 10; // px
const buttonIdleAlpha: number = 0.55;

function createButton(
  name: string,
  active: () => boolean,
  action: () => void,
): Button {
  const view: Container = new Container();
  const back: Graphics = new Graphics();
  const label: Text = new Text({
    text: name.toUpperCase(),
    style: {
      fontFamily: fontFamily,
      fontSize: buttonFontSize,
      fontStyle: "italic",
      fontWeight: "900",
      fill: 0xffffff,
    },
  });

  label.anchor.set(0, 0.5);
  label.position.set(buttonSlant + 10, buttonHeight / 2);
  view.addChild(back, label);
  view.eventMode = "static";
  view.cursor = "pointer";
  view.hitArea = new Rectangle(0, 0, buttonWidth, buttonHeight);
  view.on("pointertap", action);

  return { view: view, back: back, label: label, active: active };
}

function paintButton(button: Button): void {
  const on: boolean = button.active();

  button.back
    .clear()
    .poly([
      buttonSlant,
      0,
      buttonWidth,
      0,
      buttonWidth - buttonSlant,
      buttonHeight,
      0,
      buttonHeight,
    ])
    .fill({
      color: on ? getTheme().highlight : getTheme().menuSelected,
      alpha: on ? 1 : buttonIdleAlpha,
    });
  button.label.tint = on ? getTheme().menuSelected : getTheme().menuText;
}

export {
  fontFamily,
  buttonWidth,
  buttonHeight,
  buttonGap,
  createButton,
  paintButton,
};
export type { Button };
