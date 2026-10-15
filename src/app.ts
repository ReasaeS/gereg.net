import {
  Application,
  Container,
  Graphics,
  Texture,
  UPDATE_PRIORITY,
  type BindGroup,
  type Rectangle,
  type Ticker,
} from "pixi.js";
import {
  createButtons,
  buttonFaces,
  resetButtons,
  enterButtons,
  setButtonsActive,
  selectedPoint,
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
import { createMaker } from "./create/maker";
import { createGuides } from "./dev/guides";
import { resetApp } from "./dev/reset";
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
  showLandingRing,
  landingRing,
} from "./menu/landing";
import { pixelRatio, viewScale } from "./ui/density";
import { createTerminal, type Terminal } from "./menu/terminal";
import { formatPlaytime, playtime } from "./settings/playtime";
import { createAscii, type Ascii } from "./effects/ascii/ascii";
import { createCrt, type Crt } from "./effects/crt/crt";
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
import { getTheme } from "./theme/theme";
import { startMotion } from "./ui/motion";
import { startGamepad } from "./game/gamepad";

const rainEnabled: boolean = true;
const resetWarning: string =
  "Reset GEREG.NET to its out of the box state? Everything you have made and every setting will be lost.";
const revealDuration: number = 500; // ms
const revealEasing: Easing = cubicBezier(0.3, 0, 0.25, 1);
const peekSmoothing: number = 0.12; // s
const diveDuration: number = 850; // ms
const diveEasing: Easing = cubicBezier(0.55, 0, 0.25, 1);
const diveFlip: number = -Math.PI; // rad
const transitionLead: number = 200; // ms
const terminalColor: string = "#000000";
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
];
const zoomDuration: number = 1100; // ms
const zoomEasing: Easing = cubicBezier(0.45, 0, 0.35, 1);

const container: HTMLDivElement = document.getElementById(
  "app",
) as HTMLDivElement;
const app: Application = new Application();

await app.init({
  width: window.innerWidth * viewScale(),
  height: window.innerHeight * viewScale(),
  background: getTheme().outside,
  antialias: true,
  autoDensity: false,
  resolution: pixelRatio,
});

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

window.addEventListener("resize", () => {
  releaseFilterInput();
  app.renderer.resize(
    window.innerWidth * viewScale(),
    window.innerHeight * viewScale(),
  );
});
startMotion(app.ticker);
bindLanding(app);

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

screenLayer.addChild(introBackdrop, world, introFrame, terminal.view);
app.stage.addChild(screenLayer, createGuides(app));
surroundIntro(1);
app.renderer.on("resize", () => surroundIntro(introSurround));

const ascii: Ascii = createAscii(app, world, introBounds);
const crt: Crt = createCrt(app, screenLayer, introBounds);

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

terminal.progress(rainEnabled ? 8 : 7);

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

const menu: Container = new Container();
const buttons: Container = await load(() => createButtons(app));
menu.addChild(buttons);

const landing: Container = await load(() => createLanding(app));

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

const pageNames: Array<string> = ["customise", "create", "config"];
const pages: Map<string, Page> = new Map();

vivid.addChild(menu);

const pageContents: Map<string, PageContent> = new Map([
  ["customise", await load(() => createEditor(app))],
  ["create", await load(() => createMaker(app))],
  ["config", await load(() => createSettings(app))],
]);

for (let index = 0; index < pageNames.length; index++) {
  const name: string = pageNames[index]!;
  const page: Page = createPage(app, name, pageContents.get(name) ?? null);
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
  | "playing";

let menuOpen: boolean = false;
let currentPage: Page | null = null;
let screen: Screen = "landing";
let booting: boolean = true;

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
  currentPage = page;
  dive(name, () => showPage(app.ticker, page), "page");
}

function play(): void {
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

function returnToLanding(): void {
  screen = "outro";
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
    crt.fade(amount);
    terminal.fade(amount);
    showThroughRing();
  }).then(() => settleIntro(terminalShown));
}

function enterTerminal(): void {
  morphTerminal(true);
}

function leaveTerminal(): void {
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

  const page: Page | undefined = pages.get(name);

  if (page !== undefined) {
    openPage(page, name);
    return;
  }

  fadeOut(app.ticker, buttons, 300).then(() => {
    container.dispatchEvent(new CustomEvent<string>("open", { detail: name }));
  });
});
