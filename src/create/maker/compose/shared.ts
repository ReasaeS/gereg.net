import type { Container } from "pixi.js";
import type { Channel, Note, Score, Sequence } from "../../types";

type View = "playlist" | "rack" | "roll" | "mixer";

type Mode = "pattern" | "song";

type Session = {
  score: () => Score;
  pattern: () => Sequence;
  channel: () => Channel | null;
  choosePattern: (pattern: Sequence) => void;
  chooseChannel: (channel: Channel) => void;
  show: (view: View) => void;
  record: () => void;
  edited: () => void;
  refresh: () => void;
  write: (initial: string, apply: (text: string) => string | null) => void;
  playhead: (mode: Mode) => number | null;
  overlay: () => Container;
  hear: (channel: Channel, note: Note) => void;
};

type Panel = {
  view: Container;
  redraw: () => void;
  tick: () => void;
  key: (event: KeyboardEvent) => boolean;
};

const areaLeft: number = 32; // units
const areaRight: number = 608; // units
const areaTop: number = 100; // units
const areaBottom: number = 440; // units
const areaWidth: number = areaRight - areaLeft; // units
const areaHeight: number = areaBottom - areaTop; // units
const textSize: number = 9; // units
const smallSize: number = 8; // units
const labelSize: number = 10; // units
const clipSize: number = 9; // units
const windowColor: string = "#262e33";
const toolbarColor: string = "#3a454b";
const panelColor: string = "#323c42";
const stripColor: string = "#3b464c";
const textColor: string = "#c9d3d8";
const dimColor: string = "#88959b";
const accentColor: string = "#ff9b3c";
const ledColor: string = "#9be564";
const ledOff: string = "#3b4a3a";
const whiteRow: string = "#34434a";
const blackRow: string = "#2b383e";
const scaleRow: string = "#3a4d55";
const barLine: string = "#1a2226";
const beatLine: string = "#283338";
const stepLine: string = "#303d43";
const whiteKey: string = "#e3e7e9";
const blackKey: string = "#1c2226";
const noteColor: string = "#86e5a0";
const noteEdge: string = "#2f6a43";
const selectedColor: string = "#ff8f8f";
const selectedEdge: string = "#8a2f2f";
const noteText: string = "#16301f";
const stepGroups: Array<string> = ["#5b666c", "#6c565b"];
const stepOn: string = "#e6ecee";
const hoverAlpha: number = 0.12;
const playheadColor: string = "#ffffff";
const mutedAlpha: number = 0.35;
const patternColors: Array<string> = [
  "#7d9fd6",
  "#d67d9a",
  "#7dd69a",
  "#d6c27d",
  "#a87dd6",
  "#d6977d",
  "#7dcbd6",
  "#c47dd6",
];
const pitchNames: Array<string> = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function patternColor(score: Score, pattern: Sequence): string {
  return patternColors[score.patterns.indexOf(pattern) % patternColors.length]!;
}

function pitchName(pitch: number): string {
  return pitchNames[pitch % 12]! + (Math.floor(pitch / 12) - 1);
}

function isBlack(pitch: number): boolean {
  return pitchNames[pitch % 12]!.includes("#");
}

function inScale(score: Score, pitch: number, steps: Array<number>): boolean {
  return steps.includes((((pitch - 57 - score.key) % 12) + 12) % 12);
}

function rename(current: string, apply: (name: string) => void): void {
  const typed: string | null = window.prompt("Name", current);

  if (typed !== null && typed.trim() !== "") {
    apply(typed.trim());
  }
}

export {
  areaLeft,
  areaRight,
  areaTop,
  areaBottom,
  areaWidth,
  areaHeight,
  textSize,
  smallSize,
  labelSize,
  clipSize,
  windowColor,
  toolbarColor,
  panelColor,
  stripColor,
  textColor,
  dimColor,
  accentColor,
  ledColor,
  ledOff,
  whiteRow,
  blackRow,
  scaleRow,
  barLine,
  beatLine,
  stepLine,
  whiteKey,
  blackKey,
  noteColor,
  noteEdge,
  selectedColor,
  selectedEdge,
  noteText,
  stepGroups,
  stepOn,
  hoverAlpha,
  playheadColor,
  mutedAlpha,
  patternColor,
  pitchName,
  isBlack,
  inScale,
  rename,
};
export type { View, Mode, Session, Panel };
