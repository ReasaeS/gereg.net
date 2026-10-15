import {
  Color,
  Circle as HitCircle,
  ColorMatrixFilter,
  Container,
  Rectangle,
  Sprite,
  type Application,
  type Texture,
  type Ticker,
} from "pixi.js";
import { navigate } from "./options";
import { loadLogo, trackLogo } from "../ui/logo";
import { onTheme, type Theme } from "../theme/theme";
import { createRing, type Ring, type RingStyle } from "../effects/ring/ring";
import type { Circle } from "../effects/reveal/reveal";
import {
  smoothDamp,
  tween,
  type Easing,
  type Spring,
} from "../effects/tween/tween";

const logoViewWidth: number = 508.9;
const logoViewHeight: number = 290;
const glyphLeft: number = 55;
const glyphTop: number = 55;
const glyphWidth: number = 373.3;
const glyphHeight: number = 180;
const ringClearance: number = 1.08;
const circleWidth: number = 32; // vw
const circleMaxWidth: number = 500; // px
const circleMaxHeight: number = 70; // vh
const circleBorder: number = 4; // px
const introShare: number = 0.8; // of screen size
const logoColor: string = "#3232ff";

const circleGlow: number = 24; // px
const cornerMargin: number = 24; // px
const cornerGlyphWidth: number = 160; // px
const hoverSmoothing: number = 0.12; // s
const hoverBrightness: number = 1.3;
const logoBoost: number = 1.6;

type Placement = {
  x: number;
  y: number;
  width: number;
};

const landingRing: RingStyle = {
  color: logoColor,
  width: circleBorder,
  glow: circleGlow,
  brightness: 1,
};

let app: Application | null = null;
let ring: Ring | null = null;
let ringSize: number = 0;
let hovered: boolean = false;
const hover: Spring = { value: 0, velocity: 0 };
let corner: number = 0;
let frameAmount: number = 1;
let glideBrightness: number = 1;

function introBounds(): Rectangle {
  const width: number = app?.screen.width ?? 0;
  const height: number = app?.screen.height ?? 0;
  const share: number = 1 + (introShare - 1) * frameAmount;

  return new Rectangle(
    Math.round((width * (1 - share)) / 2),
    Math.round((height * (1 - share)) / 2),
    Math.round(width * share),
    Math.round(height * share),
  );
}

function bindLanding(application: Application): void {
  app = application;
}

function setIntroFrame(amount: number): void {
  frameAmount = amount;
}

function landingCircle(): Circle {
  const width: number = app?.screen.width ?? 0;
  const height: number = app?.screen.height ?? 0;
  const full: number = Math.min(
    (width * circleWidth) / 100,
    circleMaxWidth,
    (height * circleMaxHeight) / 100,
  );
  const framed: number = Math.min(
    (width * introShare * circleWidth) / 100,
    (height * introShare * circleMaxHeight) / 100,
  );

  return {
    x: width / 2,
    y: height / 2,
    radius: (full + (framed - full) * frameAmount) / 2,
  };
}

function landingHovered(): boolean {
  return hovered;
}

function hoverLevel(): number {
  return 1 + (hoverBrightness - 1) * hover.value;
}

function landingBrightness(): number {
  return logoBoost * hoverLevel();
}

function centerPlacement(circle: Circle): Placement {
  const ringDiameter: number =
    Math.hypot(glyphWidth, glyphHeight) * ringClearance;
  const glyphOffset: number =
    (logoViewWidth / 2 - (glyphLeft + glyphWidth / 2)) / logoViewWidth;
  const width: number = (logoViewWidth / ringDiameter) * circle.radius * 2;
  const height: number = (width * logoViewHeight) / logoViewWidth;

  return {
    x: circle.x - width / 2 + glyphOffset * width,
    y: circle.y - height / 2,
    width: width,
  };
}

function cornerPlacement(): Placement {
  const scale: number = cornerGlyphWidth / glyphWidth;

  return {
    x: cornerMargin - glyphLeft * scale,
    y: cornerMargin - glyphTop * scale,
    width: logoViewWidth * scale,
  };
}

function cornerArea(): Rectangle {
  const scale: number = cornerGlyphWidth / glyphWidth;

  return new Rectangle(
    cornerMargin,
    cornerMargin,
    cornerGlyphWidth,
    glyphHeight * scale,
  );
}

function brighten(
  target: Container,
  filters: Array<ColorMatrixFilter>,
  brightness: number,
): void {
  if (brightness === 1) {
    target.filters = null;
    return;
  }

  filters[0]!.brightness(brightness, false);
  target.filters = filters;
}

async function createLanding(application: Application): Promise<Container> {
  app = application;

  const texture: Texture = await loadLogo();

  const view: Container = new Container();
  const logo: Sprite = new Sprite(texture);

  trackLogo(logo);
  const ringFilters: Array<ColorMatrixFilter> = [new ColorMatrixFilter()];
  const logoTint: ColorMatrixFilter = new ColorMatrixFilter();
  const logoBright: ColorMatrixFilter = new ColorMatrixFilter();
  const currentRing: Ring = createRing(landingRing);
  ring = currentRing;

  view.addChild(currentRing.view);
  view.addChild(logo);
  logo.filters = [logoTint, logoBright];

  onTheme((theme: Theme) => {
    const [red, green, blue] = new Color(theme.ring).toRgbArray() as [
      number,
      number,
      number,
    ];

    landingRing.color = theme.ring;
    ringSize = 0;
    logoTint.matrix = [
      0,
      0,
      0,
      0,
      red,
      0,
      0,
      0,
      0,
      green,
      0,
      0,
      0,
      0,
      blue,
      0,
      0,
      0,
      1,
      0,
    ];
  });
  view.eventMode = "static";
  view.cursor = "pointer";
  view.interactiveChildren = false;

  view.on("pointerover", () => {
    hovered = true;
  });
  view.on("pointerout", () => {
    hovered = false;
  });
  view.on("pointertap", () => navigate(corner === 0 ? "start" : "landing"));

  application.ticker.add((ticker: Ticker) => {
    smoothDamp(hover, hovered ? 1 : 0, hoverSmoothing, ticker.deltaMS / 1000);

    const circle: Circle = landingCircle();
    view.hitArea =
      corner === 0
        ? new HitCircle(circle.x, circle.y, circle.radius)
        : cornerArea();

    if (circle.radius !== ringSize) {
      currentRing.setCircle(0, 0, circle.radius - circleBorder / 2);
      ringSize = circle.radius;
    }

    currentRing.view.position.set(circle.x, circle.y);
    brighten(currentRing.view, ringFilters, landingBrightness());

    const from: Placement = centerPlacement(circle);
    const to: Placement = cornerPlacement();
    logo.position.set(
      from.x + (to.x - from.x) * corner,
      from.y + (to.y - from.y) * corner,
    );
    logo.width = from.width + (to.width - from.width) * corner;
    logo.height = (logo.width * logoViewHeight) / logoViewWidth;
    logoBright.brightness(
      corner === 0
        ? landingBrightness()
        : corner === 1
          ? hoverLevel()
          : glideBrightness,
      false,
    );
  });

  return view;
}

function setLandingEnabled(view: Container, enabled: boolean): void {
  view.eventMode = enabled ? "static" : "none";

  if (!enabled) {
    hovered = false;
  }
}

function moveLogoToCorner(
  ticker: Ticker,
  duration: number,
  easing: Easing,
): Promise<void> {
  const from: number = landingBrightness();

  if (ring !== null) {
    ring.view.visible = false;
  }

  return tween(ticker, duration, (progress: number) => {
    corner = easing(progress);
    glideBrightness = from + (1 - from) * corner;
  });
}

function moveLogoToCenter(
  ticker: Ticker,
  duration: number,
  easing: Easing,
): Promise<void> {
  const from: number = hoverLevel();

  return tween(ticker, duration, (progress: number) => {
    corner = easing(1 - progress);
    glideBrightness = from + (landingBrightness() - from) * easing(progress);
  });
}

function showLandingRing(): void {
  if (ring !== null) {
    ring.view.visible = true;
  }
}

export {
  logoColor,
  introBounds,
  bindLanding,
  setIntroFrame,
  createLanding,
  setLandingEnabled,
  landingCircle,
  landingHovered,
  landingBrightness,
  moveLogoToCorner,
  moveLogoToCenter,
  showLandingRing,
  landingRing,
};
