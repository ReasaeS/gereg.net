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

type Crt = {
  set: (on: boolean) => void;
  snap: (on: boolean) => void;
  fade: (value: number) => void;
};

const scanlineSpacing: number = 3; // px
const scanlineDepth: number = 0.28;
const fringe: number = 1.2; // px
const glowReach: number = 2.5; // px
const glowStrength: number = 0.35;
const flickerStrength: number = 0.025;
const flickerRate: number = 9; // Hz
const crtSmoothing: number = 0.15; // s

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

vec4 sampleAt(vec2 local)
{
    return texture(uTexture, (uFrame.xy + local * uFrame.zw) * uInputSize.zw);
}

void main(void)
{
    vec4 original = texture(uTexture, vTextureCoord);
    vec2 pixel = vTextureCoord * uInputSize.xy;
    vec2 local = (pixel - uFrame.xy) / uFrame.zw;

    if (local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0)
    {
        finalColor = original;
        return;
    }

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

    color = (color + glow * uGlowStrength) * scan * uFlicker;
    finalColor = mix(original, vec4(color, 1.0), uMix);
}
`;

function createCrt(
  app: Application,
  target: Container,
  frame: () => Rectangle,
): Crt {
  const resolution: number = app.renderer.resolution;
  const filter: Filter = new Filter({
    glProgram: GlProgram.from({
      vertex: filterVertex,
      fragment: fragment,
      name: "crt-filter",
    }),
    resources: {
      crtUniforms: {
        uFrame: { value: new Float32Array(4), type: "vec4<f32>" },
        uScan: { value: scanlineSpacing * resolution, type: "f32" },
        uScanDepth: { value: scanlineDepth, type: "f32" },
        uFringe: { value: fringe * resolution, type: "f32" },
        uGlow: { value: glowReach * resolution, type: "f32" },
        uGlowStrength: { value: glowStrength, type: "f32" },
        uFlicker: { value: 1, type: "f32" },
        uMix: { value: 1, type: "f32" },
      },
    },
    resolution: resolution,
  });
  const uniforms: Record<string, number | Float32Array> = filter.resources[
    "crtUniforms"
  ].uniforms as Record<string, number | Float32Array>;
  const amount: Glide = createGlide(
    1,
    (value: number) => {
      uniforms["uMix"] = value;
      target.filters = value > 0 ? [filter] : null;
    },
    crtSmoothing,
  );
  let time: number = 0;

  function layout(): void {
    const bounds: Rectangle = frame();

    (uniforms["uFrame"] as Float32Array).set([
      bounds.x * resolution,
      bounds.y * resolution,
      bounds.width * resolution,
      bounds.height * resolution,
    ]);
  }

  target.filterArea = app.screen;
  target.filters = [filter];
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

  return {
    set: (on: boolean) => amount.set(on ? 1 : 0),
    snap: (on: boolean) => amount.snap(on ? 1 : 0),
    fade: (value: number) => amount.snap(value),
  };
}

export { createCrt };
export type { Crt };
