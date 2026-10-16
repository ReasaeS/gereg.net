import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type Application,
  type Bounds,
  type Point,
} from "pixi.js";
import type { Sound, Vector } from "../types";
import { playSound, playTrack, type Track } from "../sound";
import {
  bombKeys,
  createKeyboard,
  focusKeys,
  shotKeys,
  steering,
  type Keyboard,
} from "../../game/input";
import { getTheme } from "../../theme/theme";
import { createText } from "../../ui/text";
import { createGlide, type Glide } from "../../ui/motion";
import {
  chipHeight,
  createChip,
  drawField,
  rowWidth,
  type Chip,
} from "../../ui/widgets";
import { transportWidth } from "./timeline";
import type { Studio } from "./studio";

type Transport = {
  playChip: Container;
  patternBar: Container;
  playtestBar: Container;
  playing: () => boolean;
  patternPlaying: () => boolean;
  playtesting: () => boolean;
  typing: () => boolean;
  setPlaytesting: (value: boolean) => void;
  togglePlaying: () => void;
  pause: () => void;
  playtest: () => void;
  stopTyping: () => void;
  update: (delta: number) => void;
};

const playtestWidth: number = 98; // units
const packTabs: Array<string> = ["run", "game"];
const iconSize: number = 3.5; // units
const iconPop: number = 0.4;
const clockWidth: number = 46; // units
const clockSize: number = 8; // units
const fieldPadding: number = 4; // units
const patternGap: number = 6; // units
const typingLength: number = 7;
const caretBlink: number = 1; // s

function createTransport(
  app: Application,
  studio: Studio,
  live: () => boolean,
  scened: () => boolean,
): Transport {
  const { preview, tab } = studio;
  const { sound, stage, soundById } = studio.pick;
  const playIcon: Graphics = new Graphics();
  const patternIcon: Graphics = new Graphics();
  const patternBar: Container = new Container();
  const patternClock: Text = createText(clockSize, "#ffffff");
  const clockField: Container = new Container();
  const clockBox: Graphics = new Graphics();
  const playtestBar: Container = new Container();
  const hitsText: Text = createText(clockSize, "#ffffff");
  const fieldFocus: Glide = createGlide(0, () => undefined);
  const iconStates: Map<Graphics, boolean> = new Map();
  const iconPops: Map<Graphics, Glide> = new Map();
  let playing: boolean = true;
  let patternPlaying: boolean = true;
  let playtesting: boolean = false;
  let typing: string | null = null;
  let typingFresh: boolean = false;
  let caretTime: number = 0;
  let music: Track | null = null;
  let musicToken: number = 0;
  const keyboard: Keyboard = createKeyboard(() => live() && playtesting);

  function popIcon(icon: Graphics, running: boolean): void {
    let pop: Glide | undefined = iconPops.get(icon);

    if (pop === undefined) {
      pop = createGlide(1, (scale: number) => {
        icon.scale.set(scale);
      });
      iconPops.set(icon, pop);
      icon.pivot.set(transportWidth / 2, chipHeight / 2);
      icon.position.set(transportWidth / 2, chipHeight / 2);
    }

    if (iconStates.has(icon) && iconStates.get(icon) !== running) {
      pop.snap(iconPop);
      pop.set(1);
    }

    iconStates.set(icon, running);
  }

  function drawPlayIcon(): void {
    drawToggle(playIcon, playing);
    drawToggle(patternIcon, patternPlaying);
  }

  function drawToggle(icon: Graphics, running: boolean): void {
    const center: number = transportWidth / 2;
    const middle: number = chipHeight / 2;

    popIcon(icon, running);
    icon.clear();

    if (running) {
      icon
        .rect(
          center - iconSize * 0.8,
          middle - iconSize,
          iconSize * 0.55,
          iconSize * 2,
        )
        .rect(
          center + iconSize * 0.25,
          middle - iconSize,
          iconSize * 0.55,
          iconSize * 2,
        )
        .fill(0xffffff);
    } else {
      icon
        .poly([
          center - iconSize * 0.7,
          middle - iconSize,
          center + iconSize,
          middle,
          center - iconSize * 0.7,
          middle + iconSize,
        ])
        .fill(0xffffff);
    }
  }

  function togglePlaying(): void {
    if (tab().name === "pattern") {
      patternPlaying = !patternPlaying;
    } else {
      playing = !playing;
    }

    drawPlayIcon();
  }

  function loopMusic(value: Sound, token: number): void {
    music = playTrack(value, (played: boolean) => {
      if (played && token === musicToken) {
        loopMusic(value, token);
      }
    });
  }

  function setMusic(on: boolean): void {
    const chosen: Sound | null =
      on && tab().name === "stage" ? soundById(stage().music) : null;

    musicToken++;
    music?.stop();
    music = null;

    if (chosen !== null) {
      loopMusic(chosen, musicToken);
    }
  }

  function setPlaytesting(value: boolean): void {
    playtesting = value;
    setMusic(value);
    keyboard.clear();
    preview.setPlaytest(value);

    if (value) {
      playing = true;
      patternPlaying = true;
      drawPlayIcon();
    } else {
      tab().show();
    }

    playtestChip.paint();
  }

  function playtest(): void {
    if (tab().name === "sound") {
      playSound(sound());
      return;
    }

    if (packTabs.includes(tab().name)) {
      return;
    }

    if (scened()) {
      studio.playScene();
      return;
    }

    setPlaytesting(!playtesting);
  }

  function steer(): void {
    const input: Vector = steering(keyboard.pressed);

    preview.steer(
      input.x,
      input.y,
      keyboard.pressed(focusKeys),
      keyboard.pressed(shotKeys),
      keyboard.pressed(bombKeys),
    );
  }

  function pause(): void {
    playing = false;
    drawPlayIcon();
  }

  const playChip: Chip = createChip("", transportWidth, togglePlaying);
  const patternChip: Chip = createChip("", transportWidth, togglePlaying);
  const playtestChip: Chip = createChip(
    "playtest",
    playtestWidth,
    playtest,
    () => playtesting,
  );

  patternChip.view.addChild(patternIcon);
  patternClock.anchor.set(0, 0.5);
  patternClock.position.set(fieldPadding, chipHeight / 2);
  clockField.position.set(transportWidth + patternGap, 0);
  clockField.addChild(clockBox, patternClock);
  patternBar.addChild(patternChip.view, clockField);
  clockField.eventMode = "static";
  clockField.cursor = "text";
  clockField.hitArea = new Rectangle(0, 0, clockWidth, chipHeight);
  clockField.on("pointertap", () => {
    if (typing === null) {
      typing = preview.patternTime().toFixed(1);
      typingFresh = true;
      patternPlaying = false;
      drawPlayIcon();
    }
  });

  function finishTyping(apply: boolean): void {
    if (typing === null) {
      return;
    }

    const value: number = Number(typing);

    if (apply && typing !== "" && Number.isFinite(value)) {
      preview.seekPattern(value);
    }

    typing = null;
  }

  window.addEventListener("pointerdown", (event: PointerEvent) => {
    if (typing !== null && event.target === app.canvas) {
      const bounds: Bounds = clockField.getBounds();
      const point: Point = app.renderer.events.pointer.global;

      if (!bounds.containsPoint(point.x, point.y)) {
        finishTyping(true);
      }
    }
  });

  window.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      if (typing === null) {
        return;
      }

      if (event.key === "Enter") {
        finishTyping(true);
      } else if (event.key === "Escape") {
        finishTyping(false);
      } else if (event.key === "Backspace") {
        typing = typingFresh ? "" : typing.slice(0, -1);
        typingFresh = false;
      } else if (
        (/^[0-9]$/.test(event.key) ||
          (event.key === "." && (typingFresh || !typing.includes(".")))) &&
        (typingFresh || typing.length < typingLength)
      ) {
        typing = (typingFresh ? "" : typing) + event.key;
        typingFresh = false;
      } else {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  function update(delta: number): void {
    hitsText.visible = playtesting;
    hitsText.text = "HITS " + preview.hits() + "  BOMBS " + preview.bombs();

    if (playtesting) {
      steer();
    }

    patternBar.visible = tab().name === "pattern";
    playtestBar.visible =
      tab().name !== "palette" && !packTabs.includes(tab().name);
    fieldFocus.set(typing !== null ? 1 : 0);
    drawField(clockBox, clockWidth, chipHeight, fieldFocus.value());

    if (typing === null) {
      patternClock.text = preview.patternTime().toFixed(1) + "s";
      patternClock.tint = 0xffffff;
    } else {
      caretTime += delta;
      patternClock.text =
        typing + (caretTime % caretBlink < caretBlink / 2 ? "|" : " ") + "s";
      patternClock.tint = getTheme().accent;
    }
  }

  hitsText.anchor.set(1, 0.5);
  hitsText.position.set(rowWidth, chipHeight / 2);
  playtestBar.addChild(playtestChip.view, hitsText);
  playChip.view.addChild(playIcon);
  drawPlayIcon();

  return {
    playChip: playChip.view,
    patternBar: patternBar,
    playtestBar: playtestBar,
    playing: () => playing,
    patternPlaying: () => patternPlaying,
    playtesting: () => playtesting,
    typing: () => typing !== null,
    setPlaytesting: setPlaytesting,
    togglePlaying: togglePlaying,
    pause: pause,
    playtest: playtest,
    stopTyping: () => {
      typing = null;
    },
    update: update,
  };
}

export { createTransport };
export type { Transport };
