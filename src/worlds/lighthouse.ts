import {
  Container,
  FillGradient,
  Graphics,
  Point,
  Rectangle,
  Sprite,
  type Renderer,
  type Texture,
} from "pixi.js";
import { getTheme, onTheme, type Theme } from "../theme/theme";
import { springStep, type Spring } from "../effects/tween/tween";
import { createGlide, mix, type Glide } from "../ui/motion";

type Lighthouse = {
  view: Container;
  beam: Sprite;
  update: (
    width: number,
    height: number,
    base: number,
    target: Point | null,
    delta: number,
  ) => void;
  reset: () => void;
  retract: () => void;
  setHovered: (hovered: boolean) => void;
  bounds: () => Rectangle;
  door: () => Point;
};

const unitHeight: number = 100;
const lighthouseHeight: number = 0.5; // of screen height
const lighthouseX: number = 0.14; // of screen width
const lighthouseSink: number = 4; // units below the waterline
const lampY: number = -90; // units
const beamOriginX: number = 1; // units
const towerBottom: number = 0; // units
const towerTop: number = -80; // units
const towerBottomWidth: number = 26; // units
const towerTopWidth: number = 16; // units
const stripeCount: number = 4;
const towerColor: string = "#ffffff";
const shadeAlpha: number = 0.18;
const windowColor: string = "#fff3b0";
const beamTextureWidth: number = 512; // px
const beamTextureHeight: number = 128; // px
const beamLayers: Array<number> = [1, 0.7, 0.45, 0.25];
const beamLayerAlpha: number = 0.18;
const beamLength: number = 0.9; // of screen width
const beamThickness: number = 0.35;
const beamFrequency: number = 2.5; // Hz
const beamDamping: number = 0.7;
const beamOvershoot: number = 1.15;
const flarePulse: number = 0.4; // Hz
const flareScale: number = 0.6; // of lighthouse height
const flareMinAlpha: number = 0.25;
const flareMaxAlpha: number = 0.9;
const beamCutoffAngle: number = 0.26; // rad from vertical
const beamFadeAngle: number = 0.6; // rad from vertical
const doorBottom: number = -5; // units
const doorHeight: number = 12; // units
const doorWidth: number = 7; // units
const doorGlowSize: number = 0.22; // of lighthouse height
const doorGlowAlpha: number = 0.8;
const doorSmoothing: number = 0.12; // s

function createBeamTexture(renderer: Renderer): Texture {
  const shape: Graphics = new Graphics();
  const middle: number = beamTextureHeight / 2;
  const gradient: FillGradient = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    colorStops: [
      { offset: 0, color: "rgba(255, 255, 255, 1)" },
      { offset: 1, color: "rgba(255, 255, 255, 0)" },
    ],
  });

  for (let index = 0; index < beamLayers.length; index++) {
    const spread: number = middle * beamLayers[index]!;

    shape
      .poly([
        0,
        middle - 2,
        beamTextureWidth,
        middle - spread,
        beamTextureWidth,
        middle + spread,
        0,
        middle + 2,
      ])
      .fill({ fill: gradient, alpha: beamLayerAlpha });
  }

  const texture: Texture = renderer.generateTexture({ target: shape });
  shape.destroy();

  return texture;
}

function drawTower(tower: Graphics, theme: Theme): void {
  const bandHeight: number = (towerBottom - towerTop) / stripeCount;

  function halfWidth(y: number): number {
    const along: number = (y - towerBottom) / (towerTop - towerBottom);

    return (towerBottomWidth + (towerTopWidth - towerBottomWidth) * along) / 2;
  }

  tower.clear();

  for (let band = 0; band < stripeCount; band++) {
    const bottom: number = towerBottom - band * bandHeight;
    const top: number = bottom - bandHeight;

    tower
      .poly([
        -halfWidth(bottom),
        bottom,
        halfWidth(bottom),
        bottom,
        halfWidth(top),
        top,
        -halfWidth(top),
        top,
      ])
      .fill(band % 2 === 0 ? theme.accent : towerColor);
  }

  tower
    .poly([
      0,
      towerBottom,
      halfWidth(towerBottom),
      towerBottom,
      halfWidth(towerTop),
      towerTop,
      0,
      towerTop,
    ])
    .fill({ color: theme.menuSelected, alpha: shadeAlpha })
    .rect(-13, towerTop - 4, 26, 4)
    .fill(theme.menuSelected)
    .rect(-12, towerTop - 9, 1.5, 5)
    .rect(-4.75, towerTop - 9, 1.5, 5)
    .rect(3.25, towerTop - 9, 1.5, 5)
    .rect(10.5, towerTop - 9, 1.5, 5)
    .rect(-13, towerTop - 10, 26, 1.5)
    .fill(theme.menuSelected)
    .rect(-6, towerTop - 16, 12, 12)
    .fill(windowColor)
    .rect(-6, towerTop - 16, 2, 12)
    .rect(4, towerTop - 16, 2, 12)
    .rect(-1, towerTop - 16, 2, 12)
    .fill(theme.menuSelected)
    .moveTo(-8, towerTop - 16)
    .arc(0, towerTop - 16, 8, Math.PI, 0)
    .closePath()
    .fill(theme.accent)
    .rect(-0.75, towerTop - 29, 1.5, 5)
    .fill(theme.menuSelected);
}

function drawDoor(door: Graphics, lit: number): void {
  const theme: Theme = getTheme();
  const half: number = doorWidth / 2;
  const top: number = doorBottom - doorHeight + half;

  door
    .clear()
    .rect(-half - 1.5, doorBottom, doorWidth + 3, 1.5)
    .fill(theme.menuSelected)
    .moveTo(-half, doorBottom)
    .lineTo(-half, top)
    .arc(0, top, half, Math.PI, 0)
    .lineTo(half, doorBottom)
    .closePath()
    .fill(mix(theme.menuSelected, windowColor, lit))
    .stroke({ color: theme.menuSelected, width: 1.2 })
    .circle(half * 0.45, doorBottom - doorHeight * 0.4, 0.7)
    .fill(mix(windowColor, theme.menuSelected, lit));
}

function createLighthouse(
  renderer: Renderer,
  glowTexture: Texture,
): Lighthouse {
  const view: Container = new Container();
  const towerView: Container = new Container();
  const tower: Graphics = new Graphics();
  const door: Graphics = new Graphics();
  const doorGlow: Sprite = new Sprite(glowTexture);
  const flare: Sprite = new Sprite(glowTexture);
  const beam: Sprite = new Sprite(createBeamTexture(renderer));
  const aim: Spring = { value: 0, velocity: 0 };
  const reach: Spring = { value: 0, velocity: 0 };
  let time: number = 0;
  let retracting: boolean = false;
  const lit: Glide = createGlide(
    0,
    (value: number) => {
      drawDoor(door, value);
      doorGlow.alpha = value * doorGlowAlpha;
      doorGlow.visible = value > 0;
    },
    doorSmoothing,
  );

  doorGlow.anchor.set(0.5);
  doorGlow.blendMode = "add";
  doorGlow.tint = windowColor;
  doorGlow.visible = false;
  towerView.addChild(tower, door);
  flare.anchor.set(0.5);
  flare.blendMode = "add";
  beam.anchor.set(0, 0.5);
  beam.blendMode = "add";
  view.addChild(doorGlow, towerView, flare);

  onTheme((theme: Theme) => {
    drawTower(tower, theme);
    drawDoor(door, lit.value());
    flare.tint = theme.light;
    beam.tint = theme.light;
  });

  function update(
    width: number,
    height: number,
    base: number,
    target: Point | null,
    delta: number,
  ): void {
    const scale: number = (height * lighthouseHeight) / unitHeight;
    const lampX: number = width * lighthouseX;
    const lampHeight: number = base + (lighthouseSink + lampY) * scale;
    const flareSize: number = height * lighthouseHeight * flareScale;
    const originX: number =
      lampX + Math.sign(Math.cos(aim.value)) * beamOriginX * scale;

    time += delta;

    if (target !== null) {
      retracting = false;
    } else if (retracting) {
      springStep(reach, 0, beamFrequency, beamDamping, delta);
    }

    if (target !== null) {
      const goal: number = Math.atan2(
        target.y - lampHeight,
        target.x - originX,
      );
      const turn: number =
        ((((goal - aim.value) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) -
        Math.PI;

      springStep(aim, aim.value + turn, beamFrequency, beamDamping, delta);
      springStep(
        reach,
        Math.hypot(target.x - originX, target.y - lampHeight) * beamOvershoot,
        beamFrequency,
        beamDamping,
        delta,
      );
    }

    towerView.scale.set(scale);
    towerView.position.set(lampX, base + lighthouseSink * scale);
    doorGlow.position.set(
      lampX,
      base + (lighthouseSink + doorBottom - doorHeight / 2) * scale,
    );
    doorGlow.width = height * lighthouseHeight * doorGlowSize;
    doorGlow.height = doorGlow.width;
    flare.position.set(lampX, lampHeight);
    flare.width = flareSize;
    flare.height = flareSize;
    flare.alpha =
      flareMinAlpha +
      (flareMaxAlpha - flareMinAlpha) *
        (0.5 + 0.5 * Math.sin(time * flarePulse * Math.PI * 2));
    const facing: number = Math.cos(aim.value);
    const fade: number = Math.min(
      Math.max(
        (Math.asin(Math.min(Math.abs(facing), 1)) - beamCutoffAngle) /
          (beamFadeAngle - beamCutoffAngle),
        0,
      ),
      1,
    );

    beam.position.set(originX, lampHeight);
    beam.rotation = aim.value;
    beam.alpha = fade * fade * (3 - 2 * fade);
    beam.scale.set(
      Math.max(reach.value, 0) / beamTextureWidth,
      (width * beamLength * beamThickness) / beamTextureWidth,
    );
  }

  function reset(): void {
    aim.value = 0;
    aim.velocity = 0;
    reach.value = 0;
    reach.velocity = 0;
    beam.scale.x = 0;
  }

  return {
    view: view,
    beam: beam,
    update: update,
    reset: reset,
    retract: () => {
      retracting = true;
    },
    setHovered: (hovered: boolean) => lit.set(hovered ? 1 : 0),
    bounds: () => towerView.getBounds().rectangle,
    door: () =>
      towerView.toGlobal(
        new Point(0, doorBottom - doorHeight / 2),
        new Point(),
      ),
  };
}

export { createLighthouse };
export type { Lighthouse };
