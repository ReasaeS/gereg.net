import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import type { Character, Cutscene, Emotion, Line, Palette } from "./types";
import { getTexture } from "./images";
import { createText } from "../ui/text";
import { fieldHeight, fieldWidth } from "../game/field";

type Scene = {
  view: Container;
  play: (cutscene: Cutscene, index: number) => void;
  advance: () => void;
  update: (delta: number) => void;
  setPalette: (palette: Palette | null) => void;
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
  cast: () => Array<Character>,
  autoAdvance: boolean,
): Scene {
  const view: Container = new Container();
  const portrait: Sprite = new Sprite();
  const box: Graphics = new Graphics();
  const arrow: Graphics = new Graphics();
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

  function drawLine(): void {
    const talking: Character | null = speaker();

    name.text = talking?.name.toUpperCase() ?? "";
    name.style.fill = colors?.label ?? talking?.color ?? "#ffffff";
    shown = -1;
    drawPortrait();
  }

  function play(cutscene: Cutscene, start: number): void {
    scene = cutscene;
    index = Math.min(Math.max(start, 0), cutscene.lines.length - 1);
    typed = 0;
    hold = 0;
    drawLine();
  }

  function next(): void {
    if (scene === null || scene.lines.length === 0) {
      return;
    }

    index = (index + 1) % scene.lines.length;
    typed = 0;
    hold = 0;
    drawLine();
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

    typed = Math.min(typed + scene.speed * delta, current.text.length);

    const after: number = Math.floor(typed);

    for (let at = before; at < after; at++) {
      if (current.text[at]!.trim() !== "" && at % voiceEvery === 0) {
        speak(scene);
        break;
      }
    }

    if (after !== shown) {
      shown = after;
      body.text = current.text.slice(0, after);
    }

    bob += delta * arrowRate;
    arrow.visible = typed >= current.text.length;
    arrow.y = Math.sin(bob) * arrowBob;

    if (autoAdvance && typed >= current.text.length) {
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
      .poly([
        boxMargin + boxWidth - boxPadding - arrowSize * 2,
        boxTop + boxHeight - boxPadding - arrowSize,
        boxMargin + boxWidth - boxPadding,
        boxTop + boxHeight - boxPadding - arrowSize,
        boxMargin + boxWidth - boxPadding - arrowSize,
        boxTop + boxHeight - boxPadding,
      ])
      .fill(colors?.highlight ?? "#ffffff");
    body.tint = colors?.text ?? "#ffffff";
  }

  function setPalette(palette: Palette | null): void {
    colors = palette;
    drawBox();
    drawLine();
  }

  drawBox();
  arrow.visible = false;
  name.position.set(boxMargin + boxPadding, boxTop + boxPadding);
  body.position.set(boxMargin + boxPadding, boxTop + boxPadding + textGap);
  body.style.wordWrap = true;
  body.style.wordWrapWidth = boxWidth - boxPadding * 2;

  portrait.anchor.set(0.5, 1);
  portrait.position.set(fieldWidth * portraitX, boxTop + portraitOverlap);
  view.addChild(portrait, box, name, body, arrow);

  return {
    view: view,
    play: play,
    advance: advance,
    update: update,
    setPalette: setPalette,
  };
}

export { createScene, speakerOf, feelingOf, castOf };
export type { Scene };
