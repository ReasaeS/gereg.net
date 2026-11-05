import { Container, Graphics, Text, type Application } from "pixi.js";
import type { Channel, Note, Score, Sequence, Sound } from "../types";
import { keyNames, scoreLength, songBars, stepLength } from "../jungle";
import {
  addPattern,
  clonePattern,
  fitPattern,
  removePattern,
  soloScore,
} from "../arrange";
import { playTrack, previewNote, stopPreview, type Track } from "../sound";
import { createText, screenResolution, sharpen } from "../../ui/text";
import { createGlide, type Glide } from "../../ui/motion";
import { hudHeight, hudWidth } from "../../game/field";
import { createRack } from "./compose/rack";
import { createRoll } from "./compose/roll";
import { createPlaylist } from "./compose/playlist";
import { createMixer } from "./compose/mixer";
import { buttonHeight, createButton, type Button } from "./compose/controls";
import {
  accentColor,
  areaBottom,
  areaLeft,
  areaRight,
  dimColor,
  rename,
  textColor,
  toolbarColor,
  windowColor,
  type Mode,
  type Panel,
  type Session,
  type View,
} from "./compose/shared";

type Composer = {
  view: Container;
  open: (sound: Sound) => void;
  close: () => void;
  shown: () => boolean;
  layout: (scale: number) => void;
};

const titleSize: number = 12; // units
const titleY: number = 14; // units
const infoY: number = 30; // units
const transportY: number = 22; // units
const bandBottom: number = 44; // units
const toolbarY: number = 56; // units
const patternY: number = 80; // units
const hintY: number = 450; // units
const hintGap: number = 11; // units
const hintSize: number = 7; // units
const infoSize: number = 7; // units
const buttonGap: number = 4; // units
const modeWidth: number = 40; // units
const playWidth: number = 46; // units
const stopWidth: number = 46; // units
const doneWidth: number = 50; // units
const tempoWidth: number = 64; // units
const tempoSize: number = 10; // units
const arrowWidth: number = 18; // units
const patternWidth: number = 110; // units
const newWidth: number = 44; // units
const cloneWidth: number = 52; // units
const deleteWidth: number = 56; // units
const historyMost: number = 80;
const recordGap: number = 400; // ms
const restartDelay: number = 200; // ms
const viewNames: Array<[View, string, number, string]> = [
  ["playlist", "Playlist", 66, "F5"],
  ["rack", "Channel rack", 90, "F6"],
  ["roll", "Piano roll", 76, "F7"],
  ["mixer", "Mixer", 56, "F9"],
];
const hints: Record<View, string> = {
  playlist:
    "CLICK TO PLACE THE PATTERN  ·  DRAG TO MOVE  ·  DRAG THE END TO STRETCH  ·  RIGHT-CLICK TO DELETE",
  rack: "CLICK STEPS TO PLACE HITS  ·  RIGHT-CLICK TO CLEAR  ·  DRAG KNOBS  ·  DOUBLE-CLICK A CHANNEL FOR ITS PIANO ROLL",
  roll: "CLICK DRAWS  ·  DRAG MOVES  ·  SHIFT+DRAG COPIES  ·  CTRL+DRAG SELECTS  ·  RIGHT-CLICK ERASES  ·  CTRL+C V B  ·  DEL",
  mixer:
    "DRAG KNOBS AND FADERS  ·  DOUBLE-CLICK RESETS  ·  ROUTE CHANNELS FROM THE CHANNEL RACK",
};
const keysHint: string =
  "SPACE PLAY  ·  L PATTERN / SONG  ·  F5 F6 F7 F9 VIEWS  ·  CTRL+Z UNDO  ·  CTRL+Y REDO";

function createComposer(
  app: Application,
  changed: () => void,
  closed: () => void,
  write: (initial: string, apply: (text: string) => string | null) => void,
): Composer {
  const view: Container = new Container();
  const backdrop: Graphics = new Graphics();
  const board: Container = new Container();
  const overlay: Container = new Container();
  const title: Text = createText(titleSize, textColor);
  const info: Text = createText(infoSize, dimColor);
  const tempo: Text = createText(tempoSize, accentColor);
  const hint: Text = createText(hintSize, dimColor);
  const keys: Text = createText(hintSize, dimColor);
  const patternBar: Container = new Container();
  const amount: Glide = createGlide(0, (value: number) => {
    view.alpha = value;
    view.visible = value > 0;
  });
  let sound: Sound | null = null;
  let current: View = "rack";
  let patternId: string = "";
  let channelId: string = "";
  let mode: Mode = "song";
  let playing: boolean = false;
  let playMode: Mode = "song";
  let track: Track | null = null;
  let token: number = 0;
  let restartTimer: number | null = null;
  let lastRecord: number = 0;
  let boardScale: number = 1;
  const undoList: Array<string> = new Array();
  const redoList: Array<string> = new Array();

  const session: Session = {
    score: score,
    pattern: pattern,
    channel: channel,
    choosePattern: choosePattern,
    chooseChannel: (value: Channel) => {
      channelId = value.id;
    },
    show: show,
    record: record,
    edited: edited,
    refresh: refresh,
    write: write,
    playhead: playhead,
    overlay: () => overlay,
    hear: (value: Channel, note: Note) => previewNote(score(), value, note),
  };
  const panels: Record<View, Panel> = {
    playlist: createPlaylist(session),
    rack: createRack(session),
    roll: createRoll(session),
    mixer: createMixer(session),
  };
  const fades: Record<View, Glide> = {
    playlist: panelGlide("playlist"),
    rack: panelGlide("rack"),
    roll: panelGlide("roll"),
    mixer: panelGlide("mixer"),
  };
  const viewButtons: Array<Button> = viewNames.map(
    ([value, name, width]: [View, string, number, string]) =>
      createButton(
        name,
        width,
        () => show(value),
        () => current === value,
      ),
  );
  const patternMode: Button = createButton(
    "Pat",
    modeWidth,
    () => chooseMode("pattern"),
    () => mode === "pattern",
  );
  const songMode: Button = createButton(
    "Song",
    modeWidth,
    () => chooseMode("song"),
    () => mode === "song",
  );
  const play: Button = createButton(
    "Play",
    playWidth,
    togglePlaying,
    () => playing,
  );
  const stop: Button = createButton("Stop", stopWidth, () => {
    stopPlaying();
    paintButtons();
  });
  const done: Button = createButton("Done", doneWidth, close);
  const previous: Button = createButton("<", arrowWidth, () =>
    cyclePattern(-1),
  );
  const patternButton: Button = createButton("", patternWidth, renamePattern);
  const next: Button = createButton(">", arrowWidth, () => cyclePattern(1));
  const newButton: Button = createButton("New", newWidth, newPattern);
  const cloneButton: Button = createButton("Clone", cloneWidth, copyPattern);
  const deleteButton: Button = createButton(
    "Delete",
    deleteWidth,
    deletePattern,
  );

  function panelGlide(value: View): Glide {
    return createGlide(0, (amount: number) => {
      panels[value].view.alpha = amount;
      panels[value].view.visible = amount > 0;
    });
  }

  function score(): Score {
    return sound!.score;
  }

  function pattern(): Sequence {
    const found: Sequence =
      score().patterns.find((entry: Sequence) => entry.id === patternId) ??
      score().patterns[0]!;

    patternId = found.id;
    return found;
  }

  function channel(): Channel | null {
    const found: Channel | null =
      score().channels.find((entry: Channel) => entry.id === channelId) ??
      score().channels[0] ??
      null;

    channelId = found?.id ?? "";
    return found;
  }

  function choosePattern(value: Sequence): void {
    patternId = value.id;
    refresh();

    if (playing && playMode === "pattern") {
      restart();
    }
  }

  function show(value: View): void {
    if (current === value) {
      panels[value].redraw();
      return;
    }

    fades[current].set(0);
    panels[current].view.eventMode = "none";
    current = value;
    panels[value].view.eventMode = "passive";
    fades[value].snap(0);
    fades[value].set(1);
    refresh();
  }

  function snapshot(): string {
    return JSON.stringify(score());
  }

  function record(): void {
    const now: number = performance.now();

    if (now - lastRecord < recordGap) {
      lastRecord = now;
      return;
    }

    lastRecord = now;
    undoList.push(snapshot());
    redoList.length = 0;

    if (undoList.length > historyMost) {
      undoList.shift();
    }
  }

  function travel(from: Array<string>, to: Array<string>): void {
    const state: string | undefined = from.pop();

    if (state === undefined || sound === null) {
      return;
    }

    to.push(snapshot());
    sound.score = JSON.parse(state) as Score;
    lastRecord = 0;
    edited();
    refresh();
  }

  function edited(): void {
    fitPattern(score(), pattern());
    changed();
    describe();

    if (!playing) {
      return;
    }

    if (restartTimer !== null) {
      window.clearTimeout(restartTimer);
    }

    restartTimer = window.setTimeout(() => {
      restartTimer = null;

      if (playing) {
        restart();
      }
    }, restartDelay);
  }

  function describe(): void {
    const value: Score = score();
    const bars: number = songBars(value);

    title.text = sound!.name.toUpperCase();
    tempo.text = value.tempo + " BPM";
    info.text =
      keyNames[value.key] +
      " MINOR  ·  SONG " +
      bars +
      (bars === 1 ? " BAR" : " BARS") +
      "  ·  " +
      value.channels.length +
      " CHANNELS  ·  " +
      value.patterns.length +
      " PATTERNS";
  }

  function paintButtons(): void {
    for (const button of viewButtons) {
      button.paint();
    }

    patternMode.paint();
    songMode.paint();
    play.paint();
    patternButton.label.text = pattern().name.toUpperCase().slice(0, 16);
    deleteButton.view.alpha = score().patterns.length > 1 ? 1 : 0.4;
    patternBar.visible = current !== "mixer";
  }

  function refresh(): void {
    if (sound === null) {
      return;
    }

    pattern();
    channel();
    describe();
    paintButtons();
    hint.text = hints[current];
    panels[current].redraw();
  }

  function cyclePattern(direction: number): void {
    const list: Array<Sequence> = score().patterns;

    choosePattern(
      list[(list.indexOf(pattern()) + direction + list.length) % list.length]!,
    );
  }

  function renamePattern(): void {
    const target: Sequence = pattern();

    rename(target.name, (name: string) => {
      record();
      target.name = name;
      edited();
      refresh();
    });
  }

  function newPattern(): void {
    record();

    const created: Sequence | null = addPattern(score());

    if (created !== null) {
      choosePattern(created);
      edited();
    }
  }

  function copyPattern(): void {
    record();

    const created: Sequence | null = clonePattern(score(), pattern());

    if (created !== null) {
      choosePattern(created);
      edited();
    }
  }

  function deletePattern(): void {
    const list: Array<Sequence> = score().patterns;

    if (list.length <= 1) {
      return;
    }

    const index: number = list.indexOf(pattern());

    record();
    removePattern(score(), pattern().id);
    patternId =
      score().patterns[Math.min(index, score().patterns.length - 1)]!.id;
    edited();
    refresh();
  }

  function playedScore(): Score {
    return playMode === "pattern" ? soloScore(score(), pattern()) : score();
  }

  function loop(offset: number): void {
    const currentToken: number = ++token;

    track = playTrack(
      { ...sound!, score: playedScore() },
      (played: boolean) => {
        if (played && playing && currentToken === token) {
          loop(0);
        }
      },
      offset,
    );
  }

  function restart(): void {
    const length: number = scoreLength(playedScore());
    const position: number = track?.position() ?? 0;

    track?.stop();
    playMode = mode;
    loop(playMode === "pattern" ? 0 : position % length);
  }

  function togglePlaying(): void {
    if (playing) {
      stopPlaying();
    } else {
      playing = true;
      playMode = mode;
      loop(0);
    }

    paintButtons();
  }

  function chooseMode(value: Mode): void {
    if (mode === value) {
      return;
    }

    mode = value;

    if (playing) {
      token++;
      track?.stop();
      playMode = mode;
      loop(0);
    }

    paintButtons();
  }

  function stopPlaying(): void {
    playing = false;
    token++;
    track?.stop();
    track = null;

    if (restartTimer !== null) {
      window.clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function playhead(wanted: Mode): number | null {
    if (!playing || track === null || sound === null || wanted !== playMode) {
      return null;
    }

    const played: Score = playedScore();

    return (track.position() % scoreLength(played)) / stepLength(played);
  }

  function open(value: Sound): void {
    stopPreview();
    sound = value;
    patternId = "";
    channelId = "";
    undoList.length = 0;
    redoList.length = 0;
    lastRecord = 0;

    for (const [name] of viewNames) {
      fades[name].snap(name === current ? 1 : 0);
      panels[name].view.eventMode = name === current ? "passive" : "none";
    }

    refresh();
    view.eventMode = "passive";
    amount.set(1);
  }

  function close(): void {
    if (sound === null) {
      return;
    }

    stopPlaying();
    paintButtons();
    sound = null;
    view.eventMode = "none";
    amount.set(0);
    closed();
  }

  function band(top: number, bottom: number, color: string): void {
    backdrop
      .rect(
        0,
        board.y + top * boardScale,
        app.screen.width,
        (bottom - top) * boardScale,
      )
      .fill(color);
  }

  function layout(scale: number): void {
    boardScale = scale;
    board.scale.set(scale);
    board.position.set(
      Math.round(app.screen.width / 2 - (hudWidth * scale) / 2),
      Math.round(app.screen.height / 2 - (hudHeight * scale) / 2),
    );
    backdrop
      .clear()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill(windowColor);
    band(-hudHeight, bandBottom, toolbarColor);
    band(areaBottom + 4, hudHeight * 2, toolbarColor);
    backdrop
      .rect(0, board.y + bandBottom * scale, app.screen.width, 1)
      .fill("#1a2125");
    sharpen(board, screenResolution(scale));
  }

  title.position.set(areaLeft, titleY - titleSize / 2);
  info.position.set(areaLeft, infoY - infoSize / 2);
  (
    [
      [patternMode, modeWidth],
      [songMode, modeWidth],
      [play, playWidth],
      [stop, stopWidth],
    ] as Array<[Button, number]>
  ).reduce(
    (x: number, [button, width]: [Button, number]) => {
      button.view.position.set(x, transportY - buttonHeight / 2);

      return x + width + buttonGap;
    },
    areaRight -
      doneWidth -
      tempoWidth -
      (modeWidth * 2 + playWidth + stopWidth + buttonGap * 5),
  );
  tempo.anchor.set(0.5);
  tempo.position.set(
    areaRight - doneWidth - buttonGap - tempoWidth / 2,
    transportY,
  );
  done.view.position.set(areaRight - doneWidth, transportY - buttonHeight / 2);
  viewButtons.reduce((x: number, button: Button, index: number) => {
    button.view.position.set(x, toolbarY - buttonHeight / 2);

    return x + viewNames[index]![2] + buttonGap;
  }, areaLeft);
  (
    [
      [previous, arrowWidth],
      [patternButton, patternWidth],
      [next, arrowWidth],
      [newButton, newWidth],
      [cloneButton, cloneWidth],
      [deleteButton, deleteWidth],
    ] as Array<[Button, number]>
  ).reduce((x: number, [button, width]: [Button, number]) => {
    button.view.x = x;
    patternBar.addChild(button.view);

    return x + width + buttonGap;
  }, areaLeft);
  patternBar.y = patternY - buttonHeight / 2;
  hint.position.set(areaLeft, hintY);
  keys.position.set(areaLeft, hintY + hintGap);
  keys.text = keysHint;
  board.addChild(
    title,
    info,
    tempo,
    ...viewButtons.map((button: Button) => button.view),
    patternMode.view,
    songMode.view,
    play.view,
    stop.view,
    done.view,
    patternBar,
    panels.playlist.view,
    panels.rack.view,
    panels.roll.view,
    panels.mixer.view,
    hint,
    keys,
    overlay,
  );
  backdrop.eventMode = "static";
  view.addChild(backdrop, board);
  view.eventMode = "none";
  amount.snap(0);

  app.ticker.add(() => {
    if (sound !== null) {
      panels[current].tick();
    }
  });

  app.canvas.addEventListener("contextmenu", (event: MouseEvent) => {
    if (sound !== null) {
      event.preventDefault();
    }
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (
      sound === null ||
      event.altKey ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const command: boolean = event.ctrlKey || event.metaKey;
    const found: [View, string, number, string] | undefined = viewNames.find(
      (entry: [View, string, number, string]) => entry[3] === event.code,
    );

    if (command && event.code === "KeyZ") {
      travel(
        event.shiftKey ? redoList : undoList,
        event.shiftKey ? undoList : redoList,
      );
    } else if (command && event.code === "KeyY") {
      travel(redoList, undoList);
    } else if (panels[current].key(event)) {
      paintButtons();
    } else if (command) {
      return;
    } else if (event.code === "Space") {
      togglePlaying();
    } else if (event.code === "KeyL") {
      chooseMode(mode === "song" ? "pattern" : "song");
    } else if (found !== undefined) {
      show(found[0]);
    } else {
      return;
    }

    event.preventDefault();
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
