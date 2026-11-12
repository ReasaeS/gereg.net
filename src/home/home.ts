import {
  Circle,
  Container,
  Graphics,
  Point,
  Rectangle,
  Sprite,
  Text,
  type Application,
  type Texture,
  type FederatedPointerEvent,
  type Ticker,
} from "pixi.js";
import { frameDelta, tween } from "../effects/tween/tween";
import { createGlide, mix, type Glide } from "../ui/motion";
import { createText, screenResolution, sharpen } from "../ui/text";
import { getTheme } from "../theme/theme";
import { createKeyboard, steering, type Keyboard } from "../game/input";
import { playSound } from "../create/sound";
import type { Sound, Vector } from "../create/types";
import { formatPlaytime, playtime } from "../settings/playtime";
import { createMascot, mascotName, type Mascot } from "../menu/mascot";
import {
  clampFloor,
  depthScale,
  roomHeight,
  roomWidth,
  type Room,
  type Spot,
} from "./room";
import { createKeeperRoom } from "./keeper";
import { createLampRoom } from "./lamproom";
import { seaHeight } from "../worlds/vivid";
import { createAvatar, type Avatar } from "./avatar";
import { createWalker, type Walker } from "./walker";
import { createBubble, type Bubble } from "./bubble";
import {
  createEmoteBubble,
  drawEmote,
  emotes,
  type Emote,
  type EmoteBubble,
} from "./emotes";

type Home = {
  view: Container;
  enter: () => void;
  setActive: (active: boolean) => void;
  setShown: (amount: number) => void;
  back: () => boolean;
  subject: () => string;
  setScenery: (texture: Texture) => void;
};

type Target = Spot | "plip";

type WheelItem = {
  view: Container;
  back: Graphics;
  hover: Glide;
};

const plipSpeed: number = 130; // units/s
const plipScale: number = 0.5;
const plipFloat: number = 84; // units
const plipHeight: number = 300; // units
const plipReach: number = 74; // units
const plipStand: number = 130; // units
const wanderMin: number = 7; // s
const wanderMax: number = 13; // s
const wanderSpots: Array<[number, number]> = [
  [600, 790],
  [800, 860],
  [1000, 820],
  [1050, 740],
];
const greetDelay: number = 0.9; // s
const reactDelay: number = 0.4; // s
const reactRange: number = 520; // units
const moodTime: number = 2.2; // s
const interactRange: number = 230; // units
const switchTime: number = 700; // ms
const switchShift: number = 70; // units
const hudReference: number = 1000; // px
const hudMargin: number = 40; // px
const tagSize: number = 22; // px
const tagPadding: number = 10; // px
const tagSlant: number = 8; // px
const buttonRadius: number = 36; // px
const buttonIcon: number = 42; // px
const wheelRadius: number = 175; // px
const wheelItemRadius: number = 32; // px
const wheelIcon: number = 38; // px
const wheelKeySize: number = 15; // px
const panelColor: string = "#01040f";
const panelAlpha: number = 0.92;
const emoteKey: string = "KeyE";
const emoteKeys: Array<string> = [
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
];
const useKeys: Array<string> = ["Enter", "NumpadEnter", "Space"];
const popPitch: number = 1.5;
const replyPitch: number = 1.2;
const firstGreeting: string =
  "Oh, a visitor! Come in, come in. Make yourself at home.";
const returnGreeting: string = "Welcome back! I saved you the best view.";
const chatter: Array<string> = [
  "This is my lighthouse. Well, I found it empty and nobody told me to leave.",
  "On a clear night you can see the whole sea from up here. There are no clear nights.",
  "I like it up here. The rain sounds closest from the top.",
  "Press E to make a face at me. I'll make one back!",
  "The radio downstairs plays whatever the menu is playing. Click it if you'd rather listen to the rain.",
  "The bookshelf downstairs is full of tips. I've read them all twice.",
  "Nobody fires me at anything in here. I like that.",
  "The umbrella stays on indoors. Old habits.",
];
const windowLines: Array<string> = [
  "Rain, rain and more rain.",
  "The waves roll in, one after another.",
  "The glass is cold. The rain doesn't seem to mind.",
];
const scopeLines: Array<string> = [
  "A witch on a broom, far out over the sea.",
  "Rain clouds all the way to the horizon.",
  "A bullet pattern blooming in the distance. Best stay inside.",
  "Nothing but waves. Peaceful.",
];
const umbrellaLine: string = "That's what the umbrella is for!";

function pick(list: Array<string>): string {
  return list[Math.floor(Math.random() * list.length)] ?? "";
}

function mixRandom(from: number, to: number): number {
  return from + (to - from) * Math.random();
}

function createHome(
  app: Application,
  voice: Sound | null,
  tips: Array<string>,
  leave: () => void,
  setRadio: (on: boolean) => void,
): Home {
  const view: Container = new Container();
  const stage: Container = new Container();
  const backLayer: Container = new Container();
  const sortLayer: Container = new Container();
  const frontLayer: Container = new Container();
  const hotLayer: Container = new Container();
  const overLayer: Container = new Container();
  const cover: Graphics = new Graphics();
  const sceneryBack: Graphics = new Graphics();
  const scenery: Sprite = new Sprite();
  const hud: Container = new Container();
  const keeper: Room = createKeeperRoom();
  const lamp: Room = createLampRoom();
  let room: Room = keeper;
  const avatar: Avatar = createAvatar((x: number, y: number) =>
    clampFloor(room, x, y),
  );
  const plipWalker: Walker = createWalker(plipSpeed, (x: number, y: number) =>
    clampFloor(lamp, x, y),
  );
  const mascot: Mascot = createMascot();
  const plipHolder: Container = new Container();
  const plipHit: Container = new Container();
  const bubble: Bubble = createBubble(voice);
  const avatarEmote: EmoteBubble = createEmoteBubble();
  const plipEmote: EmoteBubble = createEmoteBubble();
  const keyboard: Keyboard = createKeyboard(() => ready());
  const spotHits: Map<Spot, Container> = new Map();
  const tag: Container = new Container();
  const tagBack: Graphics = new Graphics();
  const tagText: Text = createText(tagSize, "#ffffff");
  const tagShown: Glide = createGlide(0, (value: number) => {
    tag.alpha = value;
    tag.visible = value > 0;
  });
  const emoteButton: Container = new Container();
  const buttonBack: Graphics = new Graphics();
  const buttonHover: Glide = createGlide(0, paintButton);
  const wheel: Container = new Container();
  const wheelItems: Array<WheelItem> = new Array();
  const wheelShown: Glide = createGlide(0, placeWheel);
  let active: boolean = false;
  let switching: boolean = false;
  let wheelOpen: boolean = false;
  let keyMode: boolean = false;
  let hovered: Target | null = null;
  let radioOn: boolean = true;
  let visits: number = 0;
  let chatIndex: number = 0;
  let greetLeft: number = 0;
  let greeted: boolean = false;
  let wanderLeft: number = wanderMin;
  let wanderAt: number = 1;
  let reaction: Emote | null = null;
  let reactLeft: number = 0;
  let moodLeft: number = 0;
  let shift: number = 0;
  let stageScale: number = 0;
  let hudScale: number = 0;
  let tagLabel: string = "";
  let gazing: Target | null = null;
  const gaze: Glide = createGlide(0, (value: number) => {
    stage.alpha = 1 - value;
    hud.alpha = 1 - value;
    stage.visible = value < 1;
    hud.visible = value < 1;
  });

  function ready(): boolean {
    return active && !switching && gazing === null;
  }

  function startGaze(target: Target): void {
    gazing = target;
    closeWheel();
    bubble.hide();
    hovered = null;
    keyboard.clear();
    avatar.walker.stop();
    gaze.snap(1);
  }

  function stopGaze(): void {
    const target: Target | null = gazing;

    if (target === null) {
      return;
    }

    gazing = null;
    gaze.snap(0);

    if (target !== "plip") {
      caption(target, pick(scopeLines));
    }
  }

  function paintButton(): void {
    const hover: number = buttonHover.value();

    buttonBack
      .clear()
      .circle(0, 0, buttonRadius)
      .fill({
        color: mix(panelColor, getTheme().menuSelected, hover),
        alpha: panelAlpha,
      })
      .stroke({
        color: wheelOpen ? getTheme().accent : getTheme().highlight,
        width: 2,
      });
    emoteButton.scale.set(1 + hover * 0.08);
  }

  function paintWheelItem(item: WheelItem): void {
    const hover: number = item.hover.value();

    item.back
      .clear()
      .circle(0, 0, wheelItemRadius)
      .fill({
        color: mix(panelColor, getTheme().menuSelected, hover),
        alpha: panelAlpha,
      })
      .stroke({ color: getTheme().highlight, width: 2 });
    item.view.scale.set((1 + hover * 0.12) * wheelShown.value());
  }

  function placeWheel(value: number): void {
    wheel.visible = value > 0;

    for (let index = 0; index < wheelItems.length; index++) {
      const item: WheelItem = wheelItems[index]!;
      const angle: number =
        Math.PI + (index * Math.PI) / (wheelItems.length - 1);

      item.view.position.set(
        Math.cos(angle) * wheelRadius * value,
        Math.sin(angle) * wheelRadius * value,
      );
      item.view.alpha = Math.min(value * 1.5, 1);
      paintWheelItem(item);
    }
  }

  function setWheel(open: boolean): void {
    wheelOpen = open;
    wheelShown.set(open ? 1 : 0);
    paintButton();
  }

  function closeWheel(): void {
    if (wheelOpen) {
      setWheel(false);
    }
  }

  function blip(factor: number): void {
    if (voice === null) {
      return;
    }

    playSound({
      ...voice,
      pitch: voice.pitch * factor,
      slide: voice.slide * factor,
    });
  }

  function plipTop(): Point {
    return new Point(
      plipWalker.x(),
      plipWalker.y() - plipHeight * plipScale * depthScale(plipWalker.y()),
    );
  }

  function plipHere(): boolean {
    return room === lamp;
  }

  function plipSay(text: string): void {
    plipWalker.stop();
    wanderLeft = mixRandom(wanderMin, wanderMax);
    mascot.hop();
    bubble.say(mascotName, text, plipTop, true);
  }

  function caption(spot: Spot, text: string): void {
    bubble.say(
      spot.name,
      text,
      () => new Point(spot.tag[0], spot.tag[1] + tagSize),
      false,
    );
  }

  function talk(): void {
    const line: string = chatter[chatIndex % chatter.length]!;

    chatIndex++;
    mascot.setMood("happy");
    moodLeft = moodTime;
    plipSay(line);
  }

  function clockLine(): string {
    const now: Date = new Date();

    return (
      "It's " +
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0") +
      ". You've been online for " +
      formatPlaytime(playtime()) +
      "."
    );
  }

  function perform(target: Target): void {
    if (target === "plip") {
      avatar.face(plipWalker.x() - avatar.walker.x());
      talk();
      return;
    }

    avatar.face(target.tag[0] - avatar.walker.x());
    room.poke(target.act);

    if (target.act === "exit") {
      leave();
    } else if (target.act === "books") {
      caption(target, pick(tips));
    } else if (target.act === "window") {
      caption(target, pick(windowLines));
    } else if (target.act === "clock") {
      caption(target, clockLine());
    } else if (target.act === "radio") {
      radioOn = !radioOn;
      setRadio(radioOn);
      room.poke(radioOn ? "radio:on" : "radio:off");
      caption(
        target,
        radioOn
          ? "Click. The music comes back on."
          : "Click. Now it's just you and the rain.",
      );
    } else if (target.act === "upstairs") {
      switchRoom(lamp, "stairs");
    } else if (target.act === "downstairs") {
      switchRoom(keeper, "stairs");
    } else if (target.act === "telescope") {
      startGaze(target);
    } else if (target.act === "log") {
      caption(
        target,
        "Keeper's log. Visitor online for " +
          formatPlaytime(playtime()) +
          ". Weather: rain. Again.",
      );
    }
  }

  function standOf(target: Target): [number, number] {
    if (target === "plip") {
      const side: number = avatar.walker.x() < plipWalker.x() ? -1 : 1;

      return [plipWalker.x() + side * plipStand, plipWalker.y() + 10];
    }

    return target.stand;
  }

  function use(target: Target): void {
    const [x, y] = standOf(target);

    closeWheel();

    if (target === "plip") {
      plipWalker.stop();
      wanderLeft = mixRandom(wanderMin, wanderMax);
    }

    avatar.walker.goTo(x, y, () => perform(target));
  }

  function nearest(): Target | null {
    const x: number = avatar.walker.x();
    const y: number = avatar.walker.y();
    let best: Target | null = null;
    let bestDistance: number = interactRange;

    for (const spot of room.spots) {
      const distance: number = Math.hypot(spot.stand[0] - x, spot.stand[1] - y);

      if (distance < bestDistance) {
        best = spot;
        bestDistance = distance;
      }
    }

    if (
      plipHere() &&
      Math.hypot(plipWalker.x() - x, plipWalker.y() - y) < bestDistance
    ) {
      best = "plip";
    }

    return best;
  }

  function emote(name: Emote): void {
    avatarEmote.show(name);
    blip(popPitch);
    closeWheel();

    if (
      plipHere() &&
      Math.hypot(
        plipWalker.x() - avatar.walker.x(),
        plipWalker.y() - avatar.walker.y(),
      ) < reactRange
    ) {
      reaction = name;
      reactLeft = reactDelay;
    }
  }

  function react(name: Emote): void {
    if (name === "question") {
      talk();
      return;
    }

    if (name === "drop") {
      plipSay(umbrellaLine);
      return;
    }

    plipEmote.show(name);
    blip(replyPitch);

    if (name === "smile") {
      mascot.wave();
      return;
    }

    mascot.hop();

    if (name !== "note") {
      mascot.setMood("happy");
      moodLeft = moodTime;
    }
  }

  function mount(next: Room, entry: string): void {
    const [x, y] = next.entries.get(entry) ?? [800, 800];

    for (const prop of room.props) {
      sortLayer.removeChild(prop);
    }

    backLayer.removeChildren();
    frontLayer.removeChildren();
    room = next;
    backLayer.addChild(room.back);
    frontLayer.addChild(room.front);
    for (const prop of room.props) {
      sortLayer.addChild(prop);
    }

    for (const [spot, hit] of spotHits) {
      hit.visible = room.spots.includes(spot);
    }

    if (plipHere() && !greeted) {
      greeted = true;
      greetLeft = greetDelay;
    }

    plipHolder.visible = plipHere();
    plipHit.visible = plipHere();
    plipEmote.view.visible = false;
    hovered = null;
    avatar.walker.place(x, y);
  }

  function switchRoom(next: Room, entry: string): void {
    const direction: number = next === lamp ? 1 : -1;

    switching = true;
    closeWheel();
    bubble.hide();
    keyboard.clear();
    tween(app.ticker, switchTime, (progress: number) => {
      const first: boolean = progress < 0.5;
      const along: number = progress * 2;
      const fade: number = first ? along : 2 - along;

      cover.alpha = fade * fade * (3 - 2 * fade);
      shift = (first ? along : along - 2) * switchShift * direction;

      if (!first && room !== next) {
        mount(next, entry);
      }
    }).then(() => {
      shift = 0;
      cover.alpha = 0;
      switching = false;
    });
  }

  function setTag(label: string, x: number, y: number): void {
    if (label !== tagLabel) {
      tagLabel = label;
      tagText.text = label.toUpperCase();
      tagBack
        .clear()
        .poly([
          -tagText.width / 2 - tagPadding + tagSlant,
          -tagSize - tagPadding,
          tagText.width / 2 + tagPadding + tagSlant,
          -tagSize - tagPadding,
          tagText.width / 2 + tagPadding,
          tagPadding / 2,
          -tagText.width / 2 - tagPadding,
          tagPadding / 2,
        ])
        .fill({ color: panelColor, alpha: panelAlpha })
        .stroke({ color: getTheme().highlight, width: 2, join: "round" });
    }

    tag.position.set(x, y);
    tagShown.set(1);
  }

  function updateTag(): void {
    const target: Target | null =
      hovered ?? (keyMode && !avatar.walker.moving() ? nearest() : null);

    if (target === null || bubble.shown() || !ready()) {
      tagShown.set(0);
      return;
    }

    if (target === "plip") {
      const top: Point = plipTop();

      setTag(keyMode ? "Enter  " + mascotName : mascotName, top.x, top.y);
      return;
    }

    setTag(
      keyMode && hovered === null ? "Enter  " + target.name : target.name,
      target.tag[0],
      target.tag[1],
    );
  }

  function updatePlip(delta: number): void {
    const talking: boolean =
      bubble.talking() && bubble.speaker() === mascotName;
    const depth: number = depthScale(plipWalker.y());

    plipWalker.update(delta);
    mascot.update(delta);
    mascot.setTalking(talking);
    plipHolder.position.set(plipWalker.x(), plipWalker.y());
    plipHolder.scale.set(depth);
    plipHolder.zIndex = plipWalker.y();
    plipHit.position.set(
      plipWalker.x(),
      plipWalker.y() - plipFloat * plipScale * depth,
    );
    plipHit.scale.set(depth);
    plipEmote.update(delta);
    plipEmote.view.position.copyFrom(plipTop());

    if (moodLeft > 0) {
      moodLeft -= delta;

      if (moodLeft <= 0) {
        mascot.setMood("calm");
      }
    }

    if (!ready()) {
      return;
    }

    if (greetLeft > 0) {
      greetLeft -= delta;

      if (greetLeft <= 0 && plipHere()) {
        mascot.wave();
        mascot.setMood("happy");
        moodLeft = moodTime;
        plipSay(visits === 1 ? firstGreeting : returnGreeting);
      }
    }

    if (reaction !== null) {
      reactLeft -= delta;

      if (reactLeft <= 0) {
        const name: Emote = reaction;

        reaction = null;
        react(name);
      }

      return;
    }

    if (bubble.shown() && bubble.speaker() === mascotName) {
      return;
    }

    wanderLeft -= delta;

    if (wanderLeft <= 0) {
      wanderAt =
        (wanderAt + 1 + Math.floor(Math.random() * (wanderSpots.length - 1))) %
        wanderSpots.length;
      wanderLeft = mixRandom(wanderMin, wanderMax);
      plipWalker.goTo(...wanderSpots[wanderAt]!, null);
    }
  }

  function layout(): void {
    const width: number = app.screen.width;
    const height: number = app.screen.height;
    const scale: number = Math.min(height / roomHeight, width / roomWidth);
    const hudSize: number = Math.min(height, width) / hudReference;
    const hudWidth: number = width / hudSize;
    const hudHeight: number = height / hudSize;

    stage.scale.set(scale);
    stage.position.set(
      (width - roomWidth * scale) / 2,
      (height - roomHeight * scale) / 2 + shift * scale,
    );
    hud.scale.set(hudSize);
    emoteButton.position.set(
      hudWidth / 2,
      hudHeight - hudMargin - buttonRadius,
    );
    wheel.position.copyFrom(emoteButton.position);
    cover.clear().rect(0, 0, width, height).fill("#000000");
    sceneryBack.clear().rect(0, 0, width, height).fill(getTheme().seaMiddle);
    scenery.setSize(width, height);
    scenery.position.set(
      0,
      (stage.toGlobal(new Point(0, room.horizon)).y -
        height * (1 - seaHeight / 100)) *
        (1 - gaze.value()),
    );
    view.hitArea = new Rectangle(0, 0, width, height);

    if (scale !== stageScale) {
      stageScale = scale;
      sharpen(stage, screenResolution(scale));
    }

    if (hudSize !== hudScale) {
      hudScale = hudSize;
      sharpen(hud, screenResolution(hudSize));
    }
  }

  function addSpot(spot: Spot): void {
    const hit: Container = new Container();

    hit.hitArea = spot.area;
    hit.eventMode = "static";
    hit.cursor = "pointer";
    hit.visible = false;
    hit.on("pointerover", () => {
      hovered = spot;
    });
    hit.on("pointerout", () => {
      if (hovered === spot) {
        hovered = null;
      }
    });
    hit.on("pointertap", (event: FederatedPointerEvent) => {
      event.stopPropagation();

      if (ready()) {
        use(spot);
      }
    });
    spotHits.set(spot, hit);
    hotLayer.addChild(hit);
  }

  function buildWheel(): void {
    for (let index = 0; index < emotes.length; index++) {
      const name: Emote = emotes[index]!;
      const itemView: Container = new Container();
      const back: Graphics = new Graphics();
      const number: Text = createText(wheelKeySize, getTheme().accent);
      const item: WheelItem = {
        view: itemView,
        back: back,
        hover: createGlide(0, () => paintWheelItem(item)),
      };

      number.text = String(index + 1);
      number.anchor.set(0.5);
      number.position.set(wheelItemRadius * 0.7, wheelItemRadius * 0.7);
      itemView.addChild(back, drawEmote(name, wheelIcon), number);
      itemView.eventMode = "static";
      itemView.cursor = "pointer";
      itemView.hitArea = new Circle(0, 0, wheelItemRadius);
      itemView.on("pointerover", () => item.hover.set(1));
      itemView.on("pointerout", () => item.hover.set(0));
      itemView.on("pointertap", (event: FederatedPointerEvent) => {
        event.stopPropagation();

        if (ready()) {
          emote(name);
        }
      });
      wheelItems.push(item);
      wheel.addChild(itemView);
    }

    placeWheel(0);
  }

  for (const spot of [...keeper.spots, ...lamp.spots]) {
    addSpot(spot);
  }

  mascot.view.scale.set(plipScale);
  mascot.view.y = -plipFloat * plipScale;
  plipHolder.addChild(mascot.view);
  plipHit.hitArea = new Circle(0, 0, plipReach);
  plipHit.eventMode = "static";
  plipHit.cursor = "pointer";
  plipHit.on("pointerover", () => {
    hovered = "plip";
  });
  plipHit.on("pointerout", () => {
    if (hovered === "plip") {
      hovered = null;
    }
  });
  plipHit.on("pointertap", (event: FederatedPointerEvent) => {
    event.stopPropagation();

    if (ready()) {
      use("plip");
    }
  });
  sortLayer.sortableChildren = true;
  sortLayer.addChild(avatar.view, plipHolder);
  hotLayer.addChild(plipHit);
  tagText.anchor.set(0.5, 1);
  tag.addChild(tagBack, tagText);
  tag.visible = false;
  overLayer.addChild(bubble.view, avatarEmote.view, plipEmote.view, tag);
  overLayer.eventMode = "none";
  stage.addChild(backLayer, sortLayer, frontLayer, hotLayer, overLayer);
  buttonBack.eventMode = "none";
  emoteButton.addChild(buttonBack, drawEmote("smile", buttonIcon));
  emoteButton.eventMode = "static";
  emoteButton.cursor = "pointer";
  emoteButton.hitArea = new Circle(0, 0, buttonRadius);
  emoteButton.on("pointerover", () => buttonHover.set(1));
  emoteButton.on("pointerout", () => buttonHover.set(0));
  emoteButton.on("pointertap", (event: FederatedPointerEvent) => {
    event.stopPropagation();

    if (ready()) {
      setWheel(!wheelOpen);
    }
  });
  paintButton();
  buildWheel();
  hud.addChild(wheel, emoteButton);
  cover.alpha = 0;
  cover.eventMode = "none";
  view.addChild(sceneryBack, scenery, stage, cover, hud);
  view.visible = false;
  view.alpha = 0;
  view.eventMode = "none";
  view.on("pointertap", (event: FederatedPointerEvent) => {
    if (active && gazing !== null) {
      stopGaze();
      return;
    }

    if (!ready()) {
      return;
    }

    const point: Point = stage.toLocal(event.global);

    if (wheelOpen) {
      closeWheel();
      return;
    }

    avatar.walker.goTo(point.x, point.y, null);
  });
  view.on("pointermove", () => {
    keyMode = false;
  });
  mount(keeper, "door");

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (
      active &&
      gazing !== null &&
      event.key !== "Escape" &&
      !event.repeat &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      stopGaze();
      event.preventDefault();
      return;
    }

    if (!ready() || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.code === emoteKey) {
      if (!event.repeat) {
        setWheel(!wheelOpen);
      }
    } else if (emoteKeys.includes(event.code)) {
      if (!event.repeat) {
        emote(emotes[emoteKeys.indexOf(event.code)]!);
      }
    } else if (useKeys.includes(event.code)) {
      const target: Target | null = nearest();

      keyMode = true;

      if (event.repeat) {
        event.preventDefault();
        return;
      }

      if (target !== null) {
        use(target);
      } else if (bubble.shown()) {
        bubble.hide();
      }
    } else {
      return;
    }

    event.preventDefault();
  });

  app.ticker.add((ticker: Ticker) => {
    if (!view.visible) {
      return;
    }

    const delta: number = frameDelta(ticker);

    if (ready()) {
      const direction: Vector = steering(keyboard.pressed);

      if (direction.x !== 0 || direction.y !== 0) {
        keyMode = true;
        avatar.walker.steer(direction.x, direction.y);
      }
    }

    avatar.update(delta);
    updatePlip(delta);
    room.update(delta);
    bubble.update(delta);
    avatarEmote.update(delta);
    avatarEmote.view.position.copyFrom(avatar.top());
    updateTag();
    layout();
  });

  function enter(): void {
    visits++;
    switching = false;
    shift = 0;
    cover.alpha = 0;
    closeWheel();
    bubble.hide();
    mount(keeper, "door");
    avatar.face(1);
    wanderAt = 1;
    plipWalker.place(...wanderSpots[wanderAt]!);
    wanderLeft = mixRandom(wanderMin, wanderMax);
    reaction = null;
    greetLeft = 0;
    greeted = false;
    mascot.paint();
    mascot.setMood("calm");
    keeper.poke(radioOn ? "radio:on" : "radio:off");
    setRadio(radioOn);
    layout();
  }

  return {
    view: view,
    enter: enter,
    setActive: (value: boolean) => {
      active = value;
      view.eventMode = value ? "static" : "none";
      keyboard.clear();

      if (!value) {
        closeWheel();
        hovered = null;
        gazing = null;
        gaze.snap(0);
      }
    },
    setShown: (amount: number) => {
      view.alpha = amount;
      view.visible = amount > 0;
    },
    back: () => {
      if (gazing !== null) {
        stopGaze();
        return true;
      }

      if (wheelOpen) {
        closeWheel();
        return true;
      }

      return false;
    },
    subject: () => room.subject,
    setScenery: (texture: Texture) => {
      scenery.texture = texture;
    },
  };
}

export { createHome };
export type { Home };
