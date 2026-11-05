import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type FederatedPointerEvent,
  type FederatedWheelEvent,
  type Point,
} from "pixi.js";
import type { Channel, Note, Sequence } from "../../types";
import { kits, patchOf, stepsPerBar } from "../../jungle";
import { sampleChoices } from "../../sound";
import {
  addChannel,
  createNote,
  defaultPitch,
  editBars,
  familyOf,
  notesOf,
  patchOptions,
  pitched,
  removeChannel,
  volumeMost,
} from "../../arrange";
import { createLabelText } from "../../../ui/text";
import type { Option } from "../../../ui/widgets";
import {
  buttonHeight,
  createButton,
  createDropdown,
  createKnob,
  type Button,
  type Knob,
} from "./controls";
import {
  areaHeight,
  areaLeft,
  areaTop,
  dimColor,
  hoverAlpha,
  ledColor,
  ledOff,
  mutedAlpha,
  panelColor,
  playheadColor,
  rename,
  smallSize,
  stepGroups,
  stepOn,
  stripColor,
  textColor,
  textSize,
  type Panel,
  type Session,
} from "./shared";

type Stroke = {
  channel: Channel;
  add: boolean;
};

type Row = {
  channel: Channel;
  pan: Knob;
  volume: Knob;
  name: Button;
  insert: Text;
};

const rowsTop: number = 20; // units
const rowHeight: number = 20; // units
const visibleRows: number = 14;
const rowsWidth: number = 382; // units
const ledX: number = 6; // units
const ledRadius: number = 3.5; // units
const panX: number = 20; // units
const volumeX: number = 36; // units
const smallKnob: number = 6.5; // units
const insertX: number = 52; // units
const nameX: number = 64; // units
const nameWidth: number = 78; // units
const stepsX: number = 148; // units
const cellWidth: number = 14.5; // units
const cellGap: number = 1.5; // units
const cellHeight: number = 15; // units
const heldHeight: number = 5; // units
const pageWidth: number = 18; // units
const pageGap: number = 2; // units
const settingsX: number = 392; // units
const settingsWidth: number = 184; // units
const settingsInset: number = 10; // units
const fieldWidth: number = settingsWidth - settingsInset * 2; // units
const labelGap: number = 11; // units
const fieldGap: number = 34; // units
const bigKnob: number = 13; // units
const knobRowHeight: number = 52; // units
const toolGap: number = 6; // units
const toolWidth: number = (fieldWidth - toolGap) / 2; // units
const addWidth: number = 110; // units
const nameLength: number = 12;
const doubleTap: number = 350; // ms
const newInstrument: string = "saw";

function createRack(session: Session): Panel {
  const view: Container = new Container();
  const back: Graphics = new Graphics();
  const pages: Container = new Container();
  const rows: Container = new Container();
  const grid: Container = new Container();
  const cells: Graphics = new Graphics();
  const leds: Graphics = new Graphics();
  const hover: Graphics = new Graphics();
  const playhead: Graphics = new Graphics();
  const settings: Container = new Container();
  const settingsBack: Graphics = new Graphics();
  const heading: Text = createLabelText(textSize, textColor);
  const pageList: Array<Button> = new Array();
  const rowList: Array<Row> = new Array();
  const add: Button = createButton("+ Add channel", addWidth, addOne);
  let page: number = 0;
  let scroll: number = 0;
  let stroke: Stroke | null = null;
  let built: string = "";
  let pagesBuilt: number = 0;
  let lastTap: number = 0;
  let lastTapped: Channel | null = null;

  function channels(): Array<Channel> {
    return session.score().channels;
  }

  function pattern(): Sequence {
    return session.pattern();
  }

  function selected(): Channel {
    return session.channel()!;
  }

  const kitOptions: Array<Option<number>> = kits.map(
    (kit: { name: string }, index: number) => ({
      value: index,
      label: kit.name,
    }),
  );
  const instrument: Button = createDropdown(
    fieldWidth,
    patchOptions,
    () => selected().instrument,
    (value: string) => {
      const channel: Channel = selected();

      session.record();

      if (channel.name === patchOf(channel.instrument).name) {
        channel.name = patchOf(value).name;
      }

      channel.instrument = value;
      session.edited();
      session.refresh();
    },
    session.overlay,
  );
  const kit: Button = createDropdown(
    fieldWidth,
    () => kitOptions,
    () => selected().kit,
    (value: number) => {
      session.record();
      selected().kit = value;
      session.edited();
    },
    session.overlay,
  );
  const sample: Button = createDropdown(
    fieldWidth,
    sampleChoices,
    () => selected().sample,
    (value: string | null) => {
      session.record();
      selected().sample = value;
      session.edited();
    },
    session.overlay,
  );
  const cut: Button = createButton(
    "Cut at note end",
    fieldWidth,
    () => {
      session.record();
      selected().cut = !selected().cut;
      session.edited();
      cut.paint();
    },
    () => session.channel()?.cut === true,
  );
  const insert: Button = createDropdown(
    fieldWidth,
    () =>
      session.score().inserts.map((entry: { name: string }, index: number) => ({
        value: index,
        label: index === 0 ? entry.name : index + "  " + entry.name,
      })),
    () => selected().insert,
    (value: number) => {
      session.record();
      selected().insert = value;
      session.edited();
      redraw();
    },
    session.overlay,
  );
  const volume: Knob = createKnob(
    bigKnob,
    0,
    volumeMost,
    0.01,
    0.7,
    () => selected().volume,
    (value: number) => {
      session.record();
      selected().volume = value;
      session.edited();
      paintRows();
    },
  );
  const pan: Knob = createKnob(
    bigKnob,
    -1,
    1,
    0.01,
    0,
    () => selected().pan,
    (value: number) => {
      session.record();
      selected().pan = value;
      session.edited();
      paintRows();
    },
    true,
  );
  const renameButton: Button = createButton("Rename", toolWidth, renameOne);
  const rollButton: Button = createButton("Piano roll", fieldWidth, () =>
    session.show("roll"),
  );
  const deleteButton: Button = createButton("Delete", toolWidth, deleteOne);
  const labels: Array<Text> = [
    "Instrument",
    "Kit",
    "Sample",
    "Mixer insert",
  ].map((name: string) => {
    const text: Text = createLabelText(smallSize, dimColor);

    text.text = name.toUpperCase();
    return text;
  });
  const knobLabels: Array<Text> = ["Volume", "Pan"].map((name: string) => {
    const text: Text = createLabelText(smallSize, dimColor);

    text.text = name.toUpperCase();
    text.anchor.set(0.5, 0);
    return text;
  });

  function addOne(): void {
    session.record();

    const channel: Channel | null = addChannel(session.score(), newInstrument);

    if (channel === null) {
      return;
    }

    session.chooseChannel(channel);
    scroll = Math.max(channels().length - visibleRows, 0);
    session.edited();
    session.refresh();
  }

  function renameOne(): void {
    const channel: Channel = selected();

    rename(channel.name, (name: string) => {
      session.record();
      channel.name = name;
      session.edited();
      session.refresh();
    });
  }

  function deleteOne(): void {
    const channel: Channel = selected();
    const index: number = channels().indexOf(channel);

    session.record();
    removeChannel(session.score(), channel.id);

    const next: Channel | undefined =
      channels()[Math.min(index, channels().length - 1)];

    if (next !== undefined) {
      session.chooseChannel(next);
    }

    session.edited();
    session.refresh();
  }

  function span(): number {
    return editBars(pattern()) * stepsPerBar;
  }

  function pitchFor(channel: Channel): number {
    const notes: Array<Note> = notesOf(pattern(), channel.id);

    return pitched(channel)
      ? (notes[notes.length - 1]?.pitch ??
          defaultPitch(session.score(), familyOf(channel)))
      : defaultPitch(session.score(), familyOf(channel));
  }

  function tap(channel: Channel): void {
    const now: number = performance.now();

    if (lastTapped === channel && now - lastTap < doubleTap) {
      session.chooseChannel(channel);
      session.show("roll");
      return;
    }

    lastTap = now;
    lastTapped = channel;
    session.chooseChannel(channel);
    session.refresh();
  }

  function shown(): Array<Channel> {
    return channels().slice(scroll, scroll + visibleRows);
  }

  function buildRows(): void {
    for (const child of rows.removeChildren()) {
      child.destroy({ children: true });
    }

    rowList.length = 0;
    shown().forEach((channel: Channel, index: number) => {
      const middle: number = rowsTop + index * rowHeight + rowHeight / 2;
      const panKnob: Knob = createKnob(
        smallKnob,
        -1,
        1,
        0.01,
        0,
        () => channel.pan,
        (value: number) => {
          session.record();
          channel.pan = value;
          session.edited();
          refreshSettings();
        },
        true,
      );
      const volumeKnob: Knob = createKnob(
        smallKnob,
        0,
        volumeMost,
        0.01,
        0.7,
        () => channel.volume,
        (value: number) => {
          session.record();
          channel.volume = value;
          session.edited();
          refreshSettings();
        },
      );
      const name: Button = createButton(
        channel.name.slice(0, nameLength),
        nameWidth,
        () => tap(channel),
        () => session.channel() === channel,
      );
      const number: Text = createLabelText(smallSize, dimColor);

      panKnob.view.position.set(panX, middle);
      volumeKnob.view.position.set(volumeX, middle);
      number.anchor.set(0.5, 0.5);
      number.position.set(insertX + 5, middle);
      name.view.position.set(nameX, middle - buttonHeight / 2);
      rows.addChild(panKnob.view, volumeKnob.view, number, name.view);
      rowList.push({
        channel: channel,
        pan: panKnob,
        volume: volumeKnob,
        name: name,
        insert: number,
      });
    });
  }

  function paintRows(): void {
    leds.clear();

    for (const [index, row] of rowList.entries()) {
      row.pan.refresh();
      row.volume.refresh();
      row.name.paint();
      row.insert.text =
        row.channel.insert === 0 ? "-" : String(row.channel.insert);
      leds
        .circle(ledX, rowsTop + index * rowHeight + rowHeight / 2, ledRadius)
        .fill(row.channel.mute ? ledOff : ledColor);
    }
  }

  function buildPages(): void {
    for (const child of pages.removeChildren()) {
      child.destroy({ children: true });
    }

    pageList.length = 0;
    pagesBuilt = editBars(pattern());

    if (editBars(pattern()) === 1) {
      return;
    }

    const width: number = Math.min(
      pageWidth,
      (stepsPerBar * cellWidth) / editBars(pattern()) - pageGap,
    );

    for (let index = 0; index < editBars(pattern()); index++) {
      const button: Button = createButton(
        index < pattern().bars ? String(index + 1) : "+",
        width,
        () => {
          page = index;
          redraw();
        },
        () => page === index,
      );

      button.view.x = stepsX + index * (width + pageGap);
      pages.addChild(button.view);
      pageList.push(button);
    }
  }

  function drawCells(): void {
    cells.clear();

    shown().forEach((channel: Channel, index: number) => {
      const notes: Array<Note> = pattern().notes[channel.id] ?? new Array();
      const y: number =
        rowsTop + index * rowHeight + (rowHeight - cellHeight) / 2;
      const alpha: number = channel.mute ? mutedAlpha : 1;

      for (let column = 0; column < stepsPerBar; column++) {
        const step: number = page * stepsPerBar + column;
        const x: number = stepsX + column * cellWidth;
        const starts: boolean = notes.some(
          (note: Note) => Math.floor(note.step) === step,
        );
        const held: boolean = notes.some(
          (note: Note) =>
            Math.floor(note.step) < step && note.step + note.length > step,
        );

        cells
          .rect(x, y, cellWidth - cellGap, cellHeight)
          .fill(stepGroups[Math.floor(column / 4) % 2]!)
          .rect(x, y, cellWidth - cellGap, 1)
          .fill({ color: "#ffffff", alpha: 0.1 });

        if (starts) {
          cells
            .rect(x + 1, y + 1, cellWidth - cellGap - 2, cellHeight - 2)
            .fill({ color: stepOn, alpha: alpha });
        } else if (held) {
          cells
            .rect(
              x - cellGap,
              y + (cellHeight - heldHeight) / 2,
              cellWidth + cellGap,
              heldHeight,
            )
            .fill({ color: stepOn, alpha: alpha * 0.45 });
        }
      }
    });
  }

  function refreshSettings(): void {
    const channel: Channel | null = session.channel();

    settings.visible = channel !== null;

    if (channel === null) {
      return;
    }

    const drum: boolean = familyOf(channel) === "drum";
    const sampler: boolean = familyOf(channel) === "sample";
    let y: number = settingsInset;

    heading.text = channel.name.toUpperCase();
    heading.position.set(settingsInset, y);
    y += labelGap + 6;

    for (const [index, button] of [instrument, kit, sample, insert].entries()) {
      const visible: boolean =
        index === 1 ? drum : index === 2 ? sampler : true;

      button.view.visible = visible;
      labels[index]!.visible = visible;

      if (!visible) {
        continue;
      }

      labels[index]!.position.set(settingsInset, y);
      button.view.position.set(settingsInset, y + labelGap);
      button.paint();
      y += fieldGap;

      if (index === 2) {
        cut.view.position.set(settingsInset, y - fieldGap / 2 + labelGap + 4);
        y += buttonHeight + 6;
      }
    }

    cut.view.visible = sampler;
    cut.paint();

    volume.view.position.set(settingsInset + fieldWidth / 4, y + bigKnob + 4);
    pan.view.position.set(
      settingsInset + (fieldWidth * 3) / 4,
      y + bigKnob + 4,
    );
    knobLabels[0]!.position.set(volume.view.x, y + bigKnob * 2 + 8);
    knobLabels[1]!.position.set(pan.view.x, y + bigKnob * 2 + 8);
    volume.refresh();
    pan.refresh();
    y += knobRowHeight;
    rollButton.view.position.set(settingsInset, y);
    y += buttonHeight + toolGap;
    renameButton.view.position.set(settingsInset, y);
    deleteButton.view.position.set(settingsInset + toolWidth + toolGap, y);
  }

  function redraw(): void {
    scroll = Math.min(scroll, Math.max(channels().length - visibleRows, 0));
    page = Math.min(page, editBars(pattern()) - 1);

    const signature: string = JSON.stringify([
      scroll,
      channels().map((channel: Channel) => [channel.id, channel.name]),
    ]);

    if (signature !== built) {
      built = signature;
      buildRows();
    }

    if (pagesBuilt !== editBars(pattern())) {
      buildPages();
    }

    for (const button of pageList) {
      button.paint();
    }

    paintRows();
    drawCells();
    refreshSettings();
    grid.hitArea = new Rectangle(
      stepsX,
      rowsTop,
      stepsPerBar * cellWidth,
      visibleRows * rowHeight,
    );
  }

  function cellAt(event: FederatedPointerEvent): [Channel, number] | null {
    const local: Point = grid.toLocal(event.global);
    const column: number = Math.floor((local.x - stepsX) / cellWidth);
    const row: number = Math.floor((local.y - rowsTop) / rowHeight);
    const channel: Channel | undefined = channels()[scroll + row];

    if (
      column < 0 ||
      column >= stepsPerBar ||
      row < 0 ||
      row >= visibleRows ||
      channel === undefined
    ) {
      return null;
    }

    return [channel, page * stepsPerBar + column];
  }

  function apply(channel: Channel, step: number): void {
    if (stroke === null || stroke.channel !== channel || step >= span()) {
      return;
    }

    const notes: Array<Note> = notesOf(pattern(), channel.id);
    const found: boolean = notes.some(
      (note: Note) => Math.floor(note.step) === step,
    );

    if (stroke.add && !found) {
      notes.push(createNote(step, pitchFor(channel)));
    } else if (!stroke.add && found) {
      pattern().notes[channel.id] = notes.filter(
        (note: Note) => Math.floor(note.step) !== step,
      );
    }

    drawCells();
  }

  function begin(event: FederatedPointerEvent): void {
    const cell: [Channel, number] | null = cellAt(event);

    if (cell === null || event.button === 1) {
      return;
    }

    const [channel, step] = cell;
    const found: boolean = notesOf(pattern(), channel.id).some(
      (note: Note) => Math.floor(note.step) === step,
    );

    session.record();
    stroke = { channel: channel, add: event.button === 0 && !found };
    apply(channel, step);
  }

  function move(event: FederatedPointerEvent): void {
    const cell: [Channel, number] | null = view.visible ? cellAt(event) : null;

    hover.clear();

    if (cell === null) {
      return;
    }

    const [channel, step] = cell;
    const row: number = channels().indexOf(channel) - scroll;

    hover
      .rect(
        stepsX + (step % stepsPerBar) * cellWidth,
        rowsTop + row * rowHeight + (rowHeight - cellHeight) / 2,
        cellWidth - cellGap,
        cellHeight,
      )
      .fill({ color: "#ffffff", alpha: hoverAlpha * 2 });

    if (stroke !== null) {
      apply(channel, step);
    }
  }

  function end(): void {
    if (stroke === null) {
      return;
    }

    stroke = null;
    session.edited();
  }

  function toggleLed(event: FederatedPointerEvent): void {
    const local: Point = view.toLocal(event.global);
    const channel: Channel | undefined =
      shown()[Math.floor((local.y - rowsTop) / rowHeight)];

    if (channel === undefined) {
      return;
    }

    session.record();
    channel.mute = !channel.mute;
    session.edited();
    redraw();
  }

  function tick(): void {
    const step: number | null = session.playhead("pattern");

    playhead.clear();

    if (step === null || Math.floor(step / stepsPerBar) !== page) {
      return;
    }

    playhead
      .rect(
        stepsX + (Math.floor(step) % stepsPerBar) * cellWidth,
        rowsTop,
        cellWidth - cellGap,
        Math.min(channels().length, visibleRows) * rowHeight,
      )
      .fill({ color: playheadColor, alpha: 0.18 });
  }

  function wheel(event: FederatedWheelEvent): void {
    const most: number = Math.max(channels().length - visibleRows, 0);
    const next: number = Math.min(
      Math.max(scroll + Math.sign(event.deltaY), 0),
      most,
    );

    if (next !== scroll) {
      scroll = next;
      redraw();
    }
  }

  function key(event: KeyboardEvent): boolean {
    if (
      (event.code === "ArrowLeft" || event.code === "ArrowRight") &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      page =
        (page + (event.code === "ArrowLeft" ? -1 : 1) + editBars(pattern())) %
        editBars(pattern());
      redraw();
      return true;
    }

    return false;
  }

  back.rect(0, 0, rowsWidth, areaHeight).fill(panelColor);

  for (let row = 0; row < visibleRows; row++) {
    back
      .rect(0, rowsTop + row * rowHeight, rowsWidth, rowHeight)
      .fill({ color: "#000000", alpha: row % 2 === 0 ? 0.08 : 0 });
  }

  settingsBack
    .rect(0, 0, settingsWidth, areaHeight)
    .fill(stripColor)
    .rect(0, 0, settingsWidth, areaHeight)
    .stroke({ color: "#1f272b", width: 1, alignment: 1 });
  settings.addChild(
    settingsBack,
    heading,
    ...labels,
    instrument.view,
    kit.view,
    sample.view,
    cut.view,
    insert.view,
    volume.view,
    pan.view,
    ...knobLabels,
    renameButton.view,
    rollButton.view,
    deleteButton.view,
  );
  settings.x = settingsX;
  leds.eventMode = "static";
  leds.cursor = "pointer";
  leds.hitArea = new Rectangle(0, rowsTop, ledX * 2, visibleRows * rowHeight);
  leds.on("pointertap", toggleLed);
  grid.eventMode = "static";
  grid.cursor = "pointer";
  grid.addChild(cells, playhead, hover);
  grid.on("pointerdown", begin);
  grid.on("globalpointermove", move);
  grid.on("pointerup", end);
  grid.on("pointerupoutside", end);
  grid.on("pointerleave", () => hover.clear());
  grid.on("wheel", wheel);
  add.view.position.set(nameX, rowsTop + visibleRows * rowHeight + 8);
  view.position.set(areaLeft, areaTop);
  view.addChild(back, pages, grid, leds, rows, settings, add.view);

  return { view: view, redraw: redraw, tick: tick, key: key };
}

export { createRack };
