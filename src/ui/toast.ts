import {
  Container,
  Graphics,
  Text,
  type Application,
  type Ticker,
} from "pixi.js";
import { getTheme } from "../theme/theme";
import { createGlide, type Glide } from "./motion";
import { createText } from "./text";

type Toast = {
  view: Container;
  show: (message: string) => void;
};

const toastSize: number = 15; // px
const toastPadding: number = 18; // px
const toastHeight: number = 36; // px
const toastBottom: number = 0.9; // of screen height
const toastRise: number = 14; // px
const toastSlant: number = 10; // px
const toastAlpha: number = 0.9;
const toastTime: number = 1.6; // s
const toastSmoothing: number = 0.1; // s

function createToast(app: Application): Toast {
  const view: Container = new Container();
  const back: Graphics = new Graphics();
  const label: Text = createText(toastSize, "#ffffff");
  const shown: Glide = createGlide(0, place, toastSmoothing);
  let remaining: number = 0;

  function place(value: number): void {
    view.alpha = value;
    view.visible = value > 0;
    view.position.set(
      Math.round(app.screen.width / 2),
      Math.round(app.screen.height * toastBottom + toastRise * (1 - value)),
    );
  }

  function show(message: string): void {
    label.text = message.toUpperCase();

    const width: number = label.width + toastPadding * 2;

    back
      .clear()
      .poly([
        -width / 2 + toastSlant,
        -toastHeight / 2,
        width / 2,
        -toastHeight / 2,
        width / 2 - toastSlant,
        toastHeight / 2,
        -width / 2,
        toastHeight / 2,
      ])
      .fill({ color: "#01040f", alpha: toastAlpha })
      .stroke({ color: getTheme().accent, width: 1.5 });
    remaining = toastTime;
    shown.set(1);
  }

  label.anchor.set(0.5);
  view.addChild(back, label);
  view.visible = false;
  view.alpha = 0;
  view.eventMode = "none";
  app.ticker.add((ticker: Ticker) => {
    if (remaining <= 0) {
      return;
    }

    remaining -= ticker.deltaMS / 1000;

    if (remaining <= 0) {
      shown.set(0);
    }
  });
  app.renderer.on("resize", () => place(shown.value()));

  return { view: view, show: show };
}

export { createToast };
export type { Toast };
