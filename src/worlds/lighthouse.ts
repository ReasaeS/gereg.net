import {
  Container,
  FillGradient,
  Graphics,
  Sprite,
  type Point,
  type Renderer,
  type Texture,
} from "pixi.js";
import { onTheme, type Theme } from "../theme/theme";
import { springStep, type Spring } from "../effects/tween/tween";

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
    .rect(-0.75, towerTop - 28, 1.5, 5)
    .fill(theme.menuSelected);
}

function createLighthouse(
  renderer: Renderer,
  glowTexture: Texture,
): Lighthouse {
  const view: Container = new Container();
  const tower: Graphics = new Graphics();
  const flare: Sprite = new Sprite(glowTexture);
  const beam: Sprite = new Sprite(createBeamTexture(renderer));
  const aim: Spring = { value: 0, velocity: 0 };
  const reach: Spring = { value: 0, velocity: 0 };
  let time: number = 0;

  flare.anchor.set(0.5);
  flare.blendMode = "add";
  beam.anchor.set(0, 0.5);
  beam.blendMode = "add";
  view.addChild(tower, flare);

  onTheme((theme: Theme) => {
    drawTower(tower, theme);
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

    time += delta;

    if (target !== null) {
      const goal: number = Math.atan2(target.y - lampHeight, target.x - lampX);
      const turn: number =
        ((((goal - aim.value) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) -
        Math.PI;

      springStep(aim, aim.value + turn, beamFrequency, beamDamping, delta);
      springStep(
        reach,
        Math.hypot(target.x - lampX, target.y - lampHeight) * beamOvershoot,
        beamFrequency,
        beamDamping,
        delta,
      );
    }

    tower.scale.set(scale);
    tower.position.set(lampX, base + lighthouseSink * scale);
    flare.position.set(lampX, lampHeight);
    flare.width = flareSize;
    flare.height = flareSize;
    flare.alpha =
      flareMinAlpha +
      (flareMaxAlpha - flareMinAlpha) *
        (0.5 + 0.5 * Math.sin(time * flarePulse * Math.PI * 2));
    beam.position.set(lampX + beamOriginX * scale, lampHeight);
    beam.rotation = aim.value;
    beam.scale.set(
      Math.max(reach.value, 0) / beamTextureWidth,
      (width * beamLength * beamThickness) / beamTextureWidth,
    );
  }

  return { view: view, beam: beam, update: update };
}

export { createLighthouse };
export type { Lighthouse };
