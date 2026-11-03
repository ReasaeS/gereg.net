import type { Character, Cutscene, Emotion, Line, Pace, Sound } from "./types";
import { createId, defaultCharacter, defaultEmotion } from "./defaults";
import { feelingOf, speakerOf } from "./cutscene";

type Count = {
  lines: number;
  speakers: number;
};

type Parsed = {
  name: string;
  emotion: string | null;
  text: string;
  focus: boolean;
  sound: string | null;
  paces: Array<Pace>;
};

type Marked = {
  text: string;
  paces: Array<Pace>;
};

const scriptLine: RegExp =
  /^\s*(>)?\s*([^():>]+?)\s*(?:\(\s*([^()]*?)\s*\))?\s*:\s*(.*)$/;
const focusMark: string = "> ";
const soundMark: string = "♪";
const soundPart: RegExp = /^(.*?)\s*♪\s*(.*)$/;
const textLength: number = 240;
const paceMark: RegExp = /\{(\d+):([^{}]*)\}/g;
const lineSpeedMin: number = 5; // chars/s
const lineSpeedMax: number = 120; // chars/s

function cleanName(value: string): string {
  return value.replace(/[():>]/g, "").trim();
}

function same(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

function markText(text: string, paces: Array<Pace>): string {
  let marked: string = "";
  let at: number = 0;

  for (const pace of [...paces].sort(
    (first: Pace, second: Pace) => first.from - second.from,
  )) {
    marked +=
      text.slice(at, pace.from) +
      "{" +
      pace.speed +
      ":" +
      text.slice(pace.from, pace.to) +
      "}";
    at = pace.to;
  }

  return marked + text.slice(at);
}

function readPaces(marked: string): Marked | null {
  const paces: Array<Pace> = new Array();
  let text: string = "";
  let at: number = 0;

  for (const match of marked.matchAll(paceMark)) {
    text += marked.slice(at, match.index);

    const from: number = text.length;

    text += match[2]!;
    paces.push({
      from: from,
      to: text.length,
      speed: Math.min(Math.max(Number(match[1]!), lineSpeedMin), lineSpeedMax),
    });
    at = match.index + match[0].length;
  }

  text += marked.slice(at);

  if (text.includes("{") || text.includes("}")) {
    return null;
  }

  const kept: string = text.trim().slice(0, textLength);
  const lead: number = text.length - text.trimStart().length;

  return {
    text: kept,
    paces: paces
      .map((pace: Pace) => ({
        from: Math.max(pace.from - lead, 0),
        to: Math.min(pace.to - lead, kept.length),
        speed: pace.speed,
      }))
      .filter((pace: Pace) => pace.to > pace.from),
  };
}

function formatTranscript(
  cutscene: Cutscene,
  cast: Array<Character>,
  sounds: Array<Sound>,
): string {
  return cutscene.lines
    .map((line: Line) => {
      const speaker: Character | null = speakerOf(cast, line);
      const feeling: Emotion | null =
        speaker === null ? null : feelingOf(speaker, line);
      const sound: Sound | undefined = sounds.find(
        (value: Sound) => value.id === line.sound,
      );

      return (
        (line.focus === true ? focusMark : "") +
        (speaker?.name ?? "Nobody") +
        (feeling === null ? "" : " (" + feeling.name + ")") +
        ": " +
        markText(line.text, line.paces ?? new Array()) +
        (sound === undefined ? "" : " " + soundMark + " " + sound.name)
      );
    })
    .join("\n");
}

function readTranscript(text: string): Array<Parsed> | string {
  const parsed: Array<Parsed> = new Array();
  const rows: Array<string> = text.split("\n");

  for (let index = 0; index < rows.length; index++) {
    const row: string = rows[index]!;

    if (row.trim() === "") {
      continue;
    }

    const match: RegExpExecArray | null = scriptLine.exec(row);

    if (match === null) {
      return "Line " + (index + 1) + " should look like  Name (Emotion): text";
    }

    const split: RegExpExecArray | null = soundPart.exec(match[4]!);
    const sound: string = split === null ? "" : split[2]!.trim();
    const marked: Marked | null = readPaces(
      split === null ? match[4]! : split[1]!,
    );

    if (marked === null) {
      return "Line " + (index + 1) + " should mark speed like  {40:some text}";
    }

    parsed.push({
      name: match[2]!,
      emotion: match[3] === undefined || match[3] === "" ? null : match[3],
      text: marked.text,
      focus: match[1] !== undefined,
      sound: sound === "" ? null : sound,
      paces: marked.paces,
    });
  }

  return parsed.length === 0
    ? "The transcript needs at least one line"
    : parsed;
}

function applyTranscript(
  cutscene: Cutscene,
  cast: Array<Character>,
  sounds: Array<Sound>,
  text: string,
): string | null {
  const parsed: Array<Parsed> | string = readTranscript(text);

  if (typeof parsed === "string") {
    return parsed;
  }

  const missing: Parsed | undefined = parsed.find(
    (entry: Parsed) =>
      entry.sound !== null &&
      !sounds.some((value: Sound) => same(value.name, entry.sound!)),
  );

  if (missing !== undefined) {
    return 'There is no sound card called "' + missing.sound + '"';
  }

  const lastFeeling: Map<string, string> = new Map();

  cutscene.lines = parsed.map((entry: Parsed) => {
    let speaker: Character | undefined = cast.find((value: Character) =>
      same(value.name, entry.name),
    );

    if (speaker === undefined) {
      speaker = defaultCharacter(entry.name, cast.length);
      cast.push(speaker);
    }

    let feeling: Emotion | undefined =
      entry.emotion === null
        ? speaker.emotions.find(
            (value: Emotion) => value.id === lastFeeling.get(speaker!.id),
          )
        : speaker.emotions.find((value: Emotion) =>
            same(value.name, entry.emotion!),
          );

    if (feeling === undefined && entry.emotion !== null) {
      feeling = defaultEmotion(entry.emotion);
      speaker.emotions.push(feeling);
    }

    feeling = feeling ?? speaker.emotions[0]!;
    lastFeeling.set(speaker.id, feeling.id);

    const sound: Sound | undefined =
      entry.sound === null
        ? undefined
        : sounds.find((value: Sound) => same(value.name, entry.sound!));

    return {
      id: createId(),
      character: speaker.id,
      emotion: feeling.id,
      text: entry.text,
      ...(entry.focus ? { focus: true } : {}),
      ...(sound === undefined ? {} : { sound: sound.id }),
      ...(entry.paces.length === 0 ? {} : { paces: entry.paces }),
    };
  });

  return null;
}

function countTranscript(text: string): Count | null {
  const parsed: Array<Parsed> | string = readTranscript(text);

  if (typeof parsed === "string") {
    return null;
  }

  return {
    lines: parsed.length,
    speakers: new Set(parsed.map((entry: Parsed) => entry.name.toLowerCase()))
      .size,
  };
}

export {
  cleanName,
  formatTranscript,
  applyTranscript,
  countTranscript,
  focusMark,
  soundMark,
  lineSpeedMin,
  lineSpeedMax,
};
export type { Count };
