import { Rectangle, type Text } from "pixi.js";
import { getTheme } from "../theme/theme";
import { createGlide, mix, type Glide } from "./motion";
import { createShadowText } from "./text";

type Word = {
  view: Text;
  active: () => boolean;
  lit: Glide;
  hover: Glide;
};

const shadowColor: string = "#020b30";
const shadowDistance: number = 3; // px
const dimAlpha: number = 0.3;
const hoverLight: number = 0.55;
const hitPadding: number = 8; // px

function drawWord(word: Word): void {
  const light: number = Math.max(
    word.lit.value(),
    word.hover.value() * hoverLight,
  );

  word.view.alpha = dimAlpha + (1 - dimAlpha) * light;
  word.view.tint = mix(getTheme().menuText, getTheme().highlight, light);
}

function fitWord(word: Word): void {
  word.view.hitArea = new Rectangle(
    -hitPadding,
    -word.view.height / 2 - hitPadding,
    word.view.width + hitPadding * 2,
    word.view.height + hitPadding * 2,
  );
}

function createWord(
  text: string,
  size: number,
  active: () => boolean,
  action: () => void,
): Word {
  const view: Text = createShadowText(
    text.toUpperCase(),
    size,
    "#ffffff",
    shadowColor,
    shadowDistance,
  );
  const word: Word = {
    view: view,
    active: active,
    lit: createGlide(active() ? 1 : 0, () => drawWord(word)),
    hover: createGlide(0, () => drawWord(word)),
  };

  view.anchor.set(0, 0.5);
  view.eventMode = "static";
  view.cursor = "pointer";
  view.on("pointertap", action);
  view.on("pointerover", () => word.hover.set(1));
  view.on("pointerout", () => word.hover.set(0));
  fitWord(word);
  drawWord(word);

  return word;
}

function paintWord(word: Word): void {
  word.lit.set(word.active() ? 1 : 0);
  drawWord(word);
}

function setWord(word: Word, text: string): void {
  if (word.view.text !== text.toUpperCase()) {
    word.view.text = text.toUpperCase();
    fitWord(word);
  }
}

export { createWord, paintWord, setWord, fitWord };
export type { Word };
