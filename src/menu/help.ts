import {
  CanvasTextMetrics,
  Container,
  Graphics,
  Text,
  type Application,
  type TextStyle,
} from "pixi.js";
import { getTheme } from "../theme/theme";
import { animate, createGlide, type Glide } from "../ui/motion";
import { createText, screenResolution, sharpen } from "../ui/text";
import { bindingName } from "../game/input";
import { playSound } from "../create/sound";
import type { Sound } from "../create/types";
import { createMascot, mascotName, type Mascot } from "./mascot";
import { lessonFor } from "./lessons";

type Topic =
  "menu" | "play" | "customise" | "gallery" | "editor" | "config" | "stats";

function playRows(): Array<[string, string]> {
  const names: Array<string> = [
    bindingName("up"),
    bindingName("left"),
    bindingName("down"),
    bindingName("right"),
  ];
  const move: string = names.join(
    names.every((name: string) => name.length === 1) ? "" : " ",
  );

  return [
    ["Arrows / " + move, "Move"],
    [bindingName("shot"), "Shoot"],
    [bindingName("bomb"), "Bomb"],
    [bindingName("focus"), "Focus and show your hitbox"],
    ...topics.get("play")!.slice(4),
  ];
}

type Help = {
  view: Container;
  open: (topic: Topic, subject: string) => void;
  close: () => void;
  shown: () => boolean;
  key: (event: KeyboardEvent) => boolean;
};

type Lesson = {
  text: string;
  rows: Array<[string, string]> | null;
};

const topics: Map<Topic, Array<[string, string]>> = new Map([
  [
    "menu",
    [
      ["Arrows / WASD", "Move between buttons"],
      ["Enter / Space", "Choose"],
      ["Esc", "Back to the title"],
      ["Alt + R", "Reset everything"],
      ["Alt + P", "Go to any menu"],
      ["Alt + H", "Ask Plip about this screen"],
      ["F7", "Mute or unmute"],
      ["Alt + Enter", "Fullscreen"],
      ["F8", "Save a screenshot"],
    ],
  ],
  [
    "play",
    [
      ["Arrows", "Move"],
      ["Z", "Shoot"],
      ["X", "Bomb"],
      ["Shift", "Focus and show your hitbox"],
      ["Esc", "Pause"],
      ["R", "Retry from the results screen"],
      ["Ctrl + C", "Copy your result"],
      ["F", "Favourite a custom entry"],
      ["N", "Next sky in Zen"],
      [",  P  .", "Previous, pause and next song in Zen"],
      ["/  or  Ctrl + F", "Search a stage list"],
      ["F7", "Mute or unmute"],
      ["Alt + Enter", "Fullscreen"],
      ["F8", "Save a screenshot"],
    ],
  ],
  [
    "customise",
    [
      ["B / E / F / I", "Pencil, eraser, fill, picker"],
      ["L / R / O", "Line, rectangle, oval"],
      ["H", "Flip drawing"],
      ["Arrows", "Nudge drawing"],
      ["Drop an image", "Import it into the drawing"],
      ["M", "Mirror drawing"],
      ["G", "Toggle grid"],
      ["C  /  click ink", "Colour mixer"],
      ["1 - 4", "Switch drawing"],
      ["Ctrl + Z", "Undo"],
      ["Ctrl + Y", "Redo"],
      ["Esc", "Back"],
    ],
  ],
  [
    "gallery",
    [
      ["Arrows / WASD", "Browse cards"],
      ["Enter / Space", "Open a card"],
      ["1 - 4", "Switch category"],
      ["/  or  Ctrl + F", "Search by name"],
      ["F2  /  Delete", "Rename or delete card"],
      ["Ctrl + D  /  Ctrl + E", "Duplicate or export card"],
      ["Drop a file", "Import a card"],
      ["Esc", "Back"],
    ],
  ],
  [
    "editor",
    [
      ["P", "Playtest"],
      ["Shift + P", "Watch the autopilot play"],
      ["Space", "Play or pause the preview"],
      ["Ctrl + Z", "Undo"],
      ["Ctrl + Shift + Z / Ctrl + Y", "Redo"],
      ["Ctrl + C / Ctrl + Shift + C", "Copy enemy / keyframe"],
      ["Ctrl + V", "Paste"],
      ["Ctrl + D", "Duplicate enemy"],
      ["Ctrl + Shift + D", "Mirrored copy of enemy"],
      ["Drop an image", "Use it as the sprite"],
      ["Esc", "Back to your cards"],
    ],
  ],
  [
    "stats",
    [
      ["Left / Right", "Browse achievements"],
      ["R", "Reset stats and achievements"],
      ["Esc", "Back"],
    ],
  ],
  [
    "config",
    [
      ["Up / Down", "Move between settings"],
      ["Left / Right", "Change a setting"],
      ["Q / E", "Previous or next section"],
      ["1 - 9", "Jump to a section"],
      ["Esc", "Back"],
    ],
  ],
]);

const bubbleWidth: number = 640; // px
const bubbleLeft: number = -190; // px
const bubbleBottom: number = 210; // px
const bubblePadding: number = 36; // px
const bubbleSlant: number = 22; // px
const tailRise: number = 70; // px
const tailReach: number = 46; // px
const tailWidth: number = 14; // px
const nameSize: number = 24; // px
const nameGap: number = 40; // px
const bodySize: number = 26; // px
const lineHeight: number = 34; // px
const keySize: number = 22; // px
const actionSize: number = 20; // px
const rowGap: number = 34; // px
const rowsGap: number = 22; // px
const columnGap: number = 30; // px
const footerGap: number = 46; // px
const hintSize: number = 15; // px
const dotSize: number = 5; // px
const dotGap: number = 16; // px
const mascotX: number = -345; // px
const mascotY: number = 130; // px
const mascotRise: number = 70; // px
const shadeAlpha: number = 0.55;
const panelAlpha: number = 0.92;
const helpReference: number = 1000; // px
const riseDistance: number = 24; // px
const helpSmoothing: number = 0.1; // s
const heightSmoothing: number = 0.08; // s
const typeRate: number = 60; // letters/s
const stopPause: number = 0.22; // s
const commaPause: number = 0.08; // s
const blipEvery: number = 3;
const blipSpread: number = 0.12;
const controlsLine: string = "Here are the keys for this screen.";

function createHelp(app: Application, voice: Sound | null): Help {
  const view: Container = new Container();
  const shade: Graphics = new Graphics();
  const panel: Container = new Container();
  const bubble: Container = new Container();
  const back: Graphics = new Graphics();
  const dots: Graphics = new Graphics();
  const name: Text = createText(nameSize, getTheme().accent);
  const body: Text = createText(bodySize, "#ffffff");
  const rows: Container = new Container();
  const hint: Text = createText(hintSize, "#9fd8ff");
  const mascot: Mascot = createMascot();
  const shown: Glide = createGlide(0, place, helpSmoothing);
  const height: Glide = createGlide(0, shape, heightSmoothing);
  const rowsShown: Glide = createGlide(0, (value: number) => {
    rows.alpha = value;
  });
  let lessons: Array<Lesson> = new Array();
  let page: number = 0;
  let full: string = "";
  let typed: number = 0;
  let wait: number = 0;
  let letters: number = 0;
  let isOpen: boolean = false;
  let running: boolean = false;
  let textScale: number = 0;

  function place(value: number): void {
    view.alpha = value;
    view.visible = value > 0;
    panel.y = app.screen.height / 2 + riseDistance * (1 - value);
    mascot.view.y = mascotY + mascotRise * (1 - value);
  }

  function edgeX(y: number, top: number): number {
    return (
      bubbleLeft + (bubbleSlant * (bubbleBottom - y)) / (bubbleBottom - top)
    );
  }

  function shape(value: number): void {
    const top: number = bubbleBottom - value;
    const right: number = bubbleLeft + bubbleWidth;
    const tail: number = bubbleBottom - tailRise;

    back
      .clear()
      .poly([
        bubbleLeft,
        bubbleBottom,
        edgeX(tail + tailWidth, top),
        tail + tailWidth,
        bubbleLeft - tailReach,
        tail + tailWidth * 1.6,
        edgeX(tail - tailWidth, top),
        tail - tailWidth,
        bubbleLeft + bubbleSlant,
        top,
        right + bubbleSlant,
        top,
        right,
        bubbleBottom,
      ])
      .fill({ color: "#01040f", alpha: panelAlpha })
      .stroke({ color: getTheme().highlight, width: 2, join: "round" });
    name.position.set(
      bubbleLeft + bubblePadding + bubbleSlant,
      top + bubblePadding,
    );
    body.position.set(
      bubbleLeft + bubblePadding + bubbleSlant / 2,
      top + bubblePadding + nameGap,
    );
    rows.y = body.y + bodyHeight() + rowsGap;
  }

  function bodyHeight(): number {
    return full.split("\n").length * lineHeight;
  }

  function wrap(text: string): string {
    const style: TextStyle = body.style.clone();

    style.wordWrap = true;
    style.wordWrapWidth = bubbleWidth - bubblePadding * 2 - bubbleSlant;

    return CanvasTextMetrics.measureText(text, style).lines.join("\n");
  }

  function buildRows(list: Array<[string, string]>): void {
    const keys: Array<Text> = new Array();
    const actions: Array<Text> = new Array();

    for (const child of rows.removeChildren()) {
      child.destroy();
    }

    for (let index = 0; index < list.length; index++) {
      const [keyLabel, action] = list[index]!;
      const key: Text = createText(keySize, getTheme().accent);
      const text: Text = createText(actionSize, "#ffffff");

      key.text = keyLabel.toUpperCase();
      key.anchor.set(1, 0);
      key.y = index * rowGap;
      text.text = action;
      text.anchor.set(0, 0);
      text.y = index * rowGap + (keySize - actionSize) / 2;
      keys.push(key);
      actions.push(text);
      rows.addChild(key, text);
    }

    const keyWidth: number = Math.max(...keys.map((key: Text) => key.width));

    for (const key of keys) {
      key.x = bubbleLeft + bubblePadding + bubbleSlant / 2 + keyWidth;
    }

    for (const text of actions) {
      text.x =
        bubbleLeft + bubblePadding + bubbleSlant / 2 + keyWidth + columnGap;
    }
  }

  function paintDots(): void {
    const right: number = bubbleLeft + bubbleWidth - bubblePadding;

    dots.clear();

    for (let index = 0; index < lessons.length; index++) {
      const x: number = right - (lessons.length - 1 - index) * dotGap;

      dots
        .poly([x, -dotSize, x + dotSize, 0, x, dotSize, x - dotSize, 0])
        .fill({
          color: index === page ? getTheme().accent : "#ffffff",
          alpha: index === page ? 1 : 0.35,
        });
    }
  }

  function show(index: number): void {
    const lesson: Lesson = lessons[index]!;

    page = index;
    full = wrap(lesson.text);
    typed = 0;
    wait = 0;
    letters = 0;
    body.text = "";
    rows.visible = lesson.rows !== null;
    rowsShown.snap(0);

    if (lesson.rows !== null) {
      buildRows(lesson.rows);
    }

    mascot.setMood(index === 0 || lesson.rows !== null ? "happy" : "calm");
    mascot.hop();
    paintDots();
    height.set(
      bubblePadding * 2 +
        nameGap +
        bodyHeight() +
        (lesson.rows !== null ? rowsGap + lesson.rows.length * rowGap : 0) +
        footerGap,
    );
    textScale = 0;
    layout();
  }

  function blip(): void {
    if (voice === null) {
      return;
    }

    const factor: number = 1 + (Math.random() * 2 - 1) * blipSpread;

    playSound({
      ...voice,
      pitch: voice.pitch * factor,
      slide: voice.slide * factor,
    });
  }

  function typing(): boolean {
    return typed < full.length;
  }

  function step(delta: number): boolean {
    mascot.update(delta);

    if (typing()) {
      wait -= delta;

      while (wait <= 0 && typing()) {
        const letter: string = full[Math.floor(typed)] ?? "";

        typed++;
        wait += 1 / typeRate;

        if (/[a-z0-9]/i.test(letter) && letters++ % blipEvery === 0) {
          blip();
        }

        if (".!?".includes(letter)) {
          wait += stopPause;
        } else if (letter === ",") {
          wait += commaPause;
        }
      }

      body.text = full.slice(0, Math.floor(typed));

      if (!typing()) {
        rowsShown.set(1);
      }
    }

    mascot.setTalking(typing());
    running = isOpen || shown.value() > 0;

    return running;
  }

  function finish(): void {
    typed = full.length;
    body.text = full;
    rowsShown.set(1);
  }

  function layout(): void {
    const scale: number = Math.min(
      app.screen.height / helpReference,
      app.screen.width / helpReference,
      1.4,
    );

    shade
      .clear()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: "#000000", alpha: shadeAlpha });
    panel.scale.set(scale);
    panel.x = app.screen.width / 2;
    place(shown.value());

    if (scale !== textScale) {
      textScale = scale;
      sharpen(panel, screenResolution(scale));
    }
  }

  function advance(): void {
    if (typing()) {
      finish();
    } else if (page < lessons.length - 1) {
      show(page + 1);
    } else {
      close();
    }
  }

  function open(topic: Topic, subject: string): void {
    const controls: Array<[string, string]> =
      topic === "play" ? playRows() : topics.get(topic)!;

    lessons = [
      ...lessonFor(subject).map((text: string) => ({ text: text, rows: null })),
      { text: controlsLine, rows: controls },
    ];
    isOpen = true;
    name.text = mascotName;
    name.style.fill = getTheme().accent;
    mascot.paint();
    mascot.wave();
    height.snap(0);
    show(0);
    shown.set(1);

    if (!running) {
      running = true;
      animate(step);
    }
  }

  function close(): void {
    isOpen = false;
    mascot.setTalking(false);
    shown.set(0);
  }

  function key(event: KeyboardEvent): boolean {
    if (event.code === "F7" || event.code === "F8" || event.altKey) {
      return false;
    }

    if (event.repeat) {
      return true;
    }

    if (
      event.code === "Enter" ||
      event.code === "NumpadEnter" ||
      event.code === "Space" ||
      event.code === "ArrowRight" ||
      event.code === "KeyD"
    ) {
      advance();
    } else if (
      (event.code === "ArrowLeft" ||
        event.code === "KeyA" ||
        event.code === "Backspace") &&
      page > 0
    ) {
      show(page - 1);
    } else if (event.code === "Tab") {
      show(page === lessons.length - 1 ? 0 : lessons.length - 1);
    }

    return true;
  }

  hint.text = "ENTER  NEXT    LEFT  BACK    TAB  KEYS    ESC  CLOSE";
  hint.anchor.set(0, 0.5);
  hint.position.set(bubbleLeft + bubblePadding, bubbleBottom - bubblePadding);
  dots.y = bubbleBottom - bubblePadding;
  mascot.view.x = mascotX;
  bubble.addChild(back, name, body, rows, hint, dots);
  panel.addChild(mascot.view, bubble);
  view.addChild(shade, panel);
  view.visible = false;
  view.alpha = 0;
  view.eventMode = "static";
  view.on("pointertap", advance);
  app.renderer.on("resize", layout);

  return {
    view: view,
    open: open,
    close: close,
    shown: () => isOpen,
    key: key,
  };
}

export { createHelp };
export type { Help, Topic };
