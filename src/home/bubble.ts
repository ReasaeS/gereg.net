import {
  CanvasTextMetrics,
  Container,
  Graphics,
  Text,
  type Point,
  type TextStyle,
} from "pixi.js";
import { getTheme } from "../theme/theme";
import { createText } from "../ui/text";
import { createGlide, type Glide } from "../ui/motion";
import { playSound } from "../create/sound";
import type { Sound } from "../create/types";
import { roomWidth } from "./room";

type Bubble = {
  view: Container;
  say: (
    name: string,
    text: string,
    anchor: () => Point,
    voiced: boolean,
  ) => void;
  hide: () => void;
  update: (delta: number) => void;
  talking: () => boolean;
  speaker: () => string;
  shown: () => boolean;
};

const maxWidth: number = 480; // units
const padding: number = 22; // units
const slant: number = 14; // units
const tail: number = 26; // units
const tailWidth: number = 12; // units
const nameSize: number = 18; // units
const nameGap: number = 26; // units
const bodySize: number = 24; // units
const lineHeight: number = 30; // units
const margin: number = 30; // units
const rise: number = 14; // units
const panelColor: string = "#01040f";
const panelAlpha: number = 0.92;
const typeRate: number = 55; // letters/s
const stopPause: number = 0.2; // s
const commaPause: number = 0.07; // s
const blipEvery: number = 3;
const blipSpread: number = 0.12;
const lingerBase: number = 1.8; // s
const lingerPerLetter: number = 0.045; // s
const fadeSmoothing: number = 0.08; // s

function createBubble(voice: Sound | null): Bubble {
  const view: Container = new Container();
  const back: Graphics = new Graphics();
  const name: Text = createText(nameSize, getTheme().accent);
  const body: Text = createText(bodySize, "#ffffff");
  const shown: Glide = createGlide(
    0,
    (value: number) => {
      view.alpha = value;
      view.visible = value > 0;
    },
    fadeSmoothing,
  );
  let anchor: (() => Point) | null = null;
  let full: string = "";
  let typed: number = 0;
  let wait: number = 0;
  let letters: number = 0;
  let linger: number = 0;
  let voiced: boolean = false;
  let open: boolean = false;
  let width: number = 0;
  let height: number = 0;
  let speaker: string = "";

  function wrap(text: string): string {
    const style: TextStyle = body.style.clone();

    style.wordWrap = true;
    style.wordWrapWidth = maxWidth - padding * 2 - slant;

    return CanvasTextMetrics.measureText(text, style).lines.join("\n");
  }

  function say(
    label: string,
    text: string,
    point: () => Point,
    withVoice: boolean,
  ): void {
    const lines: string = wrap(text);
    const measured: number = CanvasTextMetrics.measureText(
      lines,
      body.style,
    ).width;

    name.text = label.toUpperCase();
    name.style.fill = getTheme().accent;
    full = lines;
    typed = 0;
    wait = 0;
    letters = 0;
    linger = lingerBase + text.length * lingerPerLetter;
    voiced = withVoice;
    anchor = point;
    speaker = label;
    open = true;
    body.text = "";
    width = Math.max(measured, name.width) + padding * 2 + slant;
    height = padding * 2 + nameGap + lines.split("\n").length * lineHeight;
    shown.set(1);
  }

  function blip(): void {
    if (voice === null || !voiced) {
      return;
    }

    const factor: number = 1 + (Math.random() * 2 - 1) * blipSpread;

    playSound({
      ...voice,
      pitch: voice.pitch * factor,
      slide: voice.slide * factor,
    });
  }

  function typing(): boolean {
    return open && typed < full.length;
  }

  function draw(point: Point): void {
    const left: number =
      Math.min(
        Math.max(point.x - width / 2, margin),
        roomWidth - margin - width,
      ) - point.x;
    const right: number = left + width;
    const bottom: number = -tail;
    const top: number = bottom - height;
    const tip: number = Math.min(
      Math.max(0, left + tailWidth * 2),
      right - tailWidth * 2,
    );

    back
      .clear()
      .poly([
        left,
        bottom,
        tip - tailWidth,
        bottom,
        0,
        0,
        tip + tailWidth,
        bottom,
        right,
        bottom,
        right + slant,
        top,
        left + slant,
        top,
      ])
      .fill({ color: panelColor, alpha: panelAlpha })
      .stroke({ color: getTheme().highlight, width: 2, join: "round" });
    name.position.set(left + padding + slant, top + padding);
    body.position.set(left + padding + slant / 2, top + padding + nameGap);
  }

  function update(delta: number): void {
    if (typing()) {
      wait -= delta;

      while (wait <= 0 && typed < full.length) {
        const letter: string = full[typed] ?? "";

        typed++;
        wait += 1 / typeRate;

        if (/[a-z0-9]/i.test(letter) && letters++ % blipEvery === 0) {
          blip();
        }

        if (".!?".includes(letter)) {
          wait += stopPause;
        } else if (letter === ",") {
          wait += commaPause;
        }
      }

      body.text = full.slice(0, typed);
    } else if (open) {
      linger -= delta;

      if (linger <= 0) {
        hide();
      }
    }

    if (anchor !== null && view.visible) {
      const point: Point = anchor();

      view.position.set(point.x, point.y + rise * (1 - shown.value()));
      draw(point);
    }
  }

  function hide(): void {
    open = false;
    shown.set(0);
  }

  view.addChild(back, name, body);
  view.visible = false;
  view.alpha = 0;

  return {
    view: view,
    say: say,
    hide: hide,
    update: update,
    talking: typing,
    speaker: () => speaker,
    shown: () => open,
  };
}

export { createBubble };
export type { Bubble };
