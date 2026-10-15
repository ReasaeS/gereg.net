import {
  Filter,
  GlProgram,
  type Application,
  type Container,
  type Rectangle,
  type Ticker,
} from "pixi.js";
import { createGlide, type Glide } from "../../ui/motion";
import { filterVertex } from "../filter/vertex";
import {
  getCrt,
  getTv,
  onCrt,
  onTv,
  onTuning,
  type Tuning,
} from "../../settings/settings";

const scanlineSpacing: number = 3; // px
const maxScanlines: number = 0.6;
const maxFringe: number = 3; // px
const glowReach: number = 2.5; // px
const maxGlow: number = 1;
const maxFlicker: number = 0.1;
const flickerRate: number = 9; // Hz
const crtSmoothing: number = 0.15; // s
const maxCurvature: number = 0.3;
const maxVignette: number = 1;

const fragment: string = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform vec4 uFrame;
uniform float uScan;
uniform float uScanDepth;
uniform float uFringe;
uniform float uGlow;
uniform float uGlowStrength;
uniform float uFlicker;
uniform float uMix;
uniform float uCurve;
uniform float uCurvature;
uniform float uVignette;

vec4 sampleAt(vec2 local)
{
    return texture(uTexture, (uFrame.xy + local * uFrame.zw) * uInputSize.zw);
}

void main(void)
{
    vec4 original = texture(uTexture, vTextureCoord);
    vec2 pixel = vTextureCoord * uInputSize.xy;
    vec2 plain = (pixel - uFrame.xy) / uFrame.zw;

    if (plain.x < 0.0 || plain.y < 0.0 || plain.x > 1.0 || plain.y > 1.0)
    {
        finalColor = original;
        return;
    }

    vec2 centered = plain * 2.0 - 1.0;
    centered *= 1.0 + uCurve * uCurvature * (centered.yx * centered.yx);
    vec2 local = centered * 0.5 + 0.5;

    if (local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0)
    {
        finalColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec4 base = sampleAt(local);
    float edge = 16.0 * local.x * local.y * (1.0 - local.x) * (1.0 - local.y);
    float shade = mix(1.0, pow(edge, uVignette), uCurve);

    vec2 shift = vec2(uFringe / uFrame.z, 0.0);
    vec2 spread = vec2(uGlow / uFrame.z, uGlow / uFrame.w);
    vec3 color = vec3(
        sampleAt(local + shift).r,
        sampleAt(local).g,
        sampleAt(local - shift).b
    );
    vec3 glow = (
        sampleAt(local + vec2(spread.x, 0.0)).rgb +
        sampleAt(local - vec2(spread.x, 0.0)).rgb +
        sampleAt(local + vec2(0.0, spread.y)).rgb +
        sampleAt(local - vec2(0.0, spread.y)).rgb
    ) * 0.25;
    float line = sin(local.y * uFrame.w * 3.14159265 / uScan);
    float scan = 1.0 - uScanDepth * (1.0 - line * line);

    float balance = 1.0 / (1.0 - uScanDepth * 0.5);

    color = (color + max(glow - color, 0.0) * uGlowStrength) * scan * balance * uFlicker;
    finalColor = vec4(mix(base.rgb, color, uMix) * shade, 1.0);
}
`;

function createCrt(
  app: Application,
  target: Container,
  frame: () => Rectangle,
): void {
  const filter: Filter = new Filter({
    glProgram: GlProgram.from({
      vertex: filterVertex,
      fragment: fragment,
      name: "crt-filter",
    }),
    resources: {
      crtUniforms: {
        uFrame: { value: new Float32Array(4), type: "vec4<f32>" },
        uScan: { value: scanlineSpacing, type: "f32" },
        uScanDepth: { value: 0, type: "f32" },
        uFringe: { value: 0, type: "f32" },
        uGlow: { value: glowReach, type: "f32" },
        uGlowStrength: { value: 0, type: "f32" },
        uFlicker: { value: 1, type: "f32" },
        uMix: { value: 1, type: "f32" },
        uCurve: { value: 0, type: "f32" },
        uCurvature: { value: 0, type: "f32" },
        uVignette: { value: 0, type: "f32" },
      },
    },
    resolution: app.renderer.resolution,
    antialias: "inherit",
  });
  const uniforms: Record<string, number | Float32Array> = filter.resources[
    "crtUniforms"
  ].uniforms as Record<string, number | Float32Array>;
  function attach(): void {
    target.filters =
      (uniforms["uMix"] as number) > 0 || (uniforms["uCurve"] as number) > 0
        ? [filter]
        : null;
  }

  const amount: Glide = createGlide(
    getCrt() ? 1 : 0,
    (value: number) => {
      uniforms["uMix"] = value;
      attach();
    },
    crtSmoothing,
  );
  const tv: Glide = createGlide(
    getTv() ? 1 : 0,
    (value: number) => {
      uniforms["uCurve"] = value;
      attach();
    },
    crtSmoothing,
  );
  let time: number = 0;
  let flickerStrength: number = 0;

  function layout(): void {
    const bounds: Rectangle = frame();

    filter.resolution = app.renderer.resolution;

    (uniforms["uFrame"] as Float32Array).set([
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    ]);
  }

  target.filterArea = app.screen;
  amount.snap(getCrt() ? 1 : 0);
  tv.snap(getTv() ? 1 : 0);
  layout();
  app.ticker.add((ticker: Ticker) => {
    layout();

    if (amount.value() === 0) {
      return;
    }

    time += ticker.deltaMS / 1000;
    uniforms["uFlicker"] =
      1 - flickerStrength * (0.5 + 0.5 * Math.sin(time * flickerRate * 6.283));
  });

  onCrt((on: boolean) => amount.set(on ? 1 : 0));
  onTv((on: boolean) => tv.set(on ? 1 : 0));
  onTuning((tuning: Tuning, value: number) => {
    if (tuning === "curvature") {
      uniforms["uCurvature"] = value * maxCurvature;
    } else if (tuning === "vignette") {
      uniforms["uVignette"] = value * maxVignette;
    } else if (tuning === "scanlines") {
      uniforms["uScanDepth"] = value * maxScanlines;
    } else if (tuning === "fringe") {
      uniforms["uFringe"] = value * maxFringe;
    } else if (tuning === "glow") {
      uniforms["uGlowStrength"] = value * maxGlow;
    } else {
      flickerStrength = value * maxFlicker;
    }
  });
}

export { createCrt };
