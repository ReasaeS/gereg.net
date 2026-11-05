import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type FederatedPointerEvent,
  type FederatedWheelEvent,
  type Point,
} from "pixi.js";
import type { Channel, Note, Score, Sequence } from "../../types";
import {
  arrangedNotes,
  kitLanes,
  kitPitch,
  lyricsOf,
  stepsPerBar,
  stepsPerBeat,
  vowels,
  type Family,
  type Placed,
} from "../../jungle";
import {
  createNote,
  defaultPitch,
  editBars,
  familyOf,
  noteShortest,
  notesOf,
  pitchHigh,
  pitchLow,
  pitched,
  rollChoices,
  soloScore,
} from "../../arrange";
import { createLabelText, fitText } from "../../../ui/text";
import type { Option } from "../../../ui/widgets";
import { createButton, createDropdown, type Button } from "./controls";
import {
  accentColor,
  areaHeight,
  areaLeft,
  areaTop,
  areaWidth,
  barLine,
  beatLine,
  blackKey,
  blackRow,
  hoverAlpha,
  isBlack,
  labelSize,
  noteColor,
  noteEdge,
  noteText,
  panelColor,
  pitchName,
  selectedColor,
  selectedEdge,
  smallSize,
  stepLine,
  whiteKey,
  whiteRow,
  type Panel,
  type Session,
} from "./shared";

type Kind = "move" | "resize" | "erase" | "lane" | "box";

type Origin = {
  note: Note;
  step: number;
  pitch: number;
  length: number;
};

type Drag = {
  kind: Kind;
  column: number;
  row: number;
  origins: Array<Origin>;
  heard: number;
  changed: boolean;
};

type Lane = "velocity" | "roll" | "vowel";

const gridTop: number = 22; // units
const keysWidth: number = 40; // units
const blackWidth: number = 24; // units
const rowHeight: number = 16; // units
const rowCount: number = 16;
const kitHeight: number = 24; // units
const laneGap: number = 8; // units
const laneTop: number = gridTop + rowCount * rowHeight + laneGap; // units
const laneHeight: number = areaHeight - laneTop; // units
const gridWidth: number = areaWidth - keysWidth; // units
const edgeWidth: number = 5; // units
const noteInset: number = 0.5; // units
const stemWidth: number = 2; // units
const ghostAlpha: number = 0.1;
const spareShade: number = 0.22;
const quietShade: number = 0.45;
const lowestVelocity: number = 0.05;
const zoomLevels: Array<number> = [1, 2, 4, 8];
const snaps: Array<Option<number>> = [
  { value: 0.25, label: "1/4 step" },
  { value: 0.5, label: "1/2 step" },
  { value: 1, label: "Step" },
  { value: 2, label: "1/2 beat" },
  { value: 4, label: "Beat" },
  { value: 16, label: "Bar" },
];
const arrowWidth: number = 18; // units
const channelWidth: number = 110; // units
const snapWidth: number = 84; // units
const zoomWidth: number = 64; // units
const laneWidth: number = 96; // units
const lyricsWidth: number = 56; // units
const toolGap: number = 6; // units
const scrollRows: number = 2;
const keyLength: number = 2; // steps
let clipboard: Array<Note> = new Array();

function createRoll(session: Session): Panel {
  const view: Container = new Container();
  const grid: Container = new Container();
  const back: Graphics = new Graphics();
  const ghosts: Graphics = new Graphics();
  const notes: Graphics = new Graphics();
  const words: Container = new Container();
  const hover: Graphics = new Graphics();
  const boxDrawn: Graphics = new Graphics();
  const playhead: Graphics = new Graphics();
  const keys: Container = new Container();
  const keyDrawn: Graphics = new Graphics();
  const keyTexts: Array<Text> = new Array();
  const lane: Container = new Container();
  const laneBack: Graphics = new Graphics();
  const laneMarks: Graphics = new Graphics();
  const laneWords: Container = new Container();
  const previous: Button = createButton("<", arrowWidth, () =>
    cycleChannel(-1),
  );
  const channelButton: Button = createButton("", channelWidth, () =>
    session.show("rack"),
  );
  const next: Button = createButton(">", arrowWidth, () => cycleChannel(1));
  const snapButton: Button = createDropdown(
    snapWidth,
    () => snaps,
    () => snap,
    (value: number) => {
      snap = value;
    },
    session.overlay,
  );
  const zoomButton: Button = createButton("", zoomWidth, cycleZoom);
  const laneButton: Button = createButton("", laneWidth, cycleLane);
  const lyricsButton: Button = createButton("Lyrics", lyricsWidth, writeLyrics);
  const selected: Set<Note> = new Set();
  let topPitch: number = 72;
  let firstColumn: number = 0;
  let zoom: number = 1;
  let snap: number = 1;
  let laneMode: Lane = "velocity";
  let drag: Drag | null = null;
  let lastLength: number = 2;
  let lastVowel: number = 0;
  let focused: string = "";

  function score(): Score {
    return session.score();
  }

  function pattern(): Sequence {
    return session.pattern();
  }

  function channel(): Channel | null {
    return session.channel();
  }

  function span(): number {
    return editBars(pattern()) * stepsPerBar;
  }

  function shownBars(): number {
    return Math.min(zoomLevels[zoom]!, editBars(pattern()));
  }

  function columns(): number {
    return shownBars() * stepsPerBar;
  }

  function columnWidth(): number {
    return gridWidth / columns();
  }

  function firstStep(): number {
    return firstColumn;
  }

  function names(): Array<string> | null {
    const current: Channel | null = channel();

    return current === null || pitched(current)
      ? null
      : kitLanes(familyOf(current));
  }

  function rows(): number {
    return names()?.length ?? rowCount;
  }

  function height(): number {
    return names() === null ? rowHeight : kitHeight;
  }

  function floorPitch(): number {
    return names() === null ? pitchLow : kitPitch - rows() + 1;
  }

  function ceilingPitch(): number {
    return names() === null ? pitchHigh : kitPitch;
  }

  function rowOf(note: Note): number {
    return topPitch - note.pitch;
  }

  function snapped(value: number): number {
    return Math.round(value / snap) * snap;
  }

  function lanes(): Array<Lane> {
    const current: Channel | null = channel();

    if (current === null) {
      return ["velocity"];
    }

    const family: Family = familyOf(current);

    return family === "vocal"
      ? ["vowel"]
      : family === "drum"
        ? ["velocity", "roll"]
        : ["velocity"];
  }

  function channelNotes(): Array<Note> {
    const current: Channel | null = channel();

    return current === null ? new Array() : notesOf(pattern(), current.id);
  }

  function setNotes(list: Array<Note>): void {
    const current: Channel | null = channel();

    if (current !== null) {
      pattern().notes[current.id] = list;
    }
  }

  function hear(note: Note): void {
    const current: Channel | null = channel();

    if (current !== null) {
      session.hear(current, note);
    }
  }

  function cycleChannel(direction: number): void {
    const list: Array<Channel> = score().channels;
    const current: Channel | null = channel();

    if (list.length === 0) {
      return;
    }

    const index: number = current === null ? 0 : list.indexOf(current);

    session.chooseChannel(
      list[(index + direction + list.length) % list.length]!,
    );
    session.refresh();
  }

  function cycleZoom(): void {
    zoom = (zoom + 1) % zoomLevels.length;
    clampView();
    redraw();
  }

  function cycleLane(): void {
    const list: Array<Lane> = lanes();

    laneMode = list[(list.indexOf(laneMode) + 1) % list.length]!;
    redraw();
  }

  function writeLyrics(): void {
    const target: Score = score();

    session.write(target.lyrics, (text: string) => {
      if (text !== target.lyrics) {
        session.record();
        target.lyrics = text;
        target.shared = false;
        session.edited();
        redraw();
      }

      return null;
    });
  }

  function clampView(): void {
    firstColumn = Math.min(
      Math.max(firstColumn, 0),
      Math.max((editBars(pattern()) - shownBars()) * stepsPerBar, 0),
    );
    topPitch =
      names() === null
        ? Math.min(Math.max(topPitch, pitchLow + rowCount - 1), pitchHigh)
        : kitPitch;
  }

  function focus(): void {
    const current: Channel | null = channel();
    const key: string = (current?.id ?? "") + ":" + pattern().id;

    if (key === focused) {
      return;
    }

    focused = key;
    firstColumn = 0;
    selected.clear();
    zoom = Math.max(
      zoomLevels.indexOf(
        Math.min(
          zoomLevels.find((level: number) => level >= editBars(pattern())) ??
            zoomLevels[zoomLevels.length - 1]!,
          zoomLevels[1]!,
        ),
      ),
      0,
    );

    if (!lanes().includes(laneMode)) {
      laneMode = lanes()[0]!;
    }

    if (current === null) {
      return;
    }

    const list: Array<Note> = channelNotes();
    const middle: number =
      list.length === 0
        ? defaultPitch(score(), familyOf(current))
        : list.reduce((total: number, note: Note) => total + note.pitch, 0) /
          list.length;

    topPitch = Math.round(middle) + Math.floor(rowCount / 2);
    lastVowel = 0;
    clampView();
  }

  function syllables(): Map<Note, string> {
    const current: Channel | null = channel();
    const found: Map<Note, string> = new Map();

    if (
      current === null ||
      familyOf(current) !== "vocal" ||
      score().singer !== "ritsu"
    ) {
      return found;
    }

    let placed: Array<Placed> = arrangedNotes(score(), current.id);

    if (!placed.some((entry: Placed) => entry.pattern === pattern().id)) {
      placed = arrangedNotes(soloScore(score(), pattern()), current.id);
    }

    const sung: Array<string | null> = lyricsOf(score(), placed);
    const list: Array<Note> = channelNotes();

    placed.forEach((entry: Placed, index: number) => {
      const note: Note | undefined = list[entry.index];

      if (
        entry.pattern === pattern().id &&
        note !== undefined &&
        !found.has(note) &&
        sung[index] !== null &&
        sung[index] !== undefined
      ) {
        found.set(note, sung[index]!);
      }
    });

    return found;
  }

  function noteBox(note: Note): Rectangle | null {
    const width: number = columnWidth();
    const row: number = rowOf(note);
    const start: number = note.step - firstStep();
    const end: number = start + note.length;

    if (row < 0 || row >= rows() || end <= 0 || start >= columns()) {
      return null;
    }

    const left: number = Math.max(start, 0) * width;
    const right: number = Math.min(end, columns()) * width;

    return new Rectangle(
      keysWidth + left + noteInset,
      gridTop + row * height() + noteInset,
      right - left - noteInset * 2,
      height() - noteInset * 2,
    );
  }

  function drawBack(): void {
    const width: number = columnWidth();

    back.clear();
    keyDrawn.clear();

    for (let row = 0; row < rows(); row++) {
      const pitch: number = topPitch - row;
      const y: number = gridTop + row * height();
      const kit: boolean = names() !== null;
      const black: boolean = kit ? row % 2 === 1 : isBlack(pitch);

      back
        .rect(keysWidth, y, gridWidth, height())
        .fill(black ? blackRow : whiteRow)
        .rect(keysWidth, y + height() - 0.5, gridWidth, 0.5)
        .fill(kit || pitch % 12 === 0 || pitch % 12 === 5 ? barLine : stepLine);
      keyDrawn
        .rect(0, y, keysWidth - 1, height())
        .fill(whiteKey)
        .rect(0, y + height() - 0.5, keysWidth - 1, 0.5)
        .fill({ color: "#9aa4a8", alpha: 1 });

      if (black && !kit) {
        keyDrawn.rect(0, y + 1, blackWidth, height() - 2).fill(blackKey);
      }
    }

    for (let column = 0; column <= columns(); column++) {
      const step: number = firstStep() + column;
      const bar: boolean = step % stepsPerBar === 0;
      const beat: boolean = step % stepsPerBeat === 0;

      back
        .rect(
          keysWidth + column * width - (bar ? 0.75 : 0.25),
          gridTop,
          bar ? 1.5 : 0.5,
          rows() * height(),
        )
        .fill(bar ? barLine : beat ? beatLine : stepLine);
    }

    const outside: number = Math.max(
      pattern().bars * stepsPerBar - firstStep(),
      0,
    );

    if (outside < columns()) {
      back
        .rect(
          keysWidth + outside * width,
          gridTop,
          (columns() - outside) * width,
          rows() * height(),
        )
        .fill({ color: "#000000", alpha: spareShade });
    }

    keyTexts.forEach((text: Text, row: number) => {
      const pitch: number = topPitch - row;
      const kit: Array<string> | null = names();

      text.visible = row < rows() && (kit !== null || pitch % 12 === 0);
      text.text =
        kit === null ? pitchName(pitch) : (kit[row] ?? "").toUpperCase();
      text.position.set(keysWidth - 3, gridTop + row * height() + height() / 2);
    });
  }

  function drawNotes(): void {
    const current: Channel | null = channel();
    const sung: Map<Note, string> = syllables();

    ghosts.clear();
    notes.clear();

    for (const child of words.removeChildren()) {
      child.destroy();
    }

    for (const note of [...selected]) {
      if (!channelNotes().includes(note)) {
        selected.delete(note);
      }
    }

    if (current === null) {
      return;
    }

    if (pitched(current)) {
      for (const other of score().channels) {
        if (other === current || !pitched(other)) {
          continue;
        }

        for (const note of pattern().notes[other.id] ?? new Array()) {
          const box: Rectangle | null = noteBox(note);

          if (box !== null) {
            ghosts
              .rect(box.x, box.y, box.width, box.height)
              .fill({ color: "#ffffff", alpha: ghostAlpha });
          }
        }
      }
    }

    const vocal: boolean = familyOf(current) === "vocal";

    for (const note of channelNotes()) {
      const box: Rectangle | null = noteBox(note);

      if (box === null) {
        continue;
      }

      const lit: boolean = selected.has(note);
      const shade: number = vocal
        ? 1
        : quietShade + (1 - quietShade) * note.velocity;

      notes
        .rect(box.x, box.y, box.width, box.height)
        .fill({ color: lit ? selectedColor : noteColor, alpha: shade })
        .stroke({
          color: lit ? selectedEdge : noteEdge,
          width: 1,
          alignment: 1,
        });

      const label: string = vocal
        ? (sung.get(note) ?? vowels[note.vowel]!.name).toUpperCase()
        : note.roll > 1
          ? "×" + note.roll
          : pitched(current)
            ? pitchName(note.pitch)
            : "";

      if (label !== "" && box.height >= labelSize) {
        const word: Text = createLabelText(labelSize, noteText, false);

        fitText(word, label, box.width - 4);
        word.anchor.set(0, 0.5);
        word.position.set(box.x + 2, box.y + box.height / 2);
        words.addChild(word);
      }
    }
  }

  function drawLane(): void {
    const width: number = columnWidth();
    const current: Channel | null = channel();

    laneBack
      .clear()
      .rect(keysWidth, laneTop, gridWidth, laneHeight)
      .fill(panelColor);

    for (let column = 0; column <= columns(); column += stepsPerBeat) {
      laneBack
        .rect(keysWidth + column * width - 0.25, laneTop, 0.5, laneHeight)
        .fill(beatLine);
    }

    laneMarks.clear();

    for (const child of laneWords.removeChildren()) {
      child.destroy();
    }

    if (current === null) {
      return;
    }

    for (const note of channelNotes()) {
      const column: number = note.step - firstStep();

      if (column < 0 || column >= columns()) {
        continue;
      }

      const x: number = keysWidth + column * width;
      const color: string = selected.has(note) ? selectedColor : noteColor;

      if (laneMode === "velocity") {
        const tall: number = (laneHeight - 6) * note.velocity;

        laneMarks
          .rect(x + 1, laneTop + laneHeight - tall, stemWidth, tall)
          .fill(color)
          .circle(x + 1 + stemWidth / 2, laneTop + laneHeight - tall, 2.5)
          .stroke({ color: color, width: 1 });
        continue;
      }

      const word: Text = createLabelText(smallSize, color);

      word.text =
        laneMode === "roll"
          ? note.roll > 1
            ? "×" + note.roll
            : "·"
          : vowels[note.vowel]!.name.toUpperCase();
      word.anchor.set(0, 0.5);
      word.position.set(x + 1, laneTop + laneHeight / 2);
      laneWords.addChild(word);
    }
  }

  function paintTools(): void {
    const current: Channel | null = channel();

    channelButton.label.text =
      current === null ? "NO CHANNEL" : current.name.toUpperCase().slice(0, 16);
    snapButton.paint();
    zoomButton.label.text =
      "ZOOM " + shownBars() + (shownBars() === 1 ? " BAR" : " BARS");
    laneButton.label.text = "LANE: " + laneMode.toUpperCase();
    lyricsButton.view.visible =
      current !== null && familyOf(current) === "vocal";
    laneButton.view.visible = lanes().length > 1;
  }

  function redraw(): void {
    focus();
    clampView();
    drawBack();
    drawNotes();
    drawLane();
    paintTools();
    grid.hitArea = new Rectangle(
      keysWidth,
      gridTop,
      gridWidth,
      rows() * height(),
    );
    keys.hitArea = new Rectangle(0, gridTop, keysWidth, rows() * height());
    lane.hitArea = new Rectangle(keysWidth, laneTop, gridWidth, laneHeight);
  }

  function pointAt(event: FederatedPointerEvent): [number, number] {
    const local: Point = view.toLocal(event.global);

    return [
      firstStep() + (local.x - keysWidth) / columnWidth(),
      Math.floor((local.y - gridTop) / height()),
    ];
  }

  function noteAt(column: number, row: number): Note | null {
    const list: Array<Note> = channelNotes();

    for (let index = list.length - 1; index >= 0; index--) {
      const note: Note = list[index]!;

      if (
        rowOf(note) === row &&
        note.step <= column &&
        note.step + note.length > column
      ) {
        return note;
      }
    }

    return null;
  }

  function originsOf(list: Iterable<Note>): Array<Origin> {
    return [...list].map((note: Note) => ({
      note: note,
      step: note.step,
      pitch: note.pitch,
      length: note.length,
    }));
  }

  function erase(column: number, row: number): void {
    const found: Note | null = noteAt(column, row);

    if (found === null || drag === null) {
      return;
    }

    setNotes(channelNotes().filter((note: Note) => note !== found));
    selected.delete(found);
    drag.changed = true;
    drawNotes();
    drawLane();
  }

  function startDrag(
    kind: Kind,
    column: number,
    row: number,
    list: Iterable<Note>,
  ): void {
    drag = {
      kind: kind,
      column: column,
      row: row,
      origins: originsOf(list),
      heard: topPitch - row,
      changed: false,
    };
  }

  function begin(event: FederatedPointerEvent): void {
    const current: Channel | null = channel();
    const [column, row] = pointAt(event);
    const command: boolean = event.ctrlKey || event.metaKey;

    if (current === null || row < 0 || row >= rows() || event.button === 1) {
      return;
    }

    const found: Note | null = noteAt(column, row);

    if (event.button === 2) {
      session.record();
      startDrag("erase", column, row, new Array());
      erase(column, row);
      return;
    }

    if (command) {
      if (found !== null) {
        if (selected.has(found)) {
          selected.delete(found);
        } else {
          selected.add(found);
        }

        drawNotes();
        drawLane();
        return;
      }

      if (!event.shiftKey) {
        selected.clear();
      }

      startDrag("box", column, row, [...selected]);
      return;
    }

    session.record();

    if (found !== null) {
      if (!selected.has(found)) {
        selected.clear();
        selected.add(found);
      }

      const end: number =
        (found.step + found.length - firstStep()) * columnWidth();
      const x: number = (column - firstStep()) * columnWidth();
      const edge: number = Math.min(
        edgeWidth,
        (found.length * columnWidth()) / 3,
      );

      if (end - x <= edge) {
        startDrag("resize", column, row, selected);
      } else {
        if (event.shiftKey) {
          const copies: Array<Note> = [...selected].map((note: Note) => ({
            ...note,
          }));

          channelNotes().push(...copies);
          selected.clear();
          copies.forEach((note: Note) => selected.add(note));
        }

        startDrag("move", column, row, selected);
        drag!.changed = event.shiftKey;
      }

      lastLength = found.length;
      lastVowel = found.vowel;
      hear(found);
      drawNotes();
      drawLane();
      return;
    }

    const step: number = Math.min(
      Math.max(Math.floor(column / snap) * snap, 0),
      span() - noteShortest,
    );
    const note: Note = {
      ...createNote(step, topPitch - row, Math.min(lastLength, span() - step)),
      vowel: lastVowel,
    };

    selected.clear();
    channelNotes().push(note);
    startDrag("move", column, row, [note]);
    drag!.changed = true;
    hear(note);
    drawNotes();
    drawLane();
  }

  function drawBox(column: number, row: number): void {
    const from: number =
      (Math.min(drag!.column, column) - firstStep()) * columnWidth();
    const to: number =
      (Math.max(drag!.column, column) - firstStep()) * columnWidth();
    const top: number = Math.min(drag!.row, row);
    const bottom: number = Math.max(drag!.row, row) + 1;

    boxDrawn
      .clear()
      .rect(
        keysWidth + from,
        gridTop + top * height(),
        to - from,
        (bottom - top) * height(),
      )
      .fill({ color: "#ffffff", alpha: 0.08 })
      .stroke({ color: "#ffffff", width: 1, alpha: 0.7 });

    for (const note of channelNotes()) {
      const inside: boolean =
        note.step < Math.max(drag!.column, column) &&
        note.step + note.length > Math.min(drag!.column, column) &&
        rowOf(note) >= top &&
        rowOf(note) < bottom;

      if (inside) {
        selected.add(note);
      } else if (
        !drag!.origins.some((origin: Origin) => origin.note === note)
      ) {
        selected.delete(note);
      }
    }

    drawNotes();
    drawLane();
  }

  function move(event: FederatedPointerEvent): void {
    hover.clear();

    if (!view.visible || channel() === null) {
      return;
    }

    const [column, row] = pointAt(event);

    if (drag === null || drag.kind === "lane") {
      if (
        row >= 0 &&
        row < rows() &&
        column >= firstStep() &&
        column < firstStep() + columns()
      ) {
        hover
          .rect(
            keysWidth +
              (Math.floor(column / snap) * snap - firstStep()) * columnWidth(),
            gridTop + row * height(),
            snap * columnWidth(),
            height(),
          )
          .fill({ color: "#ffffff", alpha: hoverAlpha });
      }

      if (drag !== null) {
        laneApply(event, false);
      }

      return;
    }

    if (drag.kind === "erase") {
      erase(column, row);
      return;
    }

    if (drag.kind === "box") {
      drawBox(column, row);
      return;
    }

    const delta: number = snapped(column - drag.column);

    if (drag.kind === "resize") {
      for (const origin of drag.origins) {
        origin.note.length = Math.min(
          Math.max(
            origin.length + delta,
            Math.min(snap, origin.length),
            noteShortest,
          ),
          span() - origin.note.step,
        );
      }

      lastLength = drag.origins[0]?.note.length ?? lastLength;
      drag.changed = drag.changed || delta !== 0;
    } else {
      const lowest: number = Math.max(
        ...drag.origins.map((origin: Origin) => -origin.step),
      );
      const highest: number = Math.min(
        ...drag.origins.map(
          (origin: Origin) => span() - origin.step - origin.length,
        ),
      );
      const shift: number = Math.min(Math.max(delta, lowest), highest);
      const lift: number = Math.min(
        Math.max(
          drag.row - Math.min(Math.max(row, 0), rows() - 1),
          Math.max(
            ...drag.origins.map(
              (origin: Origin) => floorPitch() - origin.pitch,
            ),
          ),
        ),
        Math.min(
          ...drag.origins.map(
            (origin: Origin) => ceilingPitch() - origin.pitch,
          ),
        ),
      );

      for (const origin of drag.origins) {
        origin.note.step = origin.step + shift;
        origin.note.pitch = origin.pitch + lift;
      }

      drag.changed = drag.changed || shift !== 0 || lift !== 0;

      const lead: Origin | undefined = drag.origins[0];

      if (lead !== undefined && lift + lead.pitch !== drag.heard) {
        drag.heard = lift + lead.pitch;
        hear(lead.note);
      }
    }

    drawNotes();
    drawLane();
  }

  function laneApply(event: FederatedPointerEvent, first: boolean): void {
    const local: Point = view.toLocal(event.global);
    const column: number = firstStep() + (local.x - keysWidth) / columnWidth();
    const list: Array<Note> = channelNotes();
    const near: number = Math.max(1, snap);
    const starting: Array<Note> = list.filter(
      (note: Note) => note.step <= column && column < note.step + near,
    );
    const chosen: Array<Note> = starting.some((note: Note) =>
      selected.has(note),
    )
      ? starting.filter((note: Note) => selected.has(note))
      : starting;
    const targets: Array<Note> =
      chosen.length > 0
        ? chosen
        : list.filter(
            (note: Note) =>
              note.step <= column && note.step + note.length > column,
          );

    for (const note of targets) {
      if (laneMode === "velocity") {
        note.velocity = Math.min(
          Math.max(1 - (local.y - laneTop) / laneHeight, lowestVelocity),
          1,
        );
      } else if (first && laneMode === "roll") {
        note.roll =
          rollChoices[
            (rollChoices.indexOf(note.roll) + 1) % rollChoices.length
          ]!;
      } else if (first) {
        note.vowel = (note.vowel + 1) % vowels.length;
        lastVowel = note.vowel;
      }
    }

    if (targets.length > 0 && drag !== null) {
      drag.changed = true;
    }

    drawNotes();
    drawLane();
  }

  function laneBegin(event: FederatedPointerEvent): void {
    if (channel() === null || event.button !== 0) {
      return;
    }

    session.record();
    startDrag("lane", 0, 0, new Array());
    laneApply(event, true);
  }

  function keyBegin(event: FederatedPointerEvent): void {
    const [, row] = pointAt(event);

    if (row >= 0 && row < rows() && event.button === 0) {
      hear(createNote(0, topPitch - row, keyLength));
    }
  }

  function end(): void {
    if (drag === null) {
      return;
    }

    const changed: boolean = drag.changed;

    drag = null;
    boxDrawn.clear();

    if (changed) {
      session.edited();
    }

    drawNotes();
    drawLane();
  }

  function mutate(apply: () => void): void {
    session.record();
    apply();
    session.edited();
    drawNotes();
    drawLane();
  }

  function paste(list: Array<Note>, offset: number): void {
    const copies: Array<Note> = list
      .map((note: Note) => ({ ...note, step: note.step + offset }))
      .filter((note: Note) => note.step >= 0 && note.step < span())
      .map((note: Note) => ({
        ...note,
        length: Math.min(note.length, span() - note.step),
      }));

    if (copies.length === 0) {
      return;
    }

    mutate(() => {
      channelNotes().push(...copies);
      selected.clear();
      copies.forEach((note: Note) => selected.add(note));
    });
  }

  function key(event: KeyboardEvent): boolean {
    const command: boolean = event.ctrlKey || event.metaKey;
    const list: Array<Note> = [...selected];

    if (channel() === null) {
      return false;
    }

    if (command && event.code === "KeyA") {
      channelNotes().forEach((note: Note) => selected.add(note));
      drawNotes();
      drawLane();
    } else if (command && event.code === "KeyD") {
      selected.clear();
      drawNotes();
      drawLane();
    } else if (command && (event.code === "KeyC" || event.code === "KeyX")) {
      if (list.length === 0) {
        return true;
      }

      clipboard = list.map((note: Note) => ({ ...note }));

      if (event.code === "KeyX") {
        mutate(() => {
          setNotes(channelNotes().filter((note: Note) => !selected.has(note)));
          selected.clear();
        });
      }
    } else if (command && event.code === "KeyV") {
      paste(clipboard, 0);
    } else if (command && event.code === "KeyB") {
      if (list.length === 0) {
        return true;
      }

      const start: number = Math.min(...list.map((note: Note) => note.step));
      const finish: number = Math.max(
        ...list.map((note: Note) => note.step + note.length),
      );
      const unit: number =
        finish - start > stepsPerBar ? stepsPerBar : stepsPerBeat;

      paste(list, Math.ceil((finish - start) / unit) * unit);
    } else if (command) {
      return false;
    } else if (event.code === "Delete" || event.code === "Backspace") {
      mutate(() => {
        setNotes(channelNotes().filter((note: Note) => !selected.has(note)));
        selected.clear();
      });
    } else if (
      list.length > 0 &&
      (event.code === "ArrowUp" || event.code === "ArrowDown")
    ) {
      const lift: number =
        (event.code === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 12 : 1);

      if (
        list.some(
          (note: Note) =>
            note.pitch + lift < floorPitch() ||
            note.pitch + lift > ceilingPitch(),
        )
      ) {
        return true;
      }

      mutate(() => list.forEach((note: Note) => (note.pitch += lift)));
      hear(list[0]!);
    } else if (
      list.length > 0 &&
      (event.code === "ArrowLeft" || event.code === "ArrowRight")
    ) {
      const shift: number =
        (event.code === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? snap : 1);

      if (
        list.some(
          (note: Note) =>
            note.step + shift < 0 || note.step + note.length + shift > span(),
        )
      ) {
        return true;
      }

      mutate(() => list.forEach((note: Note) => (note.step += shift)));
    } else if (event.code === "ArrowUp" || event.code === "ArrowDown") {
      topPitch += event.code === "ArrowUp" ? 1 : -1;
      clampView();
      redraw();
    } else if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      firstColumn += event.code === "ArrowLeft" ? -1 : 1;
      clampView();
      redraw();
    } else {
      return false;
    }

    return true;
  }

  function tick(): void {
    const step: number | null = session.playhead("pattern");

    playhead.clear();

    if (step === null) {
      return;
    }

    const column: number = step - firstStep();

    if (column < 0 || column >= columns()) {
      return;
    }

    playhead
      .rect(
        keysWidth + column * columnWidth() - 0.75,
        gridTop,
        1.5,
        rows() * height(),
      )
      .fill(accentColor);
  }

  function wheel(event: FederatedWheelEvent): void {
    if (event.ctrlKey) {
      zoom = Math.min(
        Math.max(zoom + (event.deltaY > 0 ? 1 : -1), 0),
        zoomLevels.length - 1,
      );
    } else if (
      event.shiftKey ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
    ) {
      firstColumn += Math.sign(event.deltaX || event.deltaY) * stepsPerBar;
    } else {
      topPitch -= Math.sign(event.deltaY) * scrollRows;
    }

    clampView();
    redraw();
  }

  for (let row = 0; row < rowCount; row++) {
    const text: Text = createLabelText(smallSize + 1, "#1c2226", false);

    text.anchor.set(1, 0.5);
    keyTexts.push(text);
    keys.addChild(text);
  }

  previous.view.x = 0;
  channelButton.view.x = arrowWidth + toolGap;
  next.view.x = arrowWidth + channelWidth + toolGap * 2;
  snapButton.view.x = next.view.x + arrowWidth + toolGap * 3;
  zoomButton.view.x = snapButton.view.x + snapWidth + toolGap;
  laneButton.view.x = zoomButton.view.x + zoomWidth + toolGap;
  lyricsButton.view.x = laneButton.view.x + laneWidth + toolGap;
  grid.eventMode = "static";
  grid.cursor = "pointer";
  grid.addChild(back, ghosts, notes, words, boxDrawn, playhead, hover);
  grid.on("pointerdown", begin);
  grid.on("globalpointermove", move);
  grid.on("pointerup", end);
  grid.on("pointerupoutside", end);
  grid.on("pointerleave", () => hover.clear());
  grid.on("wheel", wheel);
  keys.eventMode = "static";
  keys.cursor = "pointer";
  keys.addChildAt(keyDrawn, 0);
  keys.on("pointerdown", keyBegin);
  keys.on("wheel", wheel);
  lane.eventMode = "static";
  lane.cursor = "pointer";
  lane.addChild(laneBack, laneMarks, laneWords);
  lane.on("pointerdown", laneBegin);
  lane.on("pointerup", end);
  lane.on("pointerupoutside", end);
  view.position.set(areaLeft, areaTop);
  view.addChild(
    grid,
    keys,
    lane,
    previous.view,
    channelButton.view,
    next.view,
    snapButton.view,
    zoomButton.view,
    laneButton.view,
    lyricsButton.view,
  );

  return { view: view, redraw: redraw, tick: tick, key: key };
}

export { createRoll };
