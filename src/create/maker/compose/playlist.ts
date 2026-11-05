import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type FederatedPointerEvent,
  type FederatedWheelEvent,
  type Point,
} from "pixi.js";
import type { Channel, Clip, Note, Score, Sequence } from "../../types";
import { songSteps, stepsPerBar } from "../../jungle";
import {
  addTrack,
  pitched,
  placeClip,
  removeTrack,
  songBarsMost,
} from "../../arrange";
import { createLabelText, fitText } from "../../../ui/text";
import { buttonHeight, createButton, type Button } from "./controls";
import {
  areaLeft,
  areaTop,
  areaWidth,
  accentColor,
  barLine,
  beatLine,
  blackKey,
  blackRow,
  dimColor,
  hoverAlpha,
  panelColor,
  patternColor,
  stripColor,
  toolbarColor,
  whiteRow,
  smallSize,
  textColor,
  clipSize,
  type Panel,
  type Session,
} from "./shared";

type Drag = {
  kind: "move" | "resize" | "erase";
  clip: Clip | null;
  offset: number;
};

const rulerHeight: number = 12; // units
const gridTop: number = 16; // units
const labelWidth: number = 48; // units
const shownTracks: number = 8;
const removeWidth: number = 12; // units
const addWidth: number = labelWidth - 6; // units
const trackHeight: number = 32; // units
const gridWidth: number = areaWidth - labelWidth; // units
const shownBars: number = 16;
const barWidth: number = gridWidth / shownBars; // units
const stepWidth: number = barWidth / stepsPerBar; // units
const clipInset: number = 1.5; // units
const headerHeight: number = 13; // units
const edgeWidth: number = 6; // units
const markLimit: number = 3000;
const pickerTop: number = gridTop + shownTracks * trackHeight + 10; // units
const pickerWidth: number = 66; // units
const pickerGap: number = 6; // units
const pickerColumns: number = 7;
const pickerRows: number = 2;
const endAlpha: number = 0.8;

function createPlaylist(session: Session): Panel {
  const view: Container = new Container();
  const grid: Container = new Container();
  const back: Graphics = new Graphics();
  const clipsDrawn: Graphics = new Graphics();
  const names: Container = new Container();
  const layer: Container = new Container();
  const frame: Graphics = new Graphics()
    .rect(labelWidth, gridTop, gridWidth, shownTracks * trackHeight)
    .fill("#ffffff");
  const hover: Graphics = new Graphics();
  const playhead: Graphics = new Graphics();
  const ruler: Container = new Container();
  const rulerTexts: Array<Text> = new Array();
  const trackTexts: Array<Text> = new Array();
  const picker: Container = new Container();
  const pickerChips: Array<Button> = new Array();
  const removers: Array<Button> = new Array();
  const add: Button = createButton("+ Track", addWidth, () => {
    session.record();
    addTrack(score());
    firstTrack = Math.max(score().tracks - shownTracks, 0);
    session.edited();
    redraw();
  });
  let firstBar: number = 0;
  let firstTrack: number = 0;
  let drag: Drag | null = null;
  let built: string = "";

  function score(): Score {
    return session.score();
  }

  function patternOf(clip: Clip): Sequence | undefined {
    return score().patterns.find(
      (pattern: Sequence) => pattern.id === clip.pattern,
    );
  }

  function firstStep(): number {
    return firstBar * stepsPerBar;
  }

  function drawBack(): void {
    back
      .clear()
      .rect(0, 0, labelWidth + gridWidth, rulerHeight + 2)
      .fill(toolbarColor)
      .rect(0, gridTop, labelWidth - 1, shownTracks * trackHeight)
      .fill(stripColor);

    for (let row = 0; row < shownTracks; row++) {
      const track: number = firstTrack + row;

      back
        .rect(labelWidth, gridTop + row * trackHeight, gridWidth, trackHeight)
        .fill(
          track >= score().tracks
            ? panelColor
            : track % 2 === 0
              ? whiteRow
              : blackRow,
        );
    }

    trackTexts.forEach((text: Text, row: number) => {
      const track: number = firstTrack + row;

      text.text = "Track " + (track + 1);
      text.visible = track < score().tracks;
      removers[row]!.view.visible = text.visible && score().tracks > 1;
    });

    for (let bar = 0; bar <= shownBars; bar++) {
      back
        .rect(
          labelWidth + bar * barWidth - 0.25,
          gridTop,
          0.5,
          shownTracks * trackHeight,
        )
        .fill({
          color: (firstBar + bar) % 4 === 0 ? barLine : beatLine,
          alpha: 1,
        });
    }

    const end: number = (songSteps(score()) - firstStep()) * stepWidth;

    if (end > 0 && end <= gridWidth) {
      back
        .rect(labelWidth + end - 1, gridTop, 2, shownTracks * trackHeight)
        .fill({ color: "#ffffff", alpha: endAlpha });
    }

    rulerTexts.forEach((text: Text, bar: number) => {
      text.text = String(firstBar + bar + 1);
      text.position.set(labelWidth + bar * barWidth + 2, rulerHeight / 2);
    });
  }

  function marks(clip: Clip, pattern: Sequence, x: number, y: number): void {
    const channels: Array<Channel> = score().channels;
    const span: number = pattern.bars * stepsPerBar;
    const body: number = trackHeight - headerHeight - clipInset * 3;
    const used: Array<Note> = channels
      .filter((channel: Channel) => pitched(channel))
      .flatMap((channel: Channel) => pattern.notes[channel.id] ?? new Array());
    const low: number = Math.min(
      ...used.map((note: Note) => note.pitch),
      Number.POSITIVE_INFINITY,
    );
    const high: number = Math.max(
      ...used.map((note: Note) => note.pitch),
      Number.NEGATIVE_INFINITY,
    );
    const unpitched: Array<Channel> = channels.filter(
      (channel: Channel) => !pitched(channel),
    );
    let count: number = 0;

    for (let offset = 0; offset < clip.length; offset += span) {
      channels.forEach((channel: Channel) => {
        const tone: boolean = pitched(channel);
        const lane: number = unpitched.indexOf(channel);

        for (const note of pattern.notes[channel.id] ?? new Array()) {
          const start: number = offset + note.step;

          if (start >= clip.length || count > markLimit) {
            continue;
          }

          const share: number = tone
            ? high > low
              ? 1 - (note.pitch - low) / (high - low)
              : 0.5
            : (lane + 0.5) / Math.max(unpitched.length, 1);

          count++;
          clipsDrawn
            .rect(
              x + start * stepWidth,
              y + share * (body - 1),
              Math.max(
                Math.min(note.length, clip.length - start) * stepWidth - 0.5,
                0.75,
              ),
              1,
            )
            .fill({ color: blackKey, alpha: tone ? 0.85 : 0.5 });
        }
      });
    }
  }

  function drawClips(): void {
    clipsDrawn.clear();

    for (const child of names.removeChildren()) {
      child.destroy();
    }

    for (const clip of score().clips) {
      const pattern: Sequence | undefined = patternOf(clip);
      const start: number = clip.step - firstStep();

      if (
        pattern === undefined ||
        clip.track < firstTrack ||
        clip.track >= firstTrack + shownTracks ||
        start + clip.length <= 0 ||
        start >= shownBars * stepsPerBar
      ) {
        continue;
      }

      const x: number = labelWidth + start * stepWidth;
      const y: number = gridTop + (clip.track - firstTrack) * trackHeight;
      const lit: boolean = pattern === session.pattern();
      const left: number = Math.max(x, labelWidth);
      const right: number = Math.min(
        x + clip.length * stepWidth,
        labelWidth + gridWidth,
      );
      const name: Text = createLabelText(clipSize, blackKey, false);

      clipsDrawn
        .rect(
          left + clipInset,
          y + clipInset,
          right - left - clipInset * 2,
          trackHeight - clipInset * 2,
        )
        .fill({ color: patternColor(score(), pattern), alpha: lit ? 1 : 0.75 })
        .rect(
          left + clipInset,
          y + clipInset,
          right - left - clipInset * 2,
          headerHeight,
        )
        .fill({ color: "#ffffff", alpha: 0.55 });

      for (
        let repeat = pattern.bars * stepsPerBar;
        repeat < clip.length;
        repeat += pattern.bars * stepsPerBar
      ) {
        const at: number = x + repeat * stepWidth;

        if (at > left && at < right) {
          clipsDrawn
            .rect(at - 0.5, y + clipInset, 1, trackHeight - clipInset * 2)
            .fill({ color: blackKey, alpha: 0.4 });
        }
      }

      marks(clip, pattern, x + clipInset, y + clipInset * 2 + headerHeight);
      name.anchor.set(0, 0.5);
      name.position.set(left + clipInset + 2, y + clipInset + headerHeight / 2);
      fitText(name, pattern.name, right - left - clipInset * 2 - 4);
      names.addChild(name);
    }
  }

  function buildPicker(): void {
    const signature: string = JSON.stringify(
      score().patterns.map((pattern: Sequence) => [pattern.id, pattern.name]),
    );

    if (signature === built) {
      return;
    }

    built = signature;

    for (const child of picker.removeChildren()) {
      child.destroy({ children: true });
    }

    pickerChips.length = 0;
    score()
      .patterns.slice(0, pickerColumns * pickerRows)
      .forEach((pattern: Sequence, index: number) => {
        const chip: Button = createButton(
          pattern.name.slice(0, 10),
          pickerWidth,
          () => session.choosePattern(pattern),
          () => session.pattern() === pattern,
        );

        chip.view.position.set(
          labelWidth + (index % pickerColumns) * (pickerWidth + pickerGap),
          Math.floor(index / pickerColumns) * (pickerGap * 3),
        );
        picker.addChild(chip.view);
        pickerChips.push(chip);
      });
  }

  function redraw(): void {
    firstBar = Math.min(Math.max(firstBar, 0), songBarsMost - shownBars);
    firstTrack = Math.min(
      Math.max(firstTrack, 0),
      Math.max(score().tracks - shownTracks, 0),
    );
    drawBack();
    drawClips();
    buildPicker();

    for (const chip of pickerChips) {
      chip.paint();
    }
  }

  function pointAt(event: FederatedPointerEvent): [number, number] {
    const local: Point = view.toLocal(event.global);

    return [
      firstStep() + (local.x - labelWidth) / stepWidth,
      firstTrack + Math.floor((local.y - gridTop) / trackHeight),
    ];
  }

  function clipAt(step: number, track: number): Clip | null {
    const list: Array<Clip> = score().clips;

    for (let index = list.length - 1; index >= 0; index--) {
      const clip: Clip = list[index]!;

      if (
        clip.track === track &&
        clip.step <= step &&
        clip.step + clip.length > step
      ) {
        return clip;
      }
    }

    return null;
  }

  function erase(step: number, track: number): void {
    const found: Clip | null = clipAt(step, track);

    if (found === null) {
      return;
    }

    score().clips = score().clips.filter((clip: Clip) => clip !== found);
    redraw();
  }

  function begin(event: FederatedPointerEvent): void {
    const [step, track] = pointAt(event);

    if (
      track < firstTrack ||
      track >= Math.min(score().tracks, firstTrack + shownTracks) ||
      event.button === 1
    ) {
      return;
    }

    session.record();

    if (event.button === 2) {
      drag = { kind: "erase", clip: null, offset: 0 };
      erase(step, track);
      return;
    }

    const found: Clip | null = clipAt(step, track);

    if (found !== null) {
      const pattern: Sequence | undefined = patternOf(found);
      const end: number = (found.step + found.length - step) * stepWidth;

      drag = {
        kind: end <= edgeWidth ? "resize" : "move",
        clip: found,
        offset: Math.floor(step / stepsPerBar) * stepsPerBar - found.step,
      };

      if (pattern !== undefined && pattern !== session.pattern()) {
        session.choosePattern(pattern);
      }

      return;
    }

    const clip: Clip | null = placeClip(
      score(),
      session.pattern(),
      track,
      Math.floor(step / stepsPerBar) * stepsPerBar,
    );

    if (clip !== null) {
      drag = { kind: "move", clip: clip, offset: 0 };
      redraw();
    }
  }

  function move(event: FederatedPointerEvent): void {
    hover.clear();

    if (!view.visible) {
      return;
    }

    const [step, track] = pointAt(event);
    const bar: number = Math.floor(step / stepsPerBar);

    if (drag === null) {
      if (
        track >= firstTrack &&
        track < Math.min(score().tracks, firstTrack + shownTracks) &&
        bar >= firstBar &&
        bar < firstBar + shownBars
      ) {
        hover
          .rect(
            labelWidth + (bar - firstBar) * barWidth,
            gridTop + (track - firstTrack) * trackHeight,
            barWidth,
            trackHeight,
          )
          .fill({ color: "#ffffff", alpha: hoverAlpha });
      }

      return;
    }

    if (drag.kind === "erase") {
      erase(step, track);
      return;
    }

    const clip: Clip = drag.clip!;
    const most: number = songBarsMost * stepsPerBar;

    if (drag.kind === "resize") {
      clip.length = Math.min(
        Math.max(
          Math.ceil(step / stepsPerBar) * stepsPerBar - clip.step,
          stepsPerBar,
        ),
        most - clip.step,
      );
    } else {
      clip.step = Math.min(
        Math.max(bar * stepsPerBar - drag.offset, 0),
        most - clip.length,
      );
      clip.track = Math.min(Math.max(track, 0), score().tracks - 1);
    }

    redraw();
  }

  function end(): void {
    if (drag === null) {
      return;
    }

    drag = null;
    session.edited();
  }

  function tick(): void {
    const step: number | null = session.playhead("song");

    playhead.clear();

    if (step === null) {
      return;
    }

    const x: number = (step - firstStep()) * stepWidth;

    if (x < 0 || x > gridWidth) {
      return;
    }

    playhead
      .rect(
        labelWidth + x - 0.75,
        gridTop - rulerHeight / 2,
        1.5,
        shownTracks * trackHeight + rulerHeight / 2,
      )
      .fill(accentColor);
  }

  function wheel(event: FederatedWheelEvent): void {
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      firstBar += Math.sign(event.deltaX || event.deltaY);
    } else {
      firstTrack += Math.sign(event.deltaY);
    }

    redraw();
  }

  function key(event: KeyboardEvent): boolean {
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      firstBar += event.code === "ArrowLeft" ? -4 : 4;
    } else if (event.code === "ArrowUp" || event.code === "ArrowDown") {
      firstTrack += event.code === "ArrowUp" ? -1 : 1;
    } else {
      return false;
    }

    redraw();
    return true;
  }

  for (let bar = 0; bar < shownBars; bar++) {
    const text: Text = createLabelText(smallSize + 1, dimColor);

    text.anchor.set(0, 0.5);
    rulerTexts.push(text);
    ruler.addChild(text);
  }

  for (let row = 0; row < shownTracks; row++) {
    const text: Text = createLabelText(clipSize, textColor);
    const remover: Button = createButton("×", removeWidth, () => {
      session.record();
      removeTrack(score(), firstTrack + row);
      session.edited();
      redraw();
    });

    text.anchor.set(0, 0);
    text.position.set(3, gridTop + row * trackHeight + 3);
    remover.view.position.set(
      labelWidth - removeWidth - 3,
      gridTop + row * trackHeight + trackHeight - buttonHeight - 3,
    );
    trackTexts.push(text);
    removers.push(remover);
    ruler.addChild(text);
    view.addChild(remover.view);
  }

  grid.eventMode = "static";
  grid.cursor = "pointer";
  grid.hitArea = new Rectangle(
    labelWidth,
    gridTop,
    gridWidth,
    shownTracks * trackHeight,
  );
  layer.addChild(clipsDrawn, names);
  layer.mask = frame;
  grid.addChild(back, layer, frame, playhead, hover);
  grid.on("pointerdown", begin);
  grid.on("globalpointermove", move);
  grid.on("pointerup", end);
  grid.on("pointerupoutside", end);
  grid.on("pointerleave", () => hover.clear());
  grid.on("wheel", wheel);
  ruler.eventMode = "none";
  picker.y = pickerTop;
  view.position.set(areaLeft, areaTop);
  add.view.position.set(0, pickerTop);
  view.addChild(grid, ruler, picker, add.view);

  return { view: view, redraw: redraw, tick: tick, key: key };
}

export { createPlaylist };
