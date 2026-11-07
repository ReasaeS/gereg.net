import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import type {
  Character,
  Cutscene,
  Emotion,
  Line,
  Pace,
  Palette,
} from "./types";
import { getTexture } from "./images";
import { createText } from "../ui/text";
import { createGlide, type Glide } from "../ui/motion";
import { fieldHeight, fieldWidth } from "../game/field";

type Scene = {
  view: Container;
  play: (cutscene: Cutscene, index: number) => void;
  advance: () => void;
  update: (delta: number) => void;
  setPalette: (palette: Palette | null) => void;
  setAuto: (on: boolean) => void;
  finished: () => boolean;
};

const boxMargin: number = 12; // units
const boxHeight: number = 104; // units
const boxPadding: number = 12; // units
const boxColor: string = "#01040f";
const boxAlpha: number = 0.82;
const boxBorder: number = 1.5; // units
const nameSize: number = 13; // units
const textSize: number = 12; // units
const textGap: number = 22; // units
const portraitWidth: number = 180; // units
const portraitHeight: number = 280; // units
const portraitOverlap: number = 24; // units
const portraitX: number = 0.25; // of field width
const lineHold: number = 1.5; // s
const voiceEvery: number = 2;
const arrowSize: number = 5; // units
const arrowBob: number = 2; // units
const arrowRate: number = 4; // rad/s
const focusAlpha: number = 0.85;
const focusWidth: number = 0.7; // of field width
const focusTextSize: number = 15; // units
const focusGap: number = 10; // units
const focusSmoothing: number = 0.2; // s

function speakerOf(cast: Array<Character>, line: Line): Character | null {
  return cast.find((value: Character) => value.id === line.character) ?? null;
}

function feelingOf(character: Character, line: Line): Emotion | null {
  return (
    character.emotions.find((value: Emotion) => value.id === line.emotion) ??
    character.emotions[0] ??
    null
  );
}

function castOf(cutscene: Cutscene, cast: Array<Character>): Array<Character> {
  const speakers: Array<Character> = new Array();

  for (const line of cutscene.lines) {
    const speaker: Character | null = speakerOf(cast, line);

    if (speaker !== null && !speakers.includes(speaker)) {
      speakers.push(speaker);
    }
  }

  return speakers;
}

function createScene(
  speak: (cutscene: Cutscene) => void,
  say: (line: Line) => void,
  cast: () => Array<Character>,
  autoAdvance: boolean,
  looping: boolean = true,
): Scene {
  const view: Container = new Container();
  const portrait: Sprite = new Sprite();
  const box: Graphics = new Graphics();
  const arrow: Graphics = new Graphics();
  const pointer: Container = new Container();
  const shade: Graphics = new Graphics();
  const name: Text = createText(nameSize, "#ffffff");
  const body: Text = createText(textSize, "#ffffff");
  const boxTop: number = fieldHeight - boxMargin - boxHeight;
  const boxWidth: number = fieldWidth - boxMargin * 2;
  let scene: Cutscene | null = null;
  let index: number = 0;
  let typed: number = 0;
  let shown: number = -1;
  let hold: number = 0;
  let colors: Palette | null = null;
  let bob: number = 0;
  let auto: boolean = autoAdvance;
  let done: boolean = false;
  const focus: Glide = createGlide(
    0,
    (value: number) => {
      shade.alpha = value * focusAlpha;
      shade.visible = value > 0;
      box.alpha = 1 - value;
      portrait.alpha = 1 - value;
    },
    focusSmoothing,
  );

  function line(): Line | null {
    return scene?.lines[index] ?? null;
  }

  function speaker(): Character | null {
    const current: Line | null = line();

    return scene === null || current === null
      ? null
      : speakerOf(cast(), current);
  }

  function drawPortrait(): void {
    const talking: Character | null = speaker();
    const current: Line | null = line();
    const texture: Texture | null =
      talking === null || current === null
        ? null
        : getTexture(feelingOf(talking, current)?.sprite ?? null);

    portrait.visible = texture !== null;

    if (texture === null) {
      return;
    }

    portrait.texture = texture;
    portrait.scale.set(
      Math.min(portraitWidth / texture.width, portraitHeight / texture.height),
    );
  }

  function placeText(): void {
    const current: Line | null = line();

    if (current?.focus !== true) {
      focus.set(0);
      name.anchor.set(0, 0);
      body.anchor.set(0, 0);
      body.style.align = "left";
      body.style.fontSize = textSize;
      body.style.wordWrapWidth = boxWidth - boxPadding * 2;
      name.position.set(boxMargin + boxPadding, boxTop + boxPadding);
      body.position.set(boxMargin + boxPadding, boxTop + boxPadding + textGap);
      pointer.position.set(
        boxMargin + boxWidth - boxPadding - arrowSize,
        boxTop + boxHeight - boxPadding,
      );
      return;
    }

    focus.set(1);
    name.anchor.set(0.5, 1);
    body.anchor.set(0.5, 0);
    body.style.align = "center";
    body.style.fontSize = focusTextSize;
    body.style.wordWrapWidth = fieldWidth * focusWidth;
    body.text = current.text;

    const height: number = body.height;
    const top: number = fieldHeight / 2 - height / 2;

    body.text = "";
    name.position.set(fieldWidth / 2, top - focusGap);
    body.position.set(fieldWidth / 2, top);
    pointer.position.set(fieldWidth / 2, top + height + focusGap + arrowSize);
  }

  function drawLine(): void {
    const talking: Character | null = speaker();

    name.text = talking?.name.toUpperCase() ?? "";
    name.style.fill = colors?.label ?? talking?.color ?? "#ffffff";
    shown = -1;
    drawPortrait();
    placeText();
  }

  function play(cutscene: Cutscene, start: number): void {
    scene = cutscene;
    index = Math.min(Math.max(start, 0), cutscene.lines.length - 1);
    typed = 0;
    hold = 0;
    done = false;
    drawLine();
    say(cutscene.lines[index]!);
  }

  function next(): void {
    if (scene === null || scene.lines.length === 0) {
      return;
    }

    if (!looping && index >= scene.lines.length - 1) {
      done = true;
      return;
    }

    index = (index + 1) % scene.lines.length;
    typed = 0;
    hold = 0;
    drawLine();
    say(scene.lines[index]!);
  }

  function advance(): void {
    const current: Line | null = line();

    if (current !== null && typed < current.text.length) {
      typed = current.text.length;
      return;
    }

    next();
  }

  function update(delta: number): void {
    const current: Line | null = line();

    if (scene === null || current === null) {
      body.text = "";
      return;
    }

    const before: number = Math.floor(typed);
    let left: number = delta;

    while (left > 0 && typed < current.text.length) {
      const at: number = Math.floor(typed);
      const rate: number =
        current.paces?.find((pace: Pace) => at >= pace.from && at < pace.to)
          ?.speed ?? scene.speed;
      const need: number = (at + 1 - typed) / rate;

      if (need > left) {
        typed += rate * left;
        break;
      }

      typed = at + 1;
      left -= need;
    }

    const after: number = Math.floor(typed);

    for (let at = before; at < after; at++) {
      if (
        current.sound === undefined &&
        current.text[at]!.trim() !== "" &&
        at % voiceEvery === 0
      ) {
        speak(scene);
        break;
      }
    }

    if (after !== shown) {
      shown = after;
      body.text = current.text.slice(0, after);
    }

    drawPortrait();
    bob += delta * arrowRate;
    arrow.visible = typed >= current.text.length;
    arrow.y = Math.sin(bob) * arrowBob;

    if (auto && !done && typed >= current.text.length) {
      hold += delta;

      if (hold >= lineHold) {
        next();
      }
    }
  }

  function drawBox(): void {
    box
      .clear()
      .rect(boxMargin, boxTop, boxWidth, boxHeight)
      .fill({ color: boxColor, alpha: boxAlpha })
      .stroke({
        color: colors?.accent ?? "#ffffff",
        width: boxBorder,
        alignment: 1,
      });
    arrow
      .clear()
      .poly([-arrowSize, -arrowSize, arrowSize, -arrowSize, 0, 0])
      .fill(colors?.highlight ?? "#ffffff");
    shade.clear().rect(0, 0, fieldWidth, fieldHeight).fill(boxColor);
    body.tint = colors?.text ?? "#ffffff";
  }

  function setPalette(palette: Palette | null): void {
    colors = palette;
    drawBox();
    drawLine();
  }

  drawBox();
  arrow.visible = false;
  body.style.wordWrap = true;
  placeText();
  focus.snap(0);
  pointer.addChild(arrow);

  portrait.anchor.set(0.5, 1);
  portrait.position.set(fieldWidth * portraitX, boxTop + portraitOverlap);
  view.addChild(portrait, box, shade, name, body, pointer);

  return {
    view: view,
    play: play,
    advance: advance,
    update: update,
    setPalette: setPalette,
    setAuto: (on: boolean) => {
      auto = on;
    },
    finished: () => done,
  };
}

export { createScene, speakerOf, feelingOf, castOf };
export type { Scene };
