import { Container, Text, type Application } from "pixi.js";
import {
  buttonGap,
  buttonHeight,
  buttonWidth,
  createButton,
  fontFamily,
  paintButton,
  type Button,
} from "../editor/button";
import { getSky, onSky, setSky, type Sky } from "./settings";
import type { PageContent } from "../menu/page";
import { getTheme } from "../theme/theme";

const labelSize: number = 34; // px
const labelGap: number = 24; // px
const panelCenterY: number = 0.5; // of screen height
const skies: Array<Sky> = ["day", "night"];

function createSettings(app: Application): PageContent {
  const view: Container = new Container();
  const row: Container = new Container();
  const label: Text = new Text({
    text: "SKY",
    style: {
      fontFamily: fontFamily,
      fontSize: labelSize,
      fontStyle: "italic",
      fontWeight: "900",
      fill: 0xffffff,
    },
  });
  const buttons: Array<Button> = new Array();
  let active: boolean = false;

  label.anchor.set(0, 0.5);
  label.position.set(0, buttonHeight / 2);
  row.addChild(label);

  for (let index = 0; index < skies.length; index++) {
    const sky: Sky = skies[index]!;
    const button: Button = createButton(
      sky,
      () => getSky() === sky,
      () => setSky(sky),
    );

    button.view.position.set(
      label.width + labelGap + index * (buttonWidth + buttonGap),
      0,
    );
    buttons.push(button);
    row.addChild(button.view);
  }

  view.addChild(row);

  function refresh(): void {
    label.tint = getTheme().menuText;

    for (let index = 0; index < buttons.length; index++) {
      paintButton(buttons[index]!);
    }
  }

  function layout(): void {
    row.position.set(
      Math.round(app.screen.width / 2 - row.width / 2),
      Math.round(app.screen.height * panelCenterY - buttonHeight / 2),
    );
  }

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!active || event.altKey) {
      return;
    }

    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      setSky("day");
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      setSky("night");
    } else {
      return;
    }

    event.preventDefault();
  });

  function setActive(value: boolean): void {
    active = value;
    view.eventMode = value ? "passive" : "none";
  }

  onSky(refresh);
  layout();
  setActive(false);
  app.renderer.on("resize", layout);

  return { view: view, setActive: setActive };
}

export { createSettings };
