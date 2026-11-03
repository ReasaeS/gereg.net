import {
  Container,
  Graphics,
  Point,
  Rectangle,
  Text,
  type Application,
  type FederatedPointerEvent,
} from "pixi.js";
import type { Score, Sound } from "../types";
import {
  beatsPerBar,
  drumLanes,
  keyNames,
  kits,
  vowels,
  noteName,
  noteRows,
  scoreLength,
  stepCount,
  stepsPerBar,
} from "../jungle";
import { playTrack, stopPreview, type Track } from "../sound";
import { getTheme } from "../../theme/theme";
import { createText, screenResolution, sharpen } from "../../ui/text";
import { createGlide, type Glide } from "../../ui/motion";
import { chipHeight, createChip, type Chip } from "../../ui/widgets";
import { hudHeight, hudWidth } from "../../game/field";

type Part = "drums" | "bass" | "pads" | "vocals";

type Composer = {
  view: Container;
  open: (sound: Sound) => void;
  close: () => void;
  shown: () => boolean;
  layout: (scale: number) => void;
};

type Stroke = {
  value: number;
  erase: boolean;
};

type Clip = {
  part: Part;
  steps: Array<Array<number>>;
  kit: number;
  vowels: Array<number>;
};

const backdropColor: string = "#01040f";
const backdropAlpha: number = 0.97;
const titleSize: number = 16; // units
const titleY: number = 22; // units
const infoY: number = 38; // units
const toolbarY: number = 58; // units
const barsY: number = 80; // units
const gridLeft: number = 32; // units
const gridRight: number = 608; // units
const gridTop: number = 98; // units
const labelWidth: number = 44; // units
const labelSize: number = 9; // units
const cellHeight: number = 34; // units
const cellInset: number = 2; // units
const partWidth: number = 56; // units
const barWidth: number = 24; // units
const chipGap: number = 6; // units
const playWidth: number = 56; // units
const doneWidth: number = 60; // units
const muteWidth: number = 84; // units
const copyWidth: number = 70; // units
const kitWidth: number = 84; // units
const toolsGap: number = 10; // units
const hintSize: number = 8; // units
const hintGap: number = 10; // units
const infoSize: number = 9; // units
const laneColor: string = "#030c2a";
const beatColor: string = "#0a2160";
const labelColor: string = "#9fd8ff";
const bassColor: string = "#7ad8ff";
const padColor: string = "#b48aff";
const vocalColor: string = "#ff6fd8";
const ghostAlpha: number = 0.55;
const mutedAlpha: number = 0.3;
const hoverAlpha: number = 0.18;
const playheadAlpha: number = 0.16;
const sweepWidth: number = 2; // units
const partNames: Array<[Part, string]> = [
  ["drums", "Drums"],
  ["bass", "Bass"],
  ["pads", "Pads"],
  ["vocals", "Vocals"],
];

function createComposer(
  app: Application,
  changed: () => void,
  closed: () => void,
): Composer {
  const view: Container = new Container();
  const backdrop: Graphics = new Graphics();
  const board: Container = new Container();
  const title: Text = createText(titleSize, "#ffffff");
  const info: Text = createText(infoSize, labelColor);
  const hint: Text = createText(hintSize, labelColor);
  const grid: Container = new Container();
  const cells: Graphics = new Graphics();
  const hover: Graphics = new Graphics();
  const playhead: Graphics = new Graphics();
  const labels: Container = new Container();
  const barChips: Container = new Container();
  const barList: Array<Chip> = new Array();
  const tools: Container = new Container();
  const amount: Glide = createGlide(0, (value: number) => {
    view.alpha = value;
    view.visible = value > 0;
  });
  const fade: Glide = createGlide(1, (value: number) => {
    grid.alpha = value;
  });
  let sound: Sound | null = null;
  let part: Part = "drums";
  let bar: number = 0;
  let stroke: Stroke | null = null;
  let track: Track | null = null;
  let playing: boolean = false;
  let token: number = 0;
  let clip: Clip | null = null;
  const partChips: Array<Chip> = partNames.map(
    ([value, name]: [Part, string]) =>
      createChip(
        name,
        partWidth,
        () => choosePart(value),
        () => part === value,
      ),
  );
  const play: Chip = createChip(
    "Play",
    playWidth,
    togglePlaying,
    () => playing,
  );
  const done: Chip = createChip("Done", doneWidth, close);
  const mute: Chip = createChip("Mute", muteWidth, toggleMute, muted);
  const copy: Chip = createChip("Copy bar", copyWidth, copyBar);
  const paste: Chip = createChip("Paste bar", copyWidth, pasteBar);
  const kit: Chip = createChip("Kit", kitWidth, nextKit);
  const vowelRow: Container = new Container();
  const vowelChips: Array<Chip> = new Array();

  function score(): Score {
    return sound!.score;
  }

  function rows(): number {
    return part === "drums" ? drumLanes.length : noteRows;
  }

  function cellWidth(): number {
    return (gridRight - gridLeft - labelWidth) / stepsPerBar;
  }

  function line(): Array<number> {
    return part === "bass"
      ? score().bassline
      : part === "pads"
        ? score().pads
        : score().vocals;
  }

  function partIndex(): number {
    return partNames.findIndex(([value]: [Part, string]) => value === part);
  }

  function muted(): boolean {
    return sound !== null && score().mutes[partIndex()] === 1;
  }

  function edited(): void {
    changed();

    if (playing) {
      restart();
    }
  }

  function toggleMute(): void {
    const mutes: Array<number> = score().mutes;

    mutes[partIndex()] = mutes[partIndex()] === 1 ? 0 : 1;
    drawCells();
    paintChips();
    edited();
  }

  function nextKit(): void {
    score().kits[bar] = (score().kits[bar]! + 1) % kits.length;
    paintChips();
    edited();
  }

  function nextVowel(beat: number): void {
    const index: number = bar * beatsPerBar + beat;

    score().vowels[index] = (score().vowels[index]! + 1) % vowels.length;
    paintChips();
    edited();
  }

  function barSteps(list: Array<number>): Array<number> {
    return list.slice(bar * stepsPerBar, (bar + 1) * stepsPerBar);
  }

  function copyBar(): void {
    clip = {
      part: part,
      steps:
        part === "drums" ? score().drums.map(barSteps) : [barSteps(line())],
      kit: score().kits[bar]!,
      vowels: score().vowels.slice(bar * beatsPerBar, (bar + 1) * beatsPerBar),
    };
    copy.label.text = "COPIED";
  }

  function pasteBar(): void {
    if (clip === null || (clip.part === "drums") !== (part === "drums")) {
      return;
    }

    const targets: Array<Array<number>> =
      part === "drums" ? score().drums : [line()];

    clip.steps.forEach((steps: Array<number>, index: number) => {
      targets[index]!.splice(bar * stepsPerBar, stepsPerBar, ...steps);
    });

    if (clip.part === "drums") {
      score().kits[bar] = clip.kit;
    }

    if (clip.part === "vocals" && part === "vocals") {
      score().vowels.splice(bar * beatsPerBar, beatsPerBar, ...clip.vowels);
    }

    redraw(true);
    edited();
  }

  function degreeOf(row: number): number {
    return noteRows - 1 - row;
  }

  function cellColor(): string {
    return part === "drums"
      ? getTheme().ring
      : part === "bass"
        ? bassColor
        : part === "pads"
          ? padColor
          : vocalColor;
  }

  function filled(row: number, step: number): number {
    if (part === "drums") {
      return score().drums[row]?.[step] ?? 0;
    }

    return line()[step] === degreeOf(row) ? 1 : 0;
  }

  function drawCells(): void {
    const width: number = cellWidth();

    cells.clear();
    cells.alpha = muted() ? mutedAlpha : 1;

    for (let row = 0; row < rows(); row++) {
      for (let column = 0; column < stepsPerBar; column++) {
        const step: number = bar * stepsPerBar + column;
        const x: number = labelWidth + column * width;
        const y: number = row * cellHeight;

        cells
          .rect(
            x + cellInset / 2,
            y + cellInset / 2,
            width - cellInset,
            cellHeight - cellInset,
          )
          .fill(column % 4 === 0 ? beatColor : laneColor);

        if (filled(row, step) === 1) {
          const joined: boolean =
            part !== "drums" &&
            column > 0 &&
            line()[step - 1] === degreeOf(row);

          cells
            .rect(
              x + (joined ? -cellInset / 2 : cellInset * 1.5),
              y + cellInset * 1.5,
              width - (joined ? cellInset * 2 : cellInset * 3),
              cellHeight - cellInset * 3,
            )
            .fill({
              color: cellColor(),
              alpha: part === "drums" && row === 2 ? ghostAlpha : 1,
            });
        }
      }
    }
  }

  function drawLabels(): void {
    for (const child of labels.removeChildren()) {
      child.destroy();
    }

    for (let row = 0; row < rows(); row++) {
      const label: Text = createText(labelSize, labelColor);
      const degree: number = degreeOf(row);

      label.text =
        part === "drums"
          ? drumLanes[row]!.toUpperCase()
          : noteName(score(), degree) + (degree >= 7 ? "'" : "");
      label.anchor.set(0, 0.5);
      label.position.set(0, row * cellHeight + cellHeight / 2);
      labels.addChild(label);
    }
  }

  function buildBars(): void {
    for (const child of barChips.removeChildren()) {
      child.destroy({ children: true });
    }

    barList.length = 0;

    for (let index = 0; index < score().bars; index++) {
      const chip: Chip = createChip(
        String(index + 1),
        barWidth,
        () => chooseBar(index),
        () => bar === index,
      );

      chip.view.x = index * (barWidth + chipGap);
      barChips.addChild(chip.view);
      barList.push(chip);
    }
  }

  function paintChips(): void {
    for (const chip of partChips) {
      chip.paint();
    }

    for (const chip of barList) {
      chip.paint();
    }

    play.paint();
    play.label.text = playing ? "STOP" : "PLAY";
    mute.paint();
    mute.label.text = "MUTE " + part.toUpperCase();
    kit.label.text = "KIT: " + kits[score().kits[bar]!]!.name.toUpperCase();
    kit.view.visible = part === "drums";
    vowelChips.forEach((chip: Chip, beat: number) => {
      chip.label.text =
        vowels[score().vowels[bar * beatsPerBar + beat]!]!.name.toUpperCase();
    });
    vowelRow.visible = part === "vocals";
  }

  function describe(): void {
    const value: Score = score();

    title.text = sound!.name.toUpperCase();
    info.text =
      value.tempo +
      " BPM  ·  " +
      keyNames[value.key] +
      " MINOR  ·  " +
      (value.bass === "sub" ? "SUB BASS" : "REESE BASS");
    hint.text =
      part === "drums"
        ? "CLICK TO PLACE A HIT  ·  DRAG TO PAINT  ·  SPACE TO PLAY"
        : part === "vocals"
          ? "DRAG ACROSS ROWS TO SING  ·  TOUCHING NOTES GLIDE  ·  CLICK A VOWEL TO CHANGE IT"
          : "DRAG ALONG A ROW FOR A LONG NOTE  ·  CLICK A NOTE TO ERASE  ·  SPACE TO PLAY";
    vowelRow.y = gridTop + rows() * cellHeight + toolsGap;
    tools.y = vowelRow.y + (part === "vocals" ? chipHeight + toolsGap : 0);
    hint.y = tools.y + chipHeight + hintGap;
    copy.label.text = "COPY BAR";
  }

  function redraw(animate: boolean): void {
    if (sound === null) {
      return;
    }

    if (animate) {
      fade.snap(0);
      fade.set(1);
    }

    bar = Math.min(bar, score().bars - 1);
    drawLabels();
    drawCells();
    describe();
    grid.hitArea = new Rectangle(
      labelWidth,
      0,
      gridRight - gridLeft - labelWidth,
      rows() * cellHeight,
    );

    if (barList.length !== score().bars) {
      buildBars();
    }

    paintChips();
  }

  function choosePart(value: Part): void {
    if (part === value) {
      return;
    }

    part = value;
    redraw(true);
  }

  function chooseBar(index: number): void {
    if (bar === index) {
      return;
    }

    bar = index;
    redraw(true);
  }

  function cellAt(event: FederatedPointerEvent): Point | null {
    const local: Point = grid.toLocal(event.global);
    const column: number = Math.floor((local.x - labelWidth) / cellWidth());
    const row: number = Math.floor(local.y / cellHeight);

    if (column < 0 || column >= stepsPerBar || row < 0 || row >= rows()) {
      return null;
    }

    return new Point(column, row);
  }

  function apply(cell: Point): void {
    if (stroke === null) {
      return;
    }

    const step: number = bar * stepsPerBar + cell.x;

    if (part === "drums") {
      score().drums[cell.y]![step] = stroke.value;
    } else {
      line()[step] = stroke.erase ? -1 : degreeOf(cell.y);
    }

    drawCells();
  }

  function begin(event: FederatedPointerEvent): void {
    const cell: Point | null = cellAt(event);

    if (cell === null || event.button !== 0) {
      return;
    }

    const on: boolean = filled(cell.y, bar * stepsPerBar + cell.x) === 1;

    stroke = { value: on ? 0 : 1, erase: on };
    apply(cell);
  }

  function move(event: FederatedPointerEvent): void {
    hover.clear();

    if (sound === null) {
      return;
    }

    const cell: Point | null = cellAt(event);

    if (cell !== null) {
      hover
        .rect(
          labelWidth + cell.x * cellWidth() + cellInset / 2,
          cell.y * cellHeight + cellInset / 2,
          cellWidth() - cellInset,
          cellHeight - cellInset,
        )
        .fill({ color: "#ffffff", alpha: hoverAlpha });
    }

    if (stroke !== null && cell !== null) {
      apply(cell);
    }
  }

  function end(): void {
    if (stroke === null) {
      return;
    }

    stroke = null;
    edited();
  }

  function loop(offset: number): void {
    const current: number = ++token;

    track = playTrack(
      sound!,
      (played: boolean) => {
        if (played && playing && current === token) {
          loop(0);
        }
      },
      offset,
    );
  }

  function restart(): void {
    const position: number = track?.position() ?? 0;

    track?.stop();
    loop(position % scoreLength(score()));
  }

  function togglePlaying(): void {
    playing = !playing;

    if (playing) {
      loop(0);
    } else {
      stopPlaying();
    }

    paintChips();
  }

  function stopPlaying(): void {
    playing = false;
    token++;
    track?.stop();
    track = null;
    playhead.clear();
  }

  function drawPlayhead(): void {
    playhead.clear();

    if (!playing || track === null || sound === null) {
      return;
    }

    const length: number = scoreLength(score());
    const progress: number = (track.position() % length) / length;
    const step: number = Math.floor(progress * stepCount(score()));
    const width: number = cellWidth();

    if (Math.floor(step / stepsPerBar) !== bar) {
      return;
    }

    const column: number = step % stepsPerBar;
    const sweep: number = (progress * score().bars - bar) * stepsPerBar * width;

    playhead
      .rect(labelWidth + column * width, 0, width, rows() * cellHeight)
      .fill({ color: "#ffffff", alpha: playheadAlpha })
      .rect(
        labelWidth + sweep - sweepWidth / 2,
        0,
        sweepWidth,
        rows() * cellHeight,
      )
      .fill({ color: "#ffffff", alpha: playheadAlpha * 3 });
  }

  function open(value: Sound): void {
    stopPreview();
    sound = value;
    part = "drums";
    bar = 0;
    stroke = null;
    buildBars();
    redraw(false);
    view.eventMode = "passive";
    amount.set(1);
  }

  function close(): void {
    if (sound === null) {
      return;
    }

    end();
    stopPlaying();
    paintChips();
    sound = null;
    hover.clear();
    view.eventMode = "none";
    amount.set(0);
    closed();
  }

  function layout(scale: number): void {
    backdrop
      .clear()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: backdropColor, alpha: backdropAlpha });
    board.scale.set(scale);
    board.position.set(
      Math.round(app.screen.width / 2 - (hudWidth * scale) / 2),
      Math.round(app.screen.height / 2 - (hudHeight * scale) / 2),
    );
    sharpen(board, screenResolution(scale));
  }

  title.anchor.set(0.5);
  title.position.set(hudWidth / 2, titleY);
  partChips.forEach((chip: Chip, index: number) => {
    chip.view.position.set(
      gridLeft + index * (partWidth + chipGap),
      toolbarY - chipHeight / 2,
    );
  });
  play.view.position.set(
    gridRight - doneWidth - chipGap - playWidth,
    toolbarY - chipHeight / 2,
  );
  done.view.position.set(gridRight - doneWidth, toolbarY - chipHeight / 2);
  barChips.position.set(gridLeft, barsY - chipHeight / 2);
  info.anchor.set(0.5);
  info.position.set(hudWidth / 2, infoY);
  (
    [
      [mute, muteWidth],
      [copy, copyWidth],
      [paste, copyWidth],
      [kit, kitWidth],
    ] as Array<[Chip, number]>
  ).reduce((x: number, [chip, width]: [Chip, number]) => {
    chip.view.x = x;
    tools.addChild(chip.view);

    return x + width + chipGap;
  }, gridLeft);

  for (let beat = 0; beat < beatsPerBar; beat++) {
    const width: number =
      (gridRight - gridLeft - labelWidth) / beatsPerBar - chipGap;
    const chip: Chip = createChip("Aah", width, () => nextVowel(beat));

    chip.view.x =
      gridLeft + labelWidth + beat * (width + chipGap) + chipGap / 2;
    vowelRow.addChild(chip.view);
    vowelChips.push(chip);
  }
  hint.anchor.set(0.5, 0);
  hint.x = hudWidth / 2;
  grid.position.set(gridLeft, gridTop);
  grid.eventMode = "static";
  grid.cursor = "pointer";
  grid.addChild(cells, playhead, hover, labels);
  grid.on("pointerdown", begin);
  grid.on("globalpointermove", move);
  grid.on("pointerup", end);
  grid.on("pointerupoutside", end);
  grid.on("pointerleave", () => hover.clear());
  board.addChild(
    title,
    ...partChips.map((chip: Chip) => chip.view),
    play.view,
    done.view,
    barChips,
    info,
    grid,
    vowelRow,
    tools,
    hint,
  );
  backdrop.eventMode = "static";
  view.addChild(backdrop, board);
  view.eventMode = "none";
  amount.snap(0);

  app.ticker.add(() => {
    if (sound !== null) {
      drawPlayhead();
    }
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (sound === null || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.code === "Space") {
      togglePlaying();
      event.preventDefault();
    } else if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      chooseBar(
        (bar + (event.code === "ArrowLeft" ? -1 : 1) + score().bars) %
          score().bars,
      );
      event.preventDefault();
    }
  });

  return {
    view: view,
    open: open,
    close: close,
    shown: () => sound !== null,
    layout: layout,
  };
}

export { createComposer };
export type { Composer };
