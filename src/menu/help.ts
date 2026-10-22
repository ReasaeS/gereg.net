import { Container, Graphics, Text, type Application } from "pixi.js";
import { getTheme } from "../theme/theme";
import { createGlide, type Glide } from "../ui/motion";
import {
  createShadowText,
  createText,
  screenResolution,
  sharpen,
} from "../ui/text";
import { bindingName } from "../game/input";

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
  toggle: (topic: Topic | null) => void;
  shown: () => boolean;
};

const topics: Map<Topic, Array<[string, string]>> = new Map([
  [
    "menu",
    [
      ["Arrows / WASD", "Move between buttons"],
      ["Enter / Space", "Choose"],
      ["Esc", "Back to the title"],
      ["Alt + R", "Reset everything"],
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
      ["1 - 6", "Switch drawing"],
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

const titleSize: number = 44; // px
const keySize: number = 22; // px
const actionSize: number = 20; // px
const rowGap: number = 38; // px
const columnGap: number = 36; // px
const panelPadding: number = 44; // px
const titleGap: number = 70; // px
const hintGap: number = 30; // px
const hintSize: number = 15; // px
const panelSlant: number = 22; // px
const shadeAlpha: number = 0.55;
const panelAlpha: number = 0.92;
const helpReference: number = 1000; // px
const riseDistance: number = 30; // px
const helpSmoothing: number = 0.1; // s

function createHelp(app: Application): Help {
  const view: Container = new Container();
  const shade: Graphics = new Graphics();
  const panel: Container = new Container();
  const back: Graphics = new Graphics();
  const lines: Container = new Container();
  const title: Text = createShadowText(
    "CONTROLS",
    titleSize,
    "#ffffff",
    "#020b30",
    5,
  );
  const hint: Text = createText(hintSize, "#9fd8ff");
  const shown: Glide = createGlide(0, place, helpSmoothing);
  let open: boolean = false;
  let textScale: number = 0;

  function place(value: number): void {
    view.alpha = value;
    view.visible = value > 0;
    panel.y = app.screen.height / 2 + riseDistance * (1 - value);
  }

  function build(topic: Topic): void {
    const rows: Array<[string, string]> =
      topic === "play" ? playRows() : topics.get(topic)!;
    const keys: Array<Text> = new Array();
    const actions: Array<Text> = new Array();

    for (const child of lines.removeChildren()) {
      child.destroy();
    }

    for (let index = 0; index < rows.length; index++) {
      const [keyLabel, action] = rows[index]!;
      const key: Text = createText(keySize, getTheme().accent);
      const text: Text = createText(actionSize, "#ffffff");

      key.text = keyLabel.toUpperCase();
      key.anchor.set(1, 0.5);
      key.y = index * rowGap;
      text.text = action;
      text.anchor.set(0, 0.5);
      text.y = index * rowGap;
      keys.push(key);
      actions.push(text);
      lines.addChild(key, text);
    }

    const keyWidth: number = Math.max(...keys.map((key: Text) => key.width));
    const actionWidth: number = Math.max(
      ...actions.map((text: Text) => text.width),
    );
    const width: number =
      Math.max(keyWidth + columnGap + actionWidth, title.width) +
      panelPadding * 2;
    const height: number =
      titleGap + rows.length * rowGap + hintGap + panelPadding * 2;
    const left: number = -width / 2;
    const top: number = -height / 2;

    for (const key of keys) {
      key.x = left + panelPadding + keyWidth;
    }

    for (const text of actions) {
      text.x = left + panelPadding + keyWidth + columnGap;
    }

    lines.y = top + panelPadding + titleGap + rowGap / 2;
    title.position.set(0, top + panelPadding + titleSize / 2);
    hint.position.set(0, -top - panelPadding);
    back
      .clear()
      .poly([
        left + panelSlant,
        top,
        -left,
        top,
        -left - panelSlant,
        -top,
        left,
        -top,
      ])
      .fill({ color: "#01040f", alpha: panelAlpha })
      .stroke({ color: getTheme().highlight, width: 2 });
    textScale = 0;
  }

  function layout(): void {
    const scale: number = Math.min(app.screen.height / helpReference, 1.4);

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

  function toggle(topic: Topic | null): void {
    if (open || topic === null) {
      open = false;
      shown.set(0);
      return;
    }

    open = true;
    build(topic);
    layout();
    shown.set(1);
  }

  title.anchor.set(0.5);
  hint.anchor.set(0.5);
  hint.text = "PRESS ? OR ESC TO CLOSE";
  panel.addChild(back, title, lines, hint);
  view.addChild(shade, panel);
  view.visible = false;
  view.alpha = 0;
  view.eventMode = "static";
  view.on("pointertap", () => toggle(null));
  app.renderer.on("resize", layout);

  return { view: view, toggle: toggle, shown: () => open };
}

export { createHelp };
export type { Help, Topic };
