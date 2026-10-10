import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import type { Character, Cutscene, Emotion, Line } from "./data";
import { getTexture } from "./images";
import { createText } from "./widgets";
import { fieldHeight, fieldWidth } from "../game/hud";

type Scene = {
  view: Container;
  play: (cutscene: Cutscene, index: number) => void;
  advance: () => void;
  update: (delta: number) => void;
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
): Scene {
  const view: Container = new Container();
  const portrait: Sprite = new Sprite();
  const box: Graphics = new Graphics();
  const name: Text = createText(nameSize, "#ffffff");
  const body: Text = createText(textSize, "#ffffff");
  const boxTop: number = fieldHeight - boxMargin - boxHeight;
  const boxWidth: number = fieldWidth - boxMargin * 2;
  let scene: Cutscene | null = null;
  let index: number = 0;
  let typed: number = 0;
  let shown: number = -1;
  let hold: number = 0;

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
    name.style.fill = talking?.color ?? "#ffffff";
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

    if (typed >= current.text.length) {
      hold += delta;

      if (hold >= lineHold) {
        next();
      }
    }
  }

  box
    .rect(boxMargin, boxTop, boxWidth, boxHeight)
    .fill({ color: boxColor, alpha: boxAlpha })
    .stroke({ color: "#ffffff", width: boxBorder, alignment: 1 });
  name.position.set(boxMargin + boxPadding, boxTop + boxPadding);
  body.position.set(boxMargin + boxPadding, boxTop + boxPadding + textGap);
  body.style.wordWrap = true;
  body.style.wordWrapWidth = boxWidth - boxPadding * 2;

  portrait.anchor.set(0.5, 1);
  portrait.position.set(fieldWidth * portraitX, boxTop + portraitOverlap);
  view.addChild(portrait, box, name, body);

  return { view: view, play: play, advance: advance, update: update };
}

export { createScene, speakerOf, feelingOf, castOf };
export type { Scene };
