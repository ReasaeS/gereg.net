import {
  createId,
  defaultCharacter,
  defaultEmotion,
  type Character,
  type Cutscene,
  type Emotion,
  type Line,
} from "./data";
import { feelingOf, speakerOf } from "./cutscene";
import { fontFamily } from "./widgets";
import { getTheme } from "../theme/theme";

type Parsed = {
  name: string;
  emotion: string | null;
  text: string;
};

const scriptLine: RegExp =
  /^\s*([^():]+?)\s*(?:\(\s*([^()]*?)\s*\))?\s*:\s*(.*)$/;
const textLength: number = 240;
const panelColor: string = "#01040f";
const panelBorder: string = "rgba(255, 255, 255, 0.85)";
const errorColor: string = "#ff8a80";
const hintColor: string = "rgba(255, 255, 255, 0.55)";

function cleanName(value: string): string {
  return value.replace(/[():]/g, "").trim();
}

function same(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

function formatTranscript(cutscene: Cutscene, cast: Array<Character>): string {
  return cutscene.lines
    .map((line: Line) => {
      const speaker: Character | null = speakerOf(cast, line);
      const feeling: Emotion | null =
        speaker === null ? null : feelingOf(speaker, line);

      return (
        (speaker?.name ?? "Nobody") +
        (feeling === null ? "" : " (" + feeling.name + ")") +
        ": " +
        line.text
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

    parsed.push({
      name: match[1]!,
      emotion: match[2] === undefined || match[2] === "" ? null : match[2],
      text: match[3]!.trim().slice(0, textLength),
    });
  }

  return parsed.length === 0
    ? "The transcript needs at least one line"
    : parsed;
}

function applyTranscript(
  cutscene: Cutscene,
  cast: Array<Character>,
  text: string,
): string | null {
  const parsed: Array<Parsed> | string = readTranscript(text);

  if (typeof parsed === "string") {
    return parsed;
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

    return {
      id: createId(),
      character: speaker.id,
      emotion: feeling.id,
      text: entry.text,
    };
  });

  return null;
}

function style(
  element: HTMLElement,
  rules: Partial<CSSStyleDeclaration>,
): void {
  Object.assign(element.style, rules);
}

function editTranscript(
  initial: string,
  apply: (text: string) => string | null,
): void {
  const shade: HTMLDivElement = document.createElement("div");
  const panel: HTMLDivElement = document.createElement("div");
  const title: HTMLDivElement = document.createElement("div");
  const hint: HTMLDivElement = document.createElement("div");
  const area: HTMLTextAreaElement = document.createElement("textarea");
  const error: HTMLDivElement = document.createElement("div");
  const buttons: HTMLDivElement = document.createElement("div");
  const cancel: HTMLButtonElement = document.createElement("button");
  const save: HTMLButtonElement = document.createElement("button");
  const font: string = fontFamily
    .map((name: string) => '"' + name + '"')
    .join(", ");

  function close(): void {
    shade.remove();
  }

  function submit(): void {
    const problem: string | null = apply(area.value);

    if (problem === null) {
      close();
      return;
    }

    error.textContent = problem;
  }

  style(shade, {
    position: "fixed",
    inset: "0",
    background: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "10",
  });
  style(panel, {
    width: "min(720px, calc(100vw - 32px))",
    height: "min(560px, calc(100vh - 32px))",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "18px",
    boxSizing: "border-box",
    background: panelColor,
    border: "2px solid " + panelBorder,
    fontFamily: font,
    color: "#ffffff",
  });
  style(title, {
    fontSize: "22px",
    fontStyle: "italic",
    fontWeight: "900",
    letterSpacing: "0.04em",
  });
  style(hint, { fontSize: "14px", color: hintColor });
  style(area, {
    flex: "1",
    resize: "none",
    padding: "12px",
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    outline: "none",
    color: "#ffffff",
    fontFamily: "ui-monospace, monospace",
    fontSize: "15px",
    lineHeight: "1.6",
    whiteSpace: "pre",
  });
  style(error, { minHeight: "18px", fontSize: "14px", color: errorColor });
  style(buttons, { display: "flex", justifyContent: "flex-end", gap: "10px" });

  for (const [button, accent] of [
    [cancel, false],
    [save, true],
  ] as Array<[HTMLButtonElement, boolean]>) {
    style(button, {
      padding: "6px 18px",
      background: accent ? getTheme().accent : "transparent",
      border: "1px solid " + (accent ? getTheme().accent : panelBorder),
      color: "#ffffff",
      fontFamily: font,
      fontSize: "16px",
      fontStyle: "italic",
      fontWeight: "900",
      cursor: "pointer",
    });
  }

  title.textContent = "TRANSCRIPT";
  hint.textContent =
    "One line each:  Name (Emotion): what they say.  The emotion can be left out. New names and emotions are added automatically.  Ctrl + Enter saves, Escape cancels.";
  area.value = initial;
  area.spellcheck = false;
  cancel.textContent = "CANCEL";
  save.textContent = "SAVE";
  cancel.addEventListener("click", close);
  save.addEventListener("click", submit);
  area.addEventListener("input", () => {
    error.textContent = "";
  });
  shade.addEventListener("keydown", (event: KeyboardEvent) => {
    event.stopPropagation();

    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    }
  });

  buttons.append(cancel, save);
  panel.append(title, hint, area, error, buttons);
  shade.append(panel);
  document.body.append(shade);
  area.focus();
}

export { cleanName, formatTranscript, applyTranscript, editTranscript };
