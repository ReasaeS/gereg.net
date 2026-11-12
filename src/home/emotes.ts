import { Container, Graphics, Text } from "pixi.js";
import { getTheme } from "../theme/theme";
import { createText } from "../ui/text";
import { springStep, type Spring } from "../effects/tween/tween";

type Emote =
  | "smile"
  | "laugh"
  | "heart"
  | "star"
  | "note"
  | "drop"
  | "question"
  | "exclaim";

type EmoteBubble = {
  view: Container;
  show: (emote: Emote) => void;
  update: (delta: number) => void;
};

const emotes: Array<Emote> = [
  "smile",
  "laugh",
  "heart",
  "star",
  "note",
  "drop",
  "question",
  "exclaim",
];
const inkColor: string = "#020b30";
const faceColor: string = "#ffd34d";
const dropColor: string = "#8fdcff";
const panelColor: string = "#01040f";
const panelAlpha: number = 0.92;
const bubbleSize: number = 66; // units
const bubbleSlant: number = 8; // units
const bubbleTail: number = 16; // units
const iconSize: number = 44; // units
const emoteLife: number = 2.6; // s
const popFrequency: number = 3.2; // Hz
const popDamping: number = 0.45;

function drawFace(graphics: Graphics, radius: number, laughing: boolean): void {
  graphics.circle(0, 0, radius * 0.82).fill(faceColor);

  if (laughing) {
    for (const side of [-1, 1]) {
      graphics
        .moveTo(side * radius * 0.42, -radius * 0.12)
        .quadraticCurveTo(
          side * radius * 0.28,
          -radius * 0.42,
          side * radius * 0.14,
          -radius * 0.12,
        );
    }

    graphics
      .stroke({ color: inkColor, width: radius * 0.1, cap: "round" })
      .moveTo(-radius * 0.42, radius * 0.08)
      .quadraticCurveTo(0, radius * 0.86, radius * 0.42, radius * 0.08)
      .closePath()
      .fill(inkColor);
    return;
  }

  graphics
    .ellipse(-radius * 0.28, -radius * 0.16, radius * 0.09, radius * 0.16)
    .ellipse(radius * 0.28, -radius * 0.16, radius * 0.09, radius * 0.16)
    .fill(inkColor)
    .moveTo(-radius * 0.38, radius * 0.2)
    .quadraticCurveTo(0, radius * 0.62, radius * 0.38, radius * 0.2)
    .stroke({ color: inkColor, width: radius * 0.1, cap: "round" });
}

function drawStar(graphics: Graphics, radius: number): void {
  const points: Array<number> = new Array();

  for (let index = 0; index < 10; index++) {
    const angle: number = -Math.PI / 2 + (index * Math.PI) / 5;
    const reach: number = index % 2 === 0 ? radius * 0.9 : radius * 0.4;

    points.push(
      Math.cos(angle) * reach,
      Math.sin(angle) * reach + radius * 0.06,
    );
  }

  graphics.poly(points).fill(faceColor);
}

function drawEmote(emote: Emote, size: number): Container {
  const radius: number = size / 2;

  if (emote === "question" || emote === "exclaim") {
    const text: Text = createText(size, getTheme().accent);

    text.text = emote === "question" ? "?" : "!";
    text.anchor.set(0.5);

    return text;
  }

  const graphics: Graphics = new Graphics();

  if (emote === "smile" || emote === "laugh") {
    drawFace(graphics, radius, emote === "laugh");
  } else if (emote === "heart") {
    graphics
      .moveTo(0, radius * 0.72)
      .bezierCurveTo(
        -radius * 1.15,
        0,
        -radius * 0.55,
        -radius * 0.9,
        0,
        -radius * 0.36,
      )
      .bezierCurveTo(
        radius * 0.55,
        -radius * 0.9,
        radius * 1.15,
        0,
        0,
        radius * 0.72,
      )
      .fill(getTheme().accent);
  } else if (emote === "star") {
    drawStar(graphics, radius);
  } else if (emote === "note") {
    graphics
      .ellipse(-radius * 0.22, radius * 0.48, radius * 0.3, radius * 0.22)
      .rect(radius * 0.02, -radius * 0.7, radius * 0.13, radius * 1.18)
      .fill("#ffffff")
      .moveTo(radius * 0.1, -radius * 0.66)
      .quadraticCurveTo(
        radius * 0.62,
        -radius * 0.46,
        radius * 0.48,
        -radius * 0.04,
      )
      .stroke({ color: "#ffffff", width: radius * 0.14, cap: "round" });
  } else {
    graphics
      .moveTo(0, -radius * 0.82)
      .quadraticCurveTo(radius * 0.62, 0, radius * 0.55, radius * 0.3)
      .arc(0, radius * 0.3, radius * 0.55, 0, Math.PI)
      .quadraticCurveTo(-radius * 0.62, 0, 0, -radius * 0.82)
      .fill(dropColor)
      .ellipse(-radius * 0.2, radius * 0.28, radius * 0.1, radius * 0.18)
      .fill({ color: "#ffffff", alpha: 0.8 });
  }

  return graphics;
}

function createEmoteBubble(): EmoteBubble {
  const view: Container = new Container();
  const back: Graphics = new Graphics();
  const icons: Map<Emote, Container> = new Map();
  const pop: Spring = { value: 0, velocity: 0 };
  let life: number = 0;
  const half: number = bubbleSize / 2;

  back
    .poly([
      -half + bubbleSlant,
      -bubbleSize - bubbleTail,
      half + bubbleSlant,
      -bubbleSize - bubbleTail,
      half,
      -bubbleTail,
      8,
      -bubbleTail,
      0,
      0,
      -8,
      -bubbleTail,
      -half,
      -bubbleTail,
    ])
    .fill({ color: panelColor, alpha: panelAlpha })
    .stroke({ color: getTheme().highlight, width: 2, join: "round" });
  view.addChild(back);

  for (const emote of emotes) {
    const icon: Container = drawEmote(emote, iconSize);

    icon.position.set(bubbleSlant / 2, -bubbleTail - half);
    icon.visible = false;
    icons.set(emote, icon);
    view.addChild(icon);
  }

  view.visible = false;

  function show(emote: Emote): void {
    for (const [name, icon] of icons) {
      icon.visible = name === emote;
    }

    life = emoteLife;
    pop.value = 0.3;
    pop.velocity = 0;
    view.visible = true;
  }

  function update(delta: number): void {
    if (!view.visible) {
      return;
    }

    life -= delta;
    springStep(pop, life > 0 ? 1 : 0, popFrequency, popDamping, delta);
    view.scale.set(Math.max(pop.value, 0));
    view.alpha = Math.min(Math.max(pop.value, 0), 1);

    if (life <= 0 && pop.value < 0.05) {
      view.visible = false;
    }
  }

  return { view: view, show: show, update: update };
}

export { emotes, drawEmote, createEmoteBubble };
export type { Emote, EmoteBubble };
