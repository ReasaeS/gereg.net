import {
  Application,
  Container,
  Graphics,
  Text,
  Texture,
  UPDATE_PRIORITY,
  Rectangle,
  type BindGroup,
  type Point,
  type Ticker,
} from "pixi.js";
import {
  createButtons,
  buttonFaces,
  resetButtons,
  enterButtons,
  leaveButtons,
  setButtonsActive,
  selectedPoint,
  onSelect,
  menuHovered,
  navigate,
} from "./menu/options";
import {
  createPage,
  showPage,
  hidePage,
  hideTime,
  type Page,
  type PageContent,
} from "./menu/page";
import { createEditor } from "./editor/editor";
import { droneTexture, playerTexture } from "./editor/drawings";
import { createPlayfield, type Playfield } from "./game/playfield";
import { createSettings } from "./settings/panel";
import { createStats } from "./menu/stats";
import { createMaker } from "./create/maker/maker";
import { createGuides } from "./dev/guides";
import { resetApp } from "./dev/reset";
import { createPalette, type Palette } from "./dev/palette";
import {
  createLanding,
  setLandingEnabled,
  landingCircle,
  introBounds,
  bindLanding,
  setIntroFrame,
  landingHovered,
  landingBrightness,
  moveLogoToCorner,
  moveLogoToCenter,
  landingConstellation,
  showLandingRing,
  landingRing,
} from "./menu/landing";
import { nativeRatio, setRenderRatio, viewScale } from "./ui/density";
import { createTerminal, type Terminal } from "./menu/terminal";
import {
  createSoundscape,
  loadMenuSound,
  type Soundscape,
} from "./menu/soundscape";
import { playSound } from "./create/sound";
import type { Sound } from "./create/types";
import { formatPlaytime, playtime } from "./settings/playtime";
import { createAscii, type Ascii } from "./effects/ascii/ascii";
import { createCrt } from "./effects/crt/crt";
import { fadeOut } from "./effects/fade/fadeout";
import { rippleReveal, type Circle } from "./effects/reveal/reveal";
import type { RingStyle } from "./effects/ring/ring";
import {
  cubicBezier,
  smoothDamp,
  tween,
  type Easing,
  type Spring,
} from "./effects/tween/tween";
import {
  createRain,
  addSurface,
  setSurfacesActive,
  setBulletFloor,
  setRainFloor,
  onBulletImpact,
  type RainLayers,
} from "./effects/rain/rain";
import { setPortal, addPortalView, startPortal } from "./effects/portal/portal";
import { seaHeight, createVivid, type Vivid } from "./worlds/vivid";
import { createNightSea } from "./worlds/nightsea";
import { getTheme, onTheme, type Theme } from "./theme/theme";
import { startMotion } from "./ui/motion";
import {
  getFullscreen,
  getResolution,
  getVolume,
  onResolution,
  setFullscreen,
  setVolume,
} from "./settings/settings";
import { startGamepad } from "./game/gamepad";
import { createCredits, type Credits } from "./menu/credits";
import { createHelp, type Help, type Topic } from "./menu/help";
import { createToast, type Toast } from "./ui/toast";
import { onUnlock, type Achievement } from "./game/achievements";
import type { Option } from "./ui/widgets";
import { createHome, type Home } from "./home/home";

const rainEnabled: boolean = true;
const resetWarning: string =
  "Reset GEREG.NET to its out of the box state? Everything you have made and every setting will be lost.";
const revealDuration: number = 500; // ms
const revealEasing: Easing = cubicBezier(0.3, 0, 0.25, 1);
const peekSmoothing: number = 0.12; // s
const terminalStorm: number = 0.35;
const beamCard: string = "beam.geregnet.json";
const voiceCard: string = "voice.geregnet.json";
const portalShore: number = 0.6;
const diveDuration: number = 850; // ms
const diveEasing: Easing = cubicBezier(0.55, 0, 0.25, 1);
const diveFlip: number = -Math.PI; // rad
const transitionLead: number = 200; // ms
const screenshotKey: string = "F8";
const muteKey: string = "F7";
const helpKey: string = "KeyH";
const unmuteStorageKey: string = "geregnet.unmuted";
const unmuteDefault: number = 0.8;
const revokeDelay: number = 1000; // ms
const terminalColor: string = "#000000";
const beamRetractTime: number = 500; // ms
const visitorNumber: number = 1;
const userName: string | null = null;
const tips: Array<string> = [
  "HOLD SHIFT TO ENTER FOCUSED MODE WHILE IN COMBAT.",
  "HOLD Z TO FIRE.",
  "PRESS X TO BOMB WHEN THE SCREEN GETS CROWDED.",
  "MOVE WITH THE ARROW KEYS OR WASD.",
  "BULLETS THAT BRUSH PAST YOU COUNT AS GRAZE.",
  "PRESS ESC TO GO BACK.",
  "PRESS M IN THE CUSTOMISE MENU TO MIRROR YOUR DRAWING.",
  "PRESS G IN THE CUSTOMISE MENU TO TOGGLE THE GRID.",
  "PRESS P IN THE CREATE MENU TO PLAYTEST.",
  "PRESS ESC DURING A RUN TO PAUSE.",
  "PRESS ALT + H ON ANY SCREEN AND PLIP WILL EXPLAIN IT.",
  "EXPORT A CARD TO SHARE IT. DROP A CARD FILE ON THE CREATE MENU TO IMPORT IT.",
  "PRESS / IN THE CREATE MENU TO SEARCH YOUR CARDS.",
];
const destinations: Array<Option<string>> = [
  { value: "terminal", label: "Terminal" },
  { value: "landing", label: "Landing" },
  { value: "main", label: "Main menu" },
  { value: "play", label: "Play" },
  { value: "customise", label: "Customise" },
  { value: "create", label: "Create" },
  { value: "stats", label: "Stats" },
  { value: "config", label: "Config" },
  { value: "lighthouse", label: "Lighthouse" },
  { value: "credits", label: "Credits" },
];
const routeSpeed: number = 10;
const routeLimit: number = 8000; // ms
const backLimit: number = 12;
const zoomDuration: number = 1100; // ms
const zoomEasing: Easing = cubicBezier(0.45, 0, 0.35, 1);
const homeZoom: number = 9;
const homeEnterTime: number = 1200; // ms
const homeLeaveTime: number = 1000; // ms
const homeEasing: Easing = cubicBezier(0.6, 0, 0.3, 1);
const homeReveal: number = 0.55;
const homeDepth: number = 0.55;
const doorMargin: number = 12; // px

const container: HTMLDivElement = document.getElementById(
  "app",
) as HTMLDivElement;
const app: Application = new Application();

function renderResolution(): number {
  const lines: number = getResolution();

  return lines === 0 ? nativeRatio : lines / (window.innerHeight * viewScale());
}

await app.init({
  width: window.innerWidth * viewScale(),
  height: window.innerHeight * viewScale(),
  background: getTheme().outside,
  antialias: true,
  autoDensity: false,
  resolution: renderResolution(),
});

setRenderRatio(app.renderer.resolution);
app.canvas.style.width = "100%";
app.canvas.style.height = "100%";
container.appendChild(app.canvas);
function releaseFilterInput(): void {
  const group: BindGroup = (
    app.renderer.filter as unknown as { _globalFilterBindGroup: BindGroup }
  )._globalFilterBindGroup;

  group.setResource(Texture.EMPTY.source, 1);
  group.setResource(Texture.EMPTY.source.style, 2);

  if (group.resources[3] !== undefined) {
    group.setResource(Texture.EMPTY.source, 3);
  }
}

const wantedResolutions: WeakMap<Text, number> = new WeakMap();

function sharpenAll(target: Container, from: number, to: number): void {
  if (target instanceof Text && (target.resolution !== null || to < 1)) {
    const stored: number | undefined = wantedResolutions.get(target);
    const current: number =
      stored !== undefined && Math.max(stored, 1) === target.resolution
        ? stored
        : (target.resolution ?? from);
    const wanted: number = (current * to) / from;

    wantedResolutions.set(target, wanted);
    target.resolution = Math.max(wanted, 1);
  }

  for (const child of target.children) {
    sharpenAll(child, from, to);
  }
}

function applyResolution(): void {
  const previous: number = app.renderer.resolution;
  const next: number = renderResolution();

  releaseFilterInput();
  app.renderer.resize(
    window.innerWidth * viewScale(),
    window.innerHeight * viewScale(),
    next,
  );

  if (next !== previous) {
    setRenderRatio(next);
    sharpenAll(app.stage, previous, next);
  }
}

window.addEventListener("resize", applyResolution);
onResolution(applyResolution);
startMotion(app.ticker);
bindLanding(app);

const palette: Palette = createPalette(app, destinations, (value: string) =>
  routeTo(value),
);

const world: Container = new Container();
const introFrame: Graphics = new Graphics();
const introBackdrop: Graphics = new Graphics();
let introSurround: number = 0;

function surroundIntro(amount: number): void {
  const bounds: Rectangle = introBounds();

  introSurround = amount;
  introBackdrop
    .clear()
    .rect(0, 0, app.screen.width, app.screen.height)
    .fill(terminalColor);
  introFrame
    .clear()
    .rect(0, 0, app.screen.width, app.screen.height)
    .fill(terminalColor)
    .rect(bounds.x, bounds.y, bounds.width, bounds.height)
    .cut();
  introBackdrop.visible = amount > 0;
  introFrame.visible = amount > 0;
  introBackdrop.alpha = amount;
  introFrame.alpha = amount;
}

const terminal: Terminal = createTerminal(app);

terminal.info(() => userName ?? `VISITOR #${visitorNumber}`);
terminal.info(() => "TIME ONLINE " + formatPlaytime(playtime()));

terminal.print(
  `GEREG.NET v${Math.floor(Date.now() / 1000).toString(36)}`,
  "SYS",
);
terminal.print(`RENDERER ${app.renderer.name.toUpperCase()}`, "SYS");
const screenLayer: Container = new Container();

const screenBackground: Graphics = new Graphics();
let backgroundColor: string = getTheme().outside;

function paintBackground(): void {
  screenBackground
    .clear()
    .rect(0, 0, app.screen.width, app.screen.height)
    .fill(backgroundColor);
}

onTheme((theme: Theme) => {
  backgroundColor = theme.outside;
  paintBackground();
});
app.renderer.on("resize", paintBackground);
screenLayer.addChild(
  screenBackground,
  introBackdrop,
  world,
  introFrame,
  terminal.view,
);
app.stage.addChild(screenLayer, createGuides(app), palette.view);
surroundIntro(1);
app.renderer.on("resize", () => surroundIntro(introSurround));

const ascii: Ascii = createAscii(app, world, introBounds);
createCrt(app, screenLayer, introBounds);

function nextFrame(): Promise<void> {
  return new Promise((resolve: () => void) => {
    app.ticker.addOnce(() => resolve(), undefined, UPDATE_PRIORITY.UTILITY);
  });
}

async function load<T>(task: () => T | Promise<T>): Promise<T> {
  await nextFrame();

  const result: T = await task();

  terminal.advance();

  return result;
}

terminal.progress(rainEnabled ? 10 : 9);

const city: Container = new Container();
const vivid: Container = new Container();
const cityFront: Container = new Container();
const vividFront: Container = new Container();

const ocean: Vivid = await load(() => {
  city.addChild(createNightSea(app));

  return createVivid(app);
});
ocean.setBeamTarget(selectedPoint);
ocean.setHoverBlocker(menuHovered);
vivid.addChild(ocean.view);
ocean.skyLayer.addChild(landingConstellation());

const credits: Credits = createCredits(app, ocean.setDistance);

screenLayer.addChildAt(credits.view, screenLayer.getChildIndex(world) + 1);

const menu: Container = new Container();
const buttons: Container = await load(() => createButtons(app));
menu.addChild(buttons);

const landing: Container = await load(() => createLanding(app));
const soundscape: Soundscape = await load(createSoundscape);
const beamSound: Sound | null = await loadMenuSound(beamCard);

onSelect(() => {
  if (beamSound !== null) {
    playSound(beamSound);
  }
});

if (rainEnabled) {
  setBulletFloor(ocean.surface);
  setRainFloor(1 - seaHeight / 100);
  onBulletImpact(ocean.absorb);

  const rain: RainLayers = await load(() => createRain(app));
  city.addChild(rain.backRain);
  ocean.rainLayer.addChild(ocean.aboveSea, rain.backBullets);
  rain.backBullets.setMask({ mask: ocean.aboveSea, inverse: false });
  cityFront.addChild(rain.frontRain);
  vividFront.addChild(rain.frontBullets);

  const faces: Array<Container> = buttonFaces();

  for (let index = 0; index < faces.length; index++) {
    addSurface(faces[index]!);
  }
}

const pageNames: Array<string> = ["customise", "create", "stats", "config"];
const pages: Map<string, Page> = new Map();

vivid.addChild(menu);

const pageContents: Map<string, PageContent> = new Map([
  ["customise", await load(() => createEditor(app))],
  ["create", await load(() => createMaker(app))],
  ["stats", await load(() => createStats(app))],
  ["config", await load(() => createSettings(app))],
]);

for (let index = 0; index < pageNames.length; index++) {
  const name: string = pageNames[index]!;
  const page: Page = createPage(pageContents.get(name) ?? null);
  pages.set(name, page);
  vivid.addChild(page.view);
}
addPortalView(city, true);
addPortalView(vivid, false);
addPortalView(cityFront, true);
addPortalView(vividFront, false);
const playfield: Playfield = await load(() =>
  createPlayfield(app, playerTexture(), droneTexture()),
);

world.addChild(city, vivid, landing, cityFront, vividFront, playfield.view);
terminal.tip(tips);
terminal.print("");
terminal.print("READY.", "SYS");
const startPrompt: (next: string) => void = terminal.print(
  "PRESS ANY KEY TO START.",
  undefined,
  true,
);
let padPrompt: boolean = false;
startPortal(app);

type Screen =
  | "landing"
  | "intro"
  | "main"
  | "outro"
  | "diving"
  | "page"
  | "rising"
  | "credits"
  | "home"
  | "playing";

let menuOpen: boolean = false;
let currentPage: Page | null = null;
let pageName: string = "";
let route: string | null = null;
let routeStart: number = 0;
let routeBacks: number = 0;
let screen: Screen = "landing";
let booting: boolean = true;
let scape: "terminal" | "landing" | "menu" = "terminal";
let underwater: boolean = false;
let quiet: boolean = false;
let indoors: boolean = false;
let radioOn: boolean = true;
let homeDoor: Point | null = null;
let doorHover: boolean = false;

setLandingEnabled(landing, false);
const peek: Spring = { value: 0, velocity: 0 };

function showThroughRing(): void {
  const circle: Circle = landingCircle();
  circle.radius *= peek.value;
  setPortal(circle);
}

menu.interactiveChildren = false;
setSurfacesActive(false);
showThroughRing();

app.ticker.add(
  (ticker: Ticker) => {
    if (screen !== "landing") {
      return;
    }

    smoothDamp(
      peek,
      landingHovered() ? 1 : 0,
      peekSmoothing,
      ticker.deltaMS / 1000,
    );
    showThroughRing();
  },
  undefined,
  UPDATE_PRIORITY.HIGH,
);

app.ticker.add(() => {
  const opened: number = scape === "landing" ? peek.value : 0;

  soundscape.set({
    intro:
      scape === "menu"
        ? 0
        : scape === "terminal"
          ? terminalStorm
          : 1 - opened / 2,
    portal: scape === "menu" ? 0 : opened * portalShore,
    rain: scape === "menu" ? 1 : 0,
    music: scape === "menu" && (!indoors || radioOn) ? 1 : 0,
    depth: underwater ? 1 : indoors ? homeDepth : 0,
    level: quiet || editingCreation() ? 0 : 1,
  });
});

function editingCreation(): boolean {
  return (
    screen === "page" &&
    pageName === "create" &&
    currentPage?.content?.topic?.() === "editor"
  );
}

function wait(duration: number): Promise<void> {
  return tween(app.ticker, Math.max(duration, 0), () => undefined);
}

function dive(name: string, arrive: () => Promise<void>, end: Screen): void {
  screen = "diving";
  ocean.setScenery(name);
  fadeOut(app.ticker, buttons, 300);
  Promise.all([
    tween(app.ticker, diveDuration, (progress: number) => {
      ocean.setDepth(diveEasing(progress));
      ocean.setFlip(diveFlip * diveEasing(progress));
    }),
    wait(diveDuration - transitionLead).then(arrive),
  ]).then(() => {
    ocean.resetBeam();
    screen = end;
  });
}

function rise(leave: () => Promise<void>, leaveDuration: number): void {
  screen = "rising";
  underwater = false;
  quiet = false;
  Promise.all([
    leave(),
    wait(leaveDuration - transitionLead).then(() =>
      Promise.all([
        tween(app.ticker, diveDuration, (progress: number) => {
          ocean.setDepth(diveEasing(1 - progress));
          ocean.setFlip(diveFlip * (2 - diveEasing(1 - progress)));
        }),
        wait(diveDuration - transitionLead).then(() => {
          buttons.visible = true;
          setSurfacesActive(true);
          return enterButtons(app.ticker);
        }),
      ]),
    ),
  ]).then(() => {
    navigate("menu");
    screen = "main";
  });
}

function openPage(page: Page, name: string): void {
  underwater = true;
  currentPage = page;
  pageName = name;
  dive(name, () => showPage(app.ticker, page), "page");
}

function play(): void {
  quiet = true;
  setSurfacesActive(false);
  dive(
    "play",
    () => {
      buttons.visible = false;
      return playfield.show();
    },
    "playing",
  );
}

const voiceSound: Sound | null = await loadMenuSound(voiceCard);
const home: Home = createHome(
  app,
  voiceSound,
  tips,
  () => {
    if (screen === "home") {
      leaveHome();
    }
  },
  (on: boolean) => {
    radioOn = on;
  },
);
const help: Help = createHelp(app, voiceSound);
const toast: Toast = createToast(app);
const lighthouseSpot: Container = new Container();

function zoomWorld(amount: number, door: Point): void {
  world.pivot.set(door.x, door.y);
  world.position.set(
    door.x + (app.screen.width / 2 - door.x) * amount,
    door.y + (app.screen.height / 2 - door.y) * amount,
  );
  world.scale.set(Math.pow(homeZoom, amount));
}

function placeWorld(): void {
  world.pivot.set(0, 0);
  world.scale.set(1);
  world.position.set(
    0,
    (home.horizon() - app.screen.height * (1 - seaHeight / 100)) *
      (1 - home.gaze()),
  );
}

function resetWorld(): void {
  world.pivot.set(0, 0);
  world.position.set(0, 0);
  world.scale.set(1);
}

function enterHome(): void {
  const door: Point = ocean.lighthouseDoor();

  screen = "diving";
  homeDoor = door;
  setSurfacesActive(false);
  ocean.setLighthouseHovered(true);
  ocean.retractBeam();
  leaveButtons(app.ticker).then(() => {
    buttons.visible = false;
  });
  home.enter();
  tween(app.ticker, homeEnterTime, (progress: number) => {
    zoomWorld(homeEasing(progress), door);
    home.setShown(
      Math.min(Math.max((progress - homeReveal) / (1 - homeReveal), 0), 1),
    );
    indoors = progress > homeReveal;
  }).then(() => {
    ocean.setLighthouseShown(false);
    placeWorld();
    home.setActive(true);
    screen = "home";
  });
}

function leaveHome(): void {
  const door: Point = homeDoor ?? ocean.lighthouseDoor();

  screen = "rising";
  indoors = false;
  home.setActive(false);
  ocean.setLighthouseShown(true);
  Promise.all([
    tween(app.ticker, homeLeaveTime, (progress: number) => {
      zoomWorld(1 - homeEasing(progress), door);
      home.setShown(1 - Math.min(progress / (1 - homeReveal), 1));
    }),
    wait(homeLeaveTime - transitionLead * 2).then(() => {
      ocean.setLighthouseHovered(false);
      buttons.visible = true;
      setSurfacesActive(true);
      return enterButtons(app.ticker);
    }),
  ]).then(() => {
    resetWorld();
    home.setShown(0);
    navigate("menu");
    screen = "main";
  });
}

lighthouseSpot.eventMode = "static";
lighthouseSpot.cursor = "pointer";
lighthouseSpot.visible = false;
lighthouseSpot.on("pointerover", () => {
  doorHover = true;
  ocean.setLighthouseHovered(true);
});
lighthouseSpot.on("pointerout", () => {
  if (doorHover && screen === "main") {
    ocean.setLighthouseHovered(false);
  }

  doorHover = false;
});
lighthouseSpot.on("pointertap", () => navigate("lighthouse"));
world.addChildAt(lighthouseSpot, world.getChildIndex(landing));
app.ticker.add(() => {
  const open: boolean = screen === "main" && menuOpen;

  if (screen === "home") {
    placeWorld();
  }

  if (!open && lighthouseSpot.visible && doorHover && screen === "main") {
    ocean.setLighthouseHovered(false);
    doorHover = false;
  }

  lighthouseSpot.visible = open;

  if (open) {
    const bounds: Rectangle = ocean.lighthouseBounds();

    lighthouseSpot.hitArea = new Rectangle(
      bounds.x - doorMargin,
      bounds.y - doorMargin,
      bounds.width + doorMargin * 2,
      bounds.height + doorMargin * 2,
    );
  }
});

onUnlock((achievement: Achievement) =>
  toast.show("Achievement  ·  " + achievement.name),
);

screenLayer.addChild(home.view, help.view, toast.view);

function takeScreenshot(): void {
  const capture: HTMLCanvasElement = app.renderer.extract.canvas(
    app.stage,
  ) as HTMLCanvasElement;
  const stamp: string = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, "-");

  capture.toBlob((blob: Blob | null) => {
    if (blob === null) {
      toast.show("Could not take a screenshot");
      return;
    }

    const link: HTMLAnchorElement = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "geregnet-" + stamp + ".png";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), revokeDelay);
    toast.show("Screenshot saved");
  }, "image/png");
}

window.addEventListener(
  "keydown",
  (event: KeyboardEvent) => {
    if (
      !event.altKey ||
      (event.code !== "Enter" && event.code !== "NumpadEnter")
    ) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!event.repeat) {
      setFullscreen(!getFullscreen());
    }
  },
  true,
);

function toggleMute(): void {
  const master: number = getVolume("master");

  if (master > 0) {
    try {
      localStorage.setItem(unmuteStorageKey, String(master));
    } catch {
      console.warn("Could not save the volume to restore");
    }

    setVolume("master", 0);
    toast.show("Sound off");
    return;
  }

  let restore: number = unmuteDefault;

  try {
    const saved: number = Number(localStorage.getItem(unmuteStorageKey));

    restore = saved > 0 && saved <= 1 ? saved : unmuteDefault;
  } catch {
    restore = unmuteDefault;
  }

  setVolume("master", restore);
  toast.show("Sound on");
}

window.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.repeat) {
    return;
  }

  if (event.code === screenshotKey) {
    takeScreenshot();
  } else if (event.code === muteKey) {
    toggleMute();
  } else {
    return;
  }

  event.preventDefault();
});

function helpTopic(): Topic | null {
  if (screen === "main") {
    return "menu";
  }

  if (screen === "playing") {
    return "play";
  }

  if (screen === "home") {
    return "lighthouse";
  }

  if (screen === "page" && currentPage !== null) {
    return currentPage.content?.topic?.() ?? null;
  }

  return null;
}

function helpSubject(topic: Topic): string {
  if (screen === "playing") {
    return playfield.subject();
  }

  if (screen === "home") {
    return home.subject();
  }

  if (screen === "page" && currentPage !== null) {
    return currentPage.content?.subject?.() ?? topic;
  }

  return topic;
}

window.addEventListener(
  "keydown",
  (event: KeyboardEvent) => {
    const asked: boolean =
      event.code === helpKey &&
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.repeat;
    const topic: Topic | null = helpTopic();

    if (help.shown()) {
      if (asked || event.key === "Escape") {
        help.close();
      } else if (!help.key(event)) {
        return;
      }
    } else if (asked && topic !== null) {
      const subject: string = helpSubject(topic);

      if (screen === "playing") {
        playfield.hold();
      }

      help.open(topic, subject);
    } else {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  },
  true,
);

window.addEventListener("keydown", (event: KeyboardEvent) => {
  if (!event.altKey || event.code !== "KeyR" || event.repeat) {
    return;
  }

  event.preventDefault();

  if (window.confirm(resetWarning)) {
    void resetApp();
  }
});

window.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape" && screen === "page" && currentPage !== null) {
    const page: Page = currentPage;

    if (page.content?.back?.() === true) {
      return;
    }

    rise(() => hidePage(app.ticker, page), hideTime(page));
    return;
  }

  if (event.key === "Escape" && screen === "playing" && !playfield.back()) {
    rise(playfield.hide, playfield.hideDuration());
    return;
  }

  if (event.key === "Escape" && screen === "credits") {
    closeCredits();
    return;
  }

  if (event.key === "Escape" && screen === "home") {
    if (!home.back()) {
      leaveHome();
    }

    return;
  }

  if (event.key === "Escape" && screen === "main") {
    returnToLanding();
    return;
  }

  if (
    screen === "landing" &&
    booting &&
    terminal.finished() &&
    event.isTrusted &&
    !event.repeat &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  ) {
    leaveTerminal();
    return;
  }

  if (event.key === "Escape" && screen === "landing" && !booting) {
    enterTerminal();
  }
});

function closeCredits(): void {
  screen = "rising";
  credits
    .close()
    .then(() => {
      buttons.visible = true;
      setSurfacesActive(true);
      ocean.setWitchShown(true);
      return enterButtons(app.ticker);
    })
    .then(() => {
      navigate("menu");
      screen = "main";
    });
}

function returnToLanding(): void {
  screen = "outro";
  scape = "landing";
  menuOpen = false;
  setButtonsActive(false);
  menu.interactiveChildren = false;
  setSurfacesActive(false);
  setLandingEnabled(landing, false);

  const ring: RingStyle = {
    color: landingRing.color,
    width: landingRing.width,
    glow: landingRing.glow,
    brightness: 1,
  };

  moveLogoToCenter(app.ticker, revealDuration, revealEasing);
  rippleReveal(
    app.ticker,
    world,
    app.screen,
    landingCircle(),
    ring,
    revealDuration,
    revealEasing,
    true,
    setPortal,
    () => {
      menu.visible = false;
      showLandingRing();
    },
  ).then(() => {
    menu.visible = true;
    buttons.visible = true;
    resetButtons();
    ocean.resetBeam();
    peek.value = 1;
    peek.velocity = 0;
    showThroughRing();
    setLandingEnabled(landing, true);
    screen = "landing";
  });
}

function settleIntro(terminalShown: boolean): void {
  booting = terminalShown;
  setLandingEnabled(landing, !terminalShown);
  screen = "landing";
}

function morphTerminal(terminalShown: boolean): void {
  screen = "intro";
  setLandingEnabled(landing, false);
  peek.value = 0;
  peek.velocity = 0;
  tween(app.ticker, zoomDuration, (progress: number) => {
    const eased: number = zoomEasing(progress);
    const amount: number = terminalShown ? eased : 1 - eased;

    setIntroFrame(amount);
    surroundIntro(amount);
    ascii.fade(amount);
    terminal.fade(amount);
    showThroughRing();
  }).then(() => settleIntro(terminalShown));
}

function enterTerminal(): void {
  scape = "terminal";
  morphTerminal(true);
}

function leaveTerminal(): void {
  soundscape.start();
  scape = "landing";
  morphTerminal(false);
}

app.canvas.addEventListener("pointerdown", () => {
  if (screen === "landing" && booting && terminal.finished()) {
    leaveTerminal();
  }
});

startGamepad(
  app.ticker,
  () => {
    if (screen !== "landing" || (booting && !terminal.finished())) {
      return false;
    }

    document.dispatchEvent(
      new CustomEvent<string>("navigate", { detail: "start" }),
    );
    return true;
  },
  () => {
    if (padPrompt || screen !== "landing" || !booting) {
      return;
    }

    padPrompt = true;
    startPrompt("PRESS A TO START.");
  },
);

document.addEventListener("navigate", (event: Event) => {
  const name: string = (event as CustomEvent<string>).detail;

  if (name === "start" && booting) {
    leaveTerminal();
    return;
  }

  if (name === "start") {
    const ring: RingStyle = {
      color: landingRing.color,
      width: landingRing.width,
      glow: landingRing.glow,
      brightness: landingBrightness(),
    };

    screen = "intro";
    scape = "menu";
    menu.visible = true;
    buttons.visible = true;
    menu.interactiveChildren = true;
    setSurfacesActive(true);

    enterButtons(app.ticker);
    moveLogoToCorner(app.ticker, revealDuration, revealEasing);
    setLandingEnabled(landing, false);
    rippleReveal(
      app.ticker,
      world,
      app.screen,
      landingCircle(),
      ring,
      revealDuration,
      revealEasing,
      false,
      setPortal,
      () => undefined,
    ).then(() => {
      screen = "main";
      navigate("menu");
    });
    return;
  }

  if (name === "menu") {
    buttons.visible = true;
    menuOpen = true;
    setButtonsActive(true);
    setLandingEnabled(landing, true);
    return;
  }

  if (!menuOpen) {
    return;
  }

  if (name === "landing") {
    if (screen === "main") {
      returnToLanding();
    }

    return;
  }

  menuOpen = false;
  setButtonsActive(false);
  setLandingEnabled(landing, false);

  if (name === "play") {
    play();
    return;
  }

  if (name === "lighthouse") {
    enterHome();
    return;
  }

  if (name === "credits") {
    screen = "diving";
    setSurfacesActive(false);
    ocean.retractBeam();
    leaveButtons(app.ticker).then(() => {
      buttons.visible = false;
    });
    ocean.setWitchShown(false);
    wait(beamRetractTime).then(() => {
      screen = "credits";
      credits.open();
    });
    return;
  }

  const page: Page | undefined = pages.get(name);

  if (page !== undefined) {
    openPage(page, name);
    return;
  }

  fadeOut(app.ticker, buttons, 300).then(() => {
    container.dispatchEvent(new CustomEvent<string>("open", { detail: name }));
  });
});

function currentPlace(): string | null {
  if (screen === "landing") {
    return booting ? "terminal" : "landing";
  }

  if (screen === "main") {
    return menuOpen ? "main" : null;
  }

  if (screen === "page") {
    return pageName;
  }

  if (screen === "playing") {
    return "play";
  }

  if (screen === "credits") {
    return "credits";
  }

  if (screen === "home") {
    return "lighthouse";
  }

  return null;
}

function endRoute(): void {
  route = null;
  app.ticker.speed = 1;
}

function routeTo(target: string): void {
  route = target;
  routeStart = performance.now();
  routeBacks = 0;
  app.ticker.speed = routeSpeed;
}

function stepRoute(): void {
  if (route === null) {
    return;
  }

  const place: string | null = currentPlace();

  if (performance.now() - routeStart > routeLimit || place === route) {
    endRoute();
    return;
  }

  if (place === null) {
    return;
  }

  if (place === "terminal") {
    if (terminal.finished()) {
      leaveTerminal();
    }

    return;
  }

  if (place === "landing") {
    if (route === "terminal") {
      enterTerminal();
    } else {
      navigate("start");
    }

    return;
  }

  if (place === "main") {
    if (route === "landing" || route === "terminal") {
      returnToLanding();
    } else {
      navigate(route);
    }

    return;
  }

  if (place === "play") {
    rise(playfield.hide, playfield.hideDuration());
    return;
  }

  if (place === "credits") {
    closeCredits();
    return;
  }

  if (place === "lighthouse") {
    leaveHome();
    return;
  }

  const page: Page = currentPage!;

  if (routeBacks < backLimit && page.content?.back?.() === true) {
    routeBacks++;
    return;
  }

  rise(() => hidePage(app.ticker, page), hideTime(page));
}

app.ticker.add(stepRoute);
