import { Application, Container, UPDATE_PRIORITY, type Ticker } from "pixi.js";
import { createButtons, buttonFaces, navigate } from "./menu/options";
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
  type Easing,
  type Spring,
} from "./effects/tween/tween";
import {
  createRain,
  addSurface,
  setSurfacesActive,
  type RainLayers,
} from "./effects/rain/rain";
import { setPortal, addPortalView, startPortal } from "./effects/portal/portal";
import { createVivid } from "./worlds/vivid";

const background: string = "#0b1026";
const rainEnabled: boolean = true;
const revealDuration: number = 500; // ms
const revealEasing: Easing = cubicBezier(0.3, 0, 0.25, 1);
const peekSmoothing: number = 0.12; // s

const container: HTMLDivElement = document.getElementById(
  "app",
) as HTMLDivElement;
const app: Application = new Application();

await app.init({
  resizeTo: container,
  background: background,
  antialias: true,
  autoDensity: true,
  resolution: window.devicePixelRatio || 1,
});

container.appendChild(app.canvas);

const city: Container = new Container();
const vivid: Container = new Container();
const cityFront: Container = new Container();
const vividFront: Container = new Container();

vivid.addChild(createVivid(app));

const menu: Container = new Container();
const buttons: Container = createButtons(app);
menu.addChild(buttons);

const landing: Container = await createLanding(app);

if (rainEnabled) {
  const rain: RainLayers = await createRain(app);
  city.addChild(rain.backRain);
  vivid.addChild(rain.backBullets);
  cityFront.addChild(rain.frontRain);
  vividFront.addChild(rain.frontBullets);

  const faces: Array<Container> = buttonFaces();

  for (let index = 0; index < faces.length; index++) {
    addSurface(faces[index]!);
  }
}

vivid.addChild(menu);
addPortalView(city, true);
addPortalView(vivid, false);
addPortalView(cityFront, true);
addPortalView(vividFront, false);
app.stage.addChild(city, vivid, landing, cityFront, vividFront);
startPortal(app);

type Screen = "landing" | "intro" | "main" | "outro";

let menuOpen: boolean = false;
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

window.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key !== "Escape" || screen !== "main") {
    return;
  }

  screen = "outro";
  menuOpen = false;
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
    return;
  }

  if (!menuOpen) {
    return;
  }

  menuOpen = false;
  fadeOut(app.ticker, buttons, 300).then(() => {
    container.dispatchEvent(new CustomEvent<string>("open", { detail: name }));
  });
});
