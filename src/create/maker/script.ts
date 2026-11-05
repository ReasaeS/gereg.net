import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type Application,
  type Point,
  type FederatedPointerEvent,
  type FederatedWheelEvent,
} from "pixi.js";
import { createGlide, mix, type Glide } from "../../ui/motion";
import { createRetype, type Retype } from "../../ui/retype";
import { screenResolution, sharpen } from "../../ui/text";
import {
  countTranscript,
  focusMark,
  lineSpeedMax,
  lineSpeedMin,
  soundMark,
  type Count,
} from "../transcript";
import { getAutosave } from "../../settings/settings";
import { syllablesOf } from "../jungle";
import {
  blinkOn,
  blinkPeriod,
  firstDelay,
  dividerGlyph,
  footerColor,
  footerMark,
  headerColor,
  headerPadding,
  headerTextColor,
  lineDelay,
  lineHeight,
  lineSize,
  monoFamily,
  screenMargin,
  textColor,
} from "../../menu/terminal";

type Page = "transcript" | "lyrics";

type Script = {
  view: Container;
  open: (
    initial: string,
    apply: (text: string) => string | null,
    sounds: Array<string>,
    page?: Page,
  ) => void;
  close: () => void;
  shown: () => boolean;
  update: (delta: number) => void;
};

type Command = {
  text: Text;
  back: Graphics;
  hover: Glide;
};

type Spot = {
  line: number;
  column: number;
};

type Row = {
  number: Text;
  text: Text;
};

type Block = {
  from: number;
  to: number;
  rows: Array<string>;
};

const scriptShare: number = 0.9; // of screen size
const scriptZoom: number = 1.35;
const shadeColor: string = "#000000";
const shadeAlpha: number = 0.8;
const openSmoothing: number = 0.2; // s
const hoverSmoothing: number = 0.08; // s
const headerText: string =
  "GEREG.NET // [>] Name (Emotion): text {40:paced} " + soundMark + " Sound";
const lyricsHeader: string =
  "GEREG.NET // LYRICS: english words, or romaji with hyphens (ki-mi)";
const focusCode: string = "KeyF";
const soundCode: string = "KeyS";
const speedCode: string = "KeyT";
const noneText: string = "(none)";
const normalText: string = "(normal)";
const speedSuffix: string = " chars/s";
const speedChoices: Array<string> = [
  "5",
  "10",
  "15",
  "20",
  "30",
  "40",
  "60",
  "80",
  "100",
  "120",
];
const paceMark: RegExp = /\{(\d+):([^{}]*)\}/g;
const lineSplit: string = ":";
const searchMark: string = "/";
const searchHint: string = "type to search";
const noMatch: string = "no match";
const pickRowsMax: number = 8;
const pickPadding: number = 1; // characters
const noSounds: string = "Make a sound card first";
const noPortion: string = "Select some spoken text first";
const oneLine: string = "Select text on one line";
const overlapping: string = "The selection overlaps a speed mark";
const autosaveDelay: number = 0.8; // s
const writtenText: string = " written";
const insertText: string = "-- INSERT --";
const visualText: string = "-- VISUAL --";
const emptyLine: string = "~";
const numberAlpha: number = 0.45;
const emptyAlpha: number = 0.45;
const caretAlpha: number = 0.7;
const selectionAlpha: number = 0.3;
const wheelLines: number = 3;
const commandGap: number = 2; // characters
const gutterDigits: number = 3; // characters
const rulerWidth: number = 14; // characters
const positionWidth: number = 4; // characters

function monoText(color: string): Text {
  return new Text({
    text: "",
    style: { fontFamily: monoFamily, fontSize: lineSize, fill: color },
  });
}

function fileText(count: Count | null): string {
  return count === null
    ? "0L"
    : count.lines +
        "L, " +
        count.speakers +
        (count.speakers === 1 ? " speaker" : " speakers");
}

function lyricsText(text: string): string {
  const count: number = syllablesOf(text).length;

  return count + (count === 1 ? " syllable" : " syllables");
}

function createScript(app: Application): Script {
  const view: Container = new Container();
  const shade: Graphics = new Graphics();
  const screen: Container = new Container();
  const dim: Graphics = new Graphics();
  const header: Graphics = new Graphics();
  const title: Text = monoText(headerTextColor);
  const footer: Graphics = new Graphics();
  const divider: Text = monoText(textColor);
  const status: Text = monoText(textColor);
  const statusRetype: Retype = createRetype(status);
  const ruler: Text = monoText(textColor);
  const mark: Text = monoText(textColor);
  const lines: Container = new Container();
  const lineMask: Graphics = new Graphics();
  const selection: Graphics = new Graphics();
  const caret: Graphics = new Graphics();
  const rows: Array<Row> = new Array();
  const commands: Array<Command> = new Array();
  const picker: Container = new Container();
  const pickBack: Graphics = new Graphics();
  const pickBar: Graphics = new Graphics();
  const pickRows: Array<Text> = new Array();
  const pickQuery: Text = monoText(textColor);
  let sounds: Array<string> = new Array();
  let listed: Array<string> = new Array();
  let choices: Array<string> = new Array();
  let query: string = "";
  let pickCode: string = "";
  let noneLabel: string = noneText;
  let numeric: boolean = false;
  let chosen: (value: string) => void = () => undefined;
  let picking: boolean = false;
  let choice: number = 0;
  let pickScroll: number = 0;
  let barRow: number = 0;
  const holder: HTMLDivElement = document.createElement("div");
  const area: HTMLTextAreaElement = document.createElement("textarea");
  let apply: (text: string) => string | null = () => null;
  let page: Page = "transcript";
  let open: boolean = false;
  let failed: boolean = false;
  let written: boolean = false;
  let saved: string = "";
  let pending: number = -1;
  let elapsed: number = 0;
  let blinkTime: number = 0;
  let glyph: number = 1;
  let scrollLine: number = 0;
  let scrollColumn: number = 0;
  let lastCaret: number = -1;
  let anchor: number = -1;
  let painted: string = "";
  let textTop: number = 0;
  let textLeft: number = 0;
  let gutter: number = gutterDigits;
  let visibleRows: number = 0;
  let visibleColumns: number = 0;
  const amount: Glide = createGlide(
    0,
    (value: number) => {
      view.alpha = value;
      view.visible = value > 0.001;
    },
    openSmoothing,
  );
  const pickAmount: Glide = createGlide(
    0,
    (value: number) => {
      picker.alpha = value;
      picker.visible = value > 0.001;
    },
    hoverSmoothing,
  );
  const bar: Glide = createGlide(
    0,
    (value: number) => {
      barRow = value;
    },
    hoverSmoothing,
  );

  function bounds(): Rectangle {
    const share: number = 1 + (scriptShare - 1) * amount.value();

    return new Rectangle(
      Math.round((app.screen.width * (1 - share)) / 2),
      Math.round((app.screen.height * (1 - share)) / 2),
      Math.round(app.screen.width * share),
      Math.round(app.screen.height * share),
    );
  }

  function inner(): Rectangle {
    const frame: Rectangle = bounds();

    return new Rectangle(
      0,
      0,
      frame.width / scriptZoom,
      frame.height / scriptZoom,
    );
  }

  function shownCount(): number {
    return Math.floor((elapsed - firstDelay) / lineDelay) + 1;
  }

  function textLines(): Array<string> {
    return area.value.split("\n");
  }

  function spotOf(index: number): Spot {
    const before: Array<string> = area.value.slice(0, index).split("\n");

    return {
      line: before.length - 1,
      column: before[before.length - 1]!.length,
    };
  }

  function indexOf(spot: Spot): number {
    const list: Array<string> = textLines();
    let index: number = 0;

    for (let line = 0; line < spot.line; line++) {
      index += list[line]!.length + 1;
    }

    return index + spot.column;
  }

  function caretIndex(): number {
    return area.selectionDirection === "backward"
      ? area.selectionStart
      : area.selectionEnd;
  }

  function spotAt(x: number, y: number): Spot {
    const list: Array<string> = textLines();
    const line: number = Math.min(
      Math.max(Math.floor((y - textTop) / lineHeight) + scrollLine, 0),
      list.length - 1,
    );

    return {
      line: line,
      column: Math.min(
        Math.max(Math.round((x - textLeft) / glyph) + scrollColumn, 0),
        list[line]!.length,
      ),
    };
  }

  function select(from: number, to: number): void {
    area.setSelectionRange(
      Math.min(from, to),
      Math.max(from, to),
      to < from ? "backward" : "forward",
    );
  }

  function reveal(spot: Spot): void {
    if (spot.line < scrollLine) {
      scrollLine = spot.line;
    } else if (spot.line >= scrollLine + visibleRows) {
      scrollLine = spot.line - visibleRows + 1;
    }

    if (spot.column < scrollColumn) {
      scrollColumn = spot.column;
    } else if (spot.column >= scrollColumn + visibleColumns) {
      scrollColumn = spot.column - visibleColumns + 1;
    }
  }

  function modeText(): string {
    return (
      (area.selectionStart === area.selectionEnd ? insertText : visualText) +
      "  " +
      (page === "lyrics"
        ? lyricsText(area.value)
        : fileText(countTranscript(area.value))) +
      (written ? writtenText : "")
    );
  }

  function close(): void {
    if (!open) {
      return;
    }

    if (getAutosave() && area.value !== saved) {
      apply(area.value);
    }

    open = false;
    pending = -1;
    closePicker();
    area.blur();
    holder.remove();
    amount.set(0);
  }

  function selectedBlock(): Block {
    const value: string = area.value;
    const from: number = value.lastIndexOf("\n", area.selectionStart - 1) + 1;
    const end: number = value.indexOf("\n", area.selectionEnd);
    const to: number = end < 0 ? value.length : end;

    return { from: from, to: to, rows: value.slice(from, to).split("\n") };
  }

  function edited(): void {
    failed = false;
    written = false;
    pending = getAutosave() ? 0 : -1;
    area.focus({ preventScroll: true });
  }

  function toggleFocus(): void {
    const collapsed: boolean = area.selectionStart === area.selectionEnd;
    const caret: number = area.selectionStart;
    const { from, to, rows: block }: Block = selectedBlock();
    const filled: Array<string> = block.filter(
      (row: string) => row.trim() !== "",
    );
    const marked: boolean =
      filled.length > 0 &&
      filled.every((row: string) => row.trimStart().startsWith(">"));
    const next: string = block
      .map((row: string) =>
        row.trim() === ""
          ? row
          : marked
            ? row.replace(/^(\s*)>\s*/, "$1")
            : focusMark + row,
      )
      .join("\n");

    area.setRangeText(next, from, to, collapsed ? "preserve" : "select");

    if (collapsed) {
      const moved: number = caret + next.length - (to - from);

      area.setSelectionRange(Math.max(moved, from), Math.max(moved, from));
    }

    edited();
  }

  function soundOf(row: string): string {
    const at: number = row.indexOf(soundMark);

    return at < 0 ? "" : row.slice(at + soundMark.length).trim();
  }

  function moveChoice(index: number): void {
    if (choices.length === 0) {
      return;
    }

    choice = (index + choices.length) % choices.length;
    pickScroll = Math.min(
      Math.max(pickScroll, choice - pickRowsMax + 1),
      choice,
    );
    bar.set(choice);
  }

  function fail(problem: string): void {
    failed = true;
    statusRetype.set("E: " + problem, true);
  }

  function openSounds(): void {
    if (sounds.length === 0) {
      fail(noSounds);
      return;
    }

    openPicker(
      soundCode,
      sounds,
      soundOf(textLines()[spotOf(caretIndex()).line] ?? ""),
      noneText,
      false,
      chooseSound,
    );
  }

  function openSpeeds(): void {
    const start: Spot = spotOf(area.selectionStart);
    const end: Spot = spotOf(area.selectionEnd);

    if (start.line !== end.line) {
      fail(oneLine);
      return;
    }

    const row: string = textLines()[start.line]!;
    const lineStart: number = indexOf({ line: start.line, column: 0 });
    const split: number = row.indexOf(lineSplit);
    const sound: number = row.indexOf(soundMark);

    if (
      split < 0 ||
      start.column <= split ||
      (sound >= 0 && end.column > sound)
    ) {
      fail(noPortion);
      return;
    }

    for (const match of row.matchAll(paceMark)) {
      const from: number = match.index;
      const to: number = from + match[0].length;

      if (from <= start.column && end.column <= to) {
        openPicker(
          speedCode,
          speedChoices,
          match[1]!,
          normalText,
          true,
          (value: string) =>
            area.setRangeText(
              value === "" ? match[2]! : "{" + value + ":" + match[2]! + "}",
              lineStart + from,
              lineStart + to,
              "select",
            ),
        );
        return;
      }
    }

    const portion: string = row.slice(start.column, end.column);

    if (portion === "") {
      fail(noPortion);
      return;
    }

    if (portion.includes("{") || portion.includes("}")) {
      fail(overlapping);
      return;
    }

    openPicker(
      speedCode,
      speedChoices,
      "",
      normalText,
      true,
      (value: string) => {
        if (value !== "") {
          area.setRangeText(
            "{" + value + ":" + portion + "}",
            area.selectionStart,
            area.selectionEnd,
            "select",
          );
        }
      },
    );
  }

  function openPicker(
    code: string,
    options: Array<string>,
    current: string,
    none: string,
    custom: boolean,
    apply: (value: string) => void,
  ): void {
    const lower: string = current.toLowerCase();

    pickCode = code;
    noneLabel = none;
    numeric = custom;
    chosen = apply;
    listed = ["", ...new Set(options)];
    choices = listed;
    query = "";
    choice = Math.max(
      choices.findIndex(
        (value: string) => value !== "" && value.toLowerCase() === lower,
      ),
      0,
    );
    pickScroll = Math.max(choice - pickRowsMax + 1, 0);
    bar.snap(choice);
    picking = true;

    while (pickRows.length < Math.min(listed.length, pickRowsMax)) {
      const text: Text = monoText("#ffffff");
      const row: number = pickRows.length;

      text.anchor.set(0, 0.5);
      text.eventMode = "static";
      text.cursor = "pointer";
      text.on("pointerover", () => moveChoice(pickScroll + row));
      text.on("pointertap", () => choose(pickScroll + row));
      pickRows.push(text);
      picker.addChild(text);
    }

    pickAmount.set(1);
  }

  function search(next: string): void {
    const lower: string = next.toLowerCase();
    const found: Array<string> = listed.filter(
      (value: string) => value !== "" && value.toLowerCase().includes(lower),
    );

    const typed: number = Number(next);
    const extra: Array<string> =
      numeric &&
      /^\d+$/.test(next) &&
      typed >= lineSpeedMin &&
      typed <= lineSpeedMax &&
      !listed.includes(String(typed))
        ? [String(typed)]
        : new Array();

    query = next;
    choices =
      next === ""
        ? listed
        : [
            ...extra,
            ...found.filter((value: string) =>
              value.toLowerCase().startsWith(lower),
            ),
            ...found.filter(
              (value: string) => !value.toLowerCase().startsWith(lower),
            ),
          ];
    choice = 0;
    pickScroll = 0;
    bar.set(0);
  }

  function closePicker(): void {
    picking = false;
    pickAmount.set(0);
  }

  function choose(index: number): void {
    const value: string | undefined = choices[index];

    if (value === undefined) {
      return;
    }

    closePicker();
    chosen(value);
    edited();
  }

  function chooseSound(name: string): void {
    const collapsed: boolean = area.selectionStart === area.selectionEnd;
    const caret: number = area.selectionStart;
    const { from, to, rows }: Block = selectedBlock();
    const next: string = rows
      .map((row: string) => {
        if (row.trim() === "") {
          return row;
        }

        const at: number = row.indexOf(soundMark);
        const text: string = at < 0 ? row : row.slice(0, at).trimEnd();

        return name === "" ? text : text + " " + soundMark + " " + name;
      })
      .join("\n");

    area.setRangeText(next, from, to, collapsed ? "preserve" : "select");

    if (collapsed) {
      const moved: number = Math.min(caret, from + next.length);

      area.setSelectionRange(moved, moved);
    }
  }

  function paintPicker(): void {
    if (!picker.visible) {
      return;
    }

    const frame: Rectangle = inner();
    const spot: Spot = spotOf(caretIndex());
    const count: number = Math.max(Math.min(choices.length, pickRowsMax), 1);
    const columns: number =
      Math.max(
        noneLabel.length,
        searchMark.length + Math.max(query.length + 1, searchHint.length),
        ...listed.map(
          (value: string) =>
            value.length + (numeric && value !== "" ? speedSuffix.length : 0),
        ),
      ) +
      pickPadding * 2;
    const width: number = columns * glyph;
    const height: number = (count + 1) * lineHeight;
    const search: string = searchMark + (query === "" ? searchHint : query);
    const bottom: number = frame.height - lineHeight * 3 - lineHeight / 2;
    const below: number = textTop + (spot.line - scrollLine + 1) * lineHeight;

    picker.position.set(
      Math.min(
        Math.max(textLeft + (spot.column - scrollColumn) * glyph, textLeft),
        frame.width - screenMargin - width,
      ),
      below + height > bottom ? below - lineHeight - height : below,
    );
    pickBack
      .clear()
      .rect(0, 0, width, height)
      .fill(footerColor)
      .stroke({ color: textColor, width: 1, alignment: 1 });
    pickBar
      .clear()
      .rect(0, (barRow - pickScroll + 1) * lineHeight, width, lineHeight)
      .fill(headerColor);
    pickBar.visible = choices.length > 0;

    if (pickQuery.text !== search) {
      pickQuery.text = search;
    }

    pickQuery.alpha = query === "" ? emptyAlpha : 1;
    pickQuery.position.set(pickPadding * glyph, lineHeight / 2);

    for (let index = 0; index < pickRows.length; index++) {
      const text: Text = pickRows[index]!;
      const value: string | undefined = choices[pickScroll + index];
      const label: string =
        choices.length === 0 && index === 0
          ? noMatch
          : value === ""
            ? noneLabel
            : value === undefined
              ? ""
              : value + (numeric ? speedSuffix : "");

      text.visible = index < count;
      text.alpha = choices.length === 0 ? emptyAlpha : 1;

      if (text.text !== label) {
        text.text = label;
      }

      text.position.set(
        pickPadding * glyph,
        (index + 1) * lineHeight + lineHeight / 2,
      );
      text.tint = mix(
        textColor,
        headerTextColor,
        Math.max(1 - Math.abs(barRow - pickScroll - index), 0),
      );
    }
  }

  function submit(): void {
    const problem: string | null = apply(area.value);

    if (problem === null) {
      close();
      return;
    }

    fail(problem);
  }

  function openScript(
    initial: string,
    applied: (text: string) => string | null,
    names: Array<string>,
    kind: Page = "transcript",
  ): void {
    apply = applied;
    sounds = names;
    page = kind;
    title.text = kind === "lyrics" ? lyricsHeader : headerText;
    commands.forEach((command: Command, index: number) => {
      command.text.visible = kind === "transcript" || index < 2;
      command.back.visible = command.text.visible;
    });
    open = true;
    failed = false;
    written = false;
    saved = initial;
    pending = -1;
    commands[0]!.text.text = getAutosave() ? "CLOSE" : "CANCEL";
    elapsed = 0;
    scrollLine = 0;
    scrollColumn = 0;
    lastCaret = -1;
    painted = "";
    glyph = monoWidth();
    area.value = initial;
    statusRetype.set(modeText(), false);
    document.body.append(holder);
    area.focus({ preventScroll: true });
    area.setSelectionRange(0, 0);
    amount.set(1);
  }

  function monoWidth(): number {
    const probe: Text = monoText(textColor);

    probe.text = "0".repeat(10);

    const measured: number = probe.width / 10;

    probe.destroy();

    return measured;
  }

  function layout(): void {
    const outer: Rectangle = bounds();
    const frame: Rectangle = inner();
    const barHeight: number = lineHeight + headerPadding * 2;
    const dividerY: number = frame.height - lineHeight * 2;
    const noteY: number = dividerY + lineHeight;
    const footerTop: number = dividerY - lineHeight / 2;
    const statusY: number = dividerY - lineHeight;
    const dividerText: string = dividerGlyph.repeat(
      Math.max(Math.ceil(frame.width / Math.max(glyph, 1)), 0),
    );

    gutter = Math.max(String(textLines().length).length, gutterDigits) + 1;
    screen.position.set(outer.x, outer.y);
    screen.scale.set(scriptZoom);
    sharpen(screen, screenResolution(scriptZoom));
    shade
      .clear()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: shadeColor, alpha: shadeAlpha })
      .rect(outer.x, outer.y, outer.width, outer.height)
      .cut();
    shade.hitArea = app.screen;
    screen.hitArea = new Rectangle(0, 0, frame.width, frame.height);
    dim.clear().rect(0, 0, frame.width, frame.height).fill(footerColor);
    header.clear().rect(0, 0, frame.width, barHeight).fill(headerColor);
    title.position.set(screenMargin, barHeight / 2);
    footer
      .clear()
      .rect(0, footerTop, frame.width, frame.height - footerTop)
      .fill(footerColor);

    if (divider.text !== dividerText) {
      divider.text = dividerText;
    }

    divider.width = frame.width;
    divider.position.set(0, dividerY);
    status.position.set(screenMargin, statusY);
    ruler.position.set(frame.width - screenMargin, statusY);
    mark.position.set(frame.width - screenMargin, noteY);
    textTop = barHeight + headerPadding;
    textLeft = screenMargin + gutter * glyph;
    visibleRows = Math.max(
      Math.floor((statusY - lineHeight / 2 - textTop) / lineHeight),
      1,
    );
    visibleColumns = Math.max(
      Math.floor((frame.width - screenMargin - textLeft) / glyph),
      1,
    );
    lineMask
      .clear()
      .rect(0, textTop, frame.width, visibleRows * lineHeight)
      .fill(0xffffff);
    lines.hitArea = new Rectangle(
      0,
      textTop,
      frame.width,
      visibleRows * lineHeight,
    );

    let x: number = screenMargin;

    for (const command of commands) {
      if (!command.text.visible) {
        continue;
      }

      command.text.position.set(x, noteY);
      command.back
        .clear()
        .rect(
          x - glyph / 2,
          noteY - lineHeight / 2,
          command.text.width + glyph,
          lineHeight,
        )
        .fill(headerColor);
      x += command.text.width + commandGap * glyph;
    }
  }

  function rulerText(focus: Spot, total: number): string {
    const position: string =
      total <= visibleRows
        ? "All"
        : scrollLine === 0
          ? "Top"
          : scrollLine + visibleRows >= total
            ? "Bot"
            : Math.round((scrollLine / (total - visibleRows)) * 100) + "%";

    return (
      (focus.line + 1 + "," + (focus.column + 1)).padEnd(
        rulerWidth - positionWidth,
      ) + position.padStart(positionWidth - 1)
    );
  }

  function paintLines(): void {
    const list: Array<string> = textLines();
    const focus: number = caretIndex();
    const key: string = [
      area.value,
      area.selectionStart,
      area.selectionEnd,
      scrollLine,
      scrollColumn,
      visibleRows,
      visibleColumns,
    ].join("|");

    if (focus !== lastCaret) {
      lastCaret = focus;
      reveal(spotOf(focus));
    }

    while (rows.length < visibleRows) {
      const row: Row = {
        number: monoText(textColor),
        text: monoText(textColor),
      };

      rows.push(row);
      lines.addChild(row.number, row.text);
    }

    const shown: number = shownCount();

    for (let index = 0; index < rows.length; index++) {
      const row: Row = rows[index]!;
      const visible: boolean = index < visibleRows && index < shown;

      row.number.visible = visible;
      row.text.visible = visible;
      row.number.position.set(screenMargin, textTop + index * lineHeight);
      row.text.position.set(textLeft, textTop + index * lineHeight);
    }

    if (key === painted) {
      return;
    }

    painted = key;

    const spot: Spot = spotOf(focus);

    for (let index = 0; index < visibleRows; index++) {
      const row: Row = rows[index]!;
      const line: number = scrollLine + index;
      const filled: boolean = line < list.length;
      const number: string = filled
        ? String(line + 1).padStart(gutter - 1) + " "
        : emptyLine;
      const text: string = filled
        ? list[line]!.slice(scrollColumn, scrollColumn + visibleColumns)
        : "";

      if (row.number.text !== number) {
        row.number.text = number;
      }

      if (row.text.text !== text) {
        row.text.text = text;
      }

      row.number.alpha = !filled
        ? emptyAlpha
        : line === spot.line
          ? 1
          : numberAlpha;
    }

    const start: Spot = spotOf(area.selectionStart);
    const end: Spot = spotOf(area.selectionEnd);
    const left: number = textLeft - scrollColumn * glyph;

    selection.clear();

    for (let line = start.line; line <= end.line; line++) {
      const row: number = line - scrollLine;

      if (
        area.selectionStart === area.selectionEnd ||
        row < 0 ||
        row >= visibleRows
      ) {
        continue;
      }

      const from: number = line === start.line ? start.column : 0;
      const to: number =
        line === end.line ? end.column : list[line]!.length + 1;
      const x: number = Math.max(left + from * glyph, textLeft);
      const right: number = left + to * glyph;

      if (right > x) {
        selection.rect(x, textTop + row * lineHeight, right - x, lineHeight);
      }
    }

    selection.fill({ color: textColor, alpha: selectionAlpha });
    caret
      .clear()
      .rect(
        left + spot.column * glyph,
        textTop + (spot.line - scrollLine) * lineHeight,
        glyph,
        lineHeight,
      )
      .fill({ color: textColor, alpha: caretAlpha });
    caret.visible =
      spot.line >= scrollLine && spot.line < scrollLine + visibleRows;
    ruler.text = rulerText(spot, list.length);

    if (!failed) {
      statusRetype.set(modeText(), false);
    }
  }

  function autosaveStep(delta: number): void {
    if (pending < 0) {
      return;
    }

    pending += delta;

    if (pending < autosaveDelay) {
      return;
    }

    pending = -1;

    if (area.value === saved) {
      return;
    }

    const problem: string | null = apply(area.value);

    if (problem === null) {
      saved = area.value;
      written = true;
      statusRetype.set(modeText(), true);
    } else {
      fail(problem);
    }
  }

  function update(delta: number): void {
    if (!view.visible) {
      return;
    }

    if (open) {
      autosaveStep(delta);
    }

    elapsed += delta;
    blinkTime = (blinkTime + delta) % blinkPeriod;
    layout();
    paintLines();
    paintPicker();
    caret.alpha = blinkTime < blinkPeriod * blinkOn ? 1 : 0;

    if (open && document.activeElement !== area) {
      area.focus({ preventScroll: true });
    }
  }

  function addCommand(label: string, action: () => void): void {
    const text: Text = monoText("#ffffff");
    const back: Graphics = new Graphics();
    const command: Command = {
      text: text,
      back: back,
      hover: createGlide(
        0,
        (value: number) => {
          back.alpha = value;
          text.tint = mix(textColor, headerTextColor, value);
        },
        hoverSmoothing,
      ),
    };

    text.text = label;
    text.anchor.set(0, 0.5);
    text.tint = textColor;
    text.eventMode = "static";
    text.cursor = "pointer";
    back.alpha = 0;
    text.on("pointerover", () => command.hover.set(1));
    text.on("pointerout", () => command.hover.set(0));
    text.on("pointertap", action);
    commands.push(command);
    screen.addChild(back, text);
  }

  Object.assign(holder.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    opacity: "0",
    pointerEvents: "none",
  });
  area.spellcheck = false;
  area.wrap = "off";
  holder.append(area);

  for (const name of ["keyup", "keypress"]) {
    holder.addEventListener(name, (event: Event) => event.stopPropagation());
  }

  holder.addEventListener("keydown", (event: KeyboardEvent) => {
    event.stopPropagation();

    const command: string =
      event.altKey && !event.ctrlKey && !event.metaKey && page === "transcript"
        ? event.code
        : "";

    if (picking) {
      event.preventDefault();

      if (event.key === "ArrowUp") {
        moveChoice(choice - 1);
      } else if (event.key === "ArrowDown") {
        moveChoice(choice + 1);
      } else if (event.key === "Enter") {
        choose(choice);
      } else if (event.key === "Escape" || command === pickCode) {
        closePicker();
      } else if (event.key === "Backspace") {
        search(query.slice(0, -1));
      } else if (
        event.key.length === 1 &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        search(query + event.key);
      }

      return;
    }

    if (command === soundCode) {
      event.preventDefault();
      openSounds();
    } else if (command === speedCode) {
      event.preventDefault();
      openSpeeds();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    } else if (event.key === "Tab") {
      event.preventDefault();
    } else if (command === focusCode) {
      event.preventDefault();
      toggleFocus();
    }
  });
  area.addEventListener("input", () => {
    failed = false;
    written = false;
    pending = getAutosave() ? 0 : -1;
  });

  title.text = headerText;
  title.anchor.set(0, 0.5);
  mark.text = footerMark;
  mark.anchor.set(1, 0.5);
  ruler.anchor.set(1, 0.5);
  divider.anchor.set(0, 0.5);
  status.anchor.set(0, 0.5);
  lines.mask = lineMask;
  lines.addChild(selection, caret);
  lines.eventMode = "static";
  lines.cursor = "text";
  lines.on("pointerdown", (event: FederatedPointerEvent) => {
    if (picking) {
      closePicker();
      return;
    }

    const local: Point = event.getLocalPosition(screen);
    const index: number = indexOf(spotAt(local.x, local.y));

    anchor = !event.shiftKey
      ? index
      : caretIndex() === area.selectionStart
        ? area.selectionEnd
        : area.selectionStart;
    select(anchor, index);
    area.focus({ preventScroll: true });
  });
  lines.on("globalpointermove", (event: FederatedPointerEvent) => {
    if (anchor < 0 || event.buttons === 0) {
      anchor = -1;
      return;
    }

    const local: Point = event.getLocalPosition(screen);

    select(anchor, indexOf(spotAt(local.x, local.y)));
  });
  lines.on("pointerup", () => {
    anchor = -1;
  });
  lines.on("pointerupoutside", () => {
    anchor = -1;
  });
  lines.on("wheel", (event: FederatedWheelEvent) => {
    scrollLine = Math.min(
      Math.max(scrollLine + Math.sign(event.deltaY) * wheelLines, 0),
      Math.max(textLines().length - visibleRows, 0),
    );
  });
  screen.eventMode = "static";
  screen.addChild(dim, header, title, lines, lineMask, footer, divider);
  screen.addChild(status, ruler, mark);
  pickQuery.anchor.set(0, 0.5);
  picker.addChild(pickBack, pickBar, pickQuery);
  picker.eventMode = "static";
  picker.on("wheel", (event: FederatedWheelEvent) => {
    moveChoice(
      Math.min(
        Math.max(choice + Math.sign(event.deltaY), 0),
        choices.length - 1,
      ),
    );
  });
  screen.addChild(picker);
  addCommand("CANCEL", close);
  addCommand("SAVE", submit);
  addCommand("LINE FOCUS", toggleFocus);
  addCommand("SOUND", () => (picking ? closePicker() : openSounds()));
  addCommand("SPEED", () => (picking ? closePicker() : openSpeeds()));
  shade.eventMode = "static";
  shade.on("pointertap", close);
  view.addChild(shade, screen);
  amount.snap(0);
  pickAmount.snap(0);

  return {
    view: view,
    open: openScript,
    close: close,
    shown: () => open,
    update: update,
  };
}

export { createScript };
export type { Page, Script };
