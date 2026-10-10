import { Application, Container, UPDATE_PRIORITY, type Ticker } from "pixi.js";
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
import { createEditor, playerTexture } from "./editor/editor";
import { createPlayfield, type Playfield } from "./game/playfield";
import { createSettings } from "./settings/panel";
import { createMaker } from "./create/maker";
import { createGuides } from "./dev/guides";
import { resetApp } from "./dev/reset";
import {
  createLanding,
  setLandingEnabled,
  landingCircle,
  landingHovered,
  landingBrightness,
  moveLogoToCorner,
  moveLogoToCenter,
  showLandingRing,
  landingRing,
} from "./menu/landing";
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

const rainEnabled: boolean = true;
const resetWarning: string =
  "Reset geregnet to its out of the box state? Everything you have made and every setting will be lost.";
const revealDuration: number = 500; // ms
const revealEasing: Easing = cubicBezier(0.3, 0, 0.25, 1);
const peekSmoothing: number = 0.12; // s
const diveDuration: number = 850; // ms
const diveEasing: Easing = cubicBezier(0.55, 0, 0.25, 1);
const diveFlip: number = -Math.PI; // rad
const transitionLead: number = 200; // ms

const container: HTMLDivElement = document.getElementById(
  "app",
) as HTMLDivElement;
const app: Application = new Application();

await app.init({
  resizeTo: container,
  background: getTheme().outside,
  antialias: true,
  autoDensity: true,
  resolution: window.devicePixelRatio || 1,
});

container.appendChild(app.canvas);

const city: Container = new Container();
const vivid: Container = new Container();
const cityFront: Container = new Container();
const vividFront: Container = new Container();

city.addChild(createNightSea(app));

const ocean: Vivid = createVivid(app);
ocean.setBeamTarget(selectedPoint);
ocean.setHoverBlocker(menuHovered);
vivid.addChild(ocean.view);

const menu: Container = new Container();
const buttons: Container = await createButtons(app);
menu.addChild(buttons);

const landing: Container = await createLanding(app);

if (rainEnabled) {
  setBulletFloor(ocean.surface);
  setRainFloor(1 - seaHeight / 100);
  onBulletImpact(ocean.absorb);

  const rain: RainLayers = await createRain(app);
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
  ["customise", createEditor(app)],
  ["create", await createMaker(app)],
  ["config", createSettings(app)],
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
const playfield: Playfield = await createPlayfield(app, playerTexture());

app.stage.addChild(
  city,
  vivid,
  landing,
  cityFront,
  vividFront,
  playfield.view,
  createGuides(app),
);
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

  if (event.key !== "Escape" || screen !== "main") {
    return;
  }

  screen = "outro";
  menuOpen = false;
  setButtonsActive(false);
  menu.interactiveChildren = false;
  setSurfacesActive(false);

  const ring: RingStyle = {
    color: landingRing.color,
    width: landingRing.width,
    glow: landingRing.glow,
    brightness: 1,
  };

  moveLogoToCenter(app.ticker, revealDuration, revealEasing);
  rippleReveal(
    app.ticker,
    app.stage,
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
});

document.addEventListener("navigate", (event: Event) => {
  const name: string = (event as CustomEvent<string>).detail;

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
      app.stage,
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
    return;
  }

  if (!menuOpen) {
    return;
  }

  menuOpen = false;
  setButtonsActive(false);

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
