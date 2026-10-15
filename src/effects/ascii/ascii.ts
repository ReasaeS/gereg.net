import {
  Color,
  Container,
  Filter,
  GlProgram,
  Rectangle,
  Text,
  type Application,
  type Texture,
} from "pixi.js";
import { createGlide, type Glide } from "../../ui/motion";
import { filterVertex } from "../filter/vertex";

type Ascii = {
  set: (on: boolean) => void;
  snap: (on: boolean) => void;
  fade: (value: number) => void;
};

const glyphs: string = " .:-=+*#%@";
const cellWidth: number = 8; // px
const cellHeight: number = 14; // px
const glyphSize: number = 13; // px
const inkColor: string = "#cfeeff";
const asciiSmoothing: number = 0.15; // s
const monoFamily: Array<string> = [
  "JetBrains Mono",
  "Cascadia Mono",
  "Consolas",
  "Menlo",
  "monospace",
];

const fragment: string = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uGlyphs;
uniform highp vec4 uInputSize;
uniform vec2 uCell;
uniform vec2 uOrigin;
uniform float uCount;
uniform float uMix;
uniform vec3 uInk;

vec4 brighter(vec4 first, vec4 second)
{
    return max(first.r, max(first.g, first.b)) >= max(second.r, max(second.g, second.b))
        ? first
        : second;
}

void main(void)
{
    vec4 original = texture(uTexture, vTextureCoord);
    vec2 pixel = vTextureCoord * uInputSize.xy;
    vec2 origin = floor((pixel - uOrigin) / uCell) * uCell + uOrigin;
    vec4 color = brighter(
        brighter(
            texture(uTexture, (origin + uCell * vec2(0.25, 0.25)) * uInputSize.zw),
            texture(uTexture, (origin + uCell * vec2(0.75, 0.25)) * uInputSize.zw)
        ),
        brighter(
            texture(uTexture, (origin + uCell * vec2(0.25, 0.75)) * uInputSize.zw),
            texture(uTexture, (origin + uCell * vec2(0.75, 0.75)) * uInputSize.zw)
        )
    );

    float light = pow(max(color.r, max(color.g, color.b)), 0.75);
    float level = floor(clamp(light, 0.0, 0.999) * uCount);
    vec2 local = (pixel - origin) / uCell;
    float glyph = texture(uGlyphs, vec2((level + local.x) / uCount, local.y)).a;
    vec3 tint = uInk * mix(0.45, 1.0, light);

    finalColor = mix(original, vec4(tint * glyph, 1.0), uMix);
}
`;

function createAtlas(app: Application, resolution: number): Texture {
  const strip: Container = new Container();

  for (let index = 0; index < glyphs.length; index++) {
    const glyph: Text = new Text({
      text: glyphs[index]!,
      style: { fontFamily: monoFamily, fontSize: glyphSize, fill: "#ffffff" },
    });

    glyph.anchor.set(0.5);
    glyph.position.set((index + 0.5) * cellWidth, cellHeight / 2);
    strip.addChild(glyph);
  }

  const texture: Texture = app.renderer.generateTexture({
    target: strip,
    frame: new Rectangle(0, 0, glyphs.length * cellWidth, cellHeight),
    resolution: resolution,
  });

  strip.destroy({ children: true });

  return texture;
}

function createAscii(
  app: Application,
  target: Container,
  frame: () => Rectangle,
): Ascii {
  let resolution: number = app.renderer.resolution;
  let atlas: Texture = createAtlas(app, resolution);
  const filter: Filter = new Filter({
    glProgram: GlProgram.from({
      vertex: filterVertex,
      fragment: fragment,
      name: "ascii-filter",
    }),
    resources: {
      asciiUniforms: {
        uCell: { value: new Float32Array(2), type: "vec2<f32>" },
        uOrigin: { value: new Float32Array(2), type: "vec2<f32>" },
        uCount: { value: glyphs.length, type: "f32" },
        uMix: { value: 1, type: "f32" },
        uInk: { value: new Color(inkColor).toRgbArray(), type: "vec3<f32>" },
      },
      uGlyphs: atlas.source,
    },
    resolution: resolution,
  });
  const amount: Glide = createGlide(
    1,
    (value: number) => {
      filter.resources["asciiUniforms"].uniforms.uMix = value;
      target.filters = value > 0 ? [filter] : null;
    },
    asciiSmoothing,
  );

  function layout(): void {
    const uniforms: Record<string, Float32Array> = filter.resources[
      "asciiUniforms"
    ].uniforms as Record<string, Float32Array>;

    if (resolution !== app.renderer.resolution) {
      const old: Texture = atlas;

      resolution = app.renderer.resolution;
      filter.resolution = resolution;
      atlas = createAtlas(app, resolution);
      filter.resources["uGlyphs"] = atlas.source;
      old.destroy(true);
    }
    uniforms["uCell"]!.set([cellWidth, cellHeight]);
    uniforms["uOrigin"]!.set([frame().x, frame().y]);
  }

  target.filterArea = app.screen;
  target.filters = [filter];
  layout();
  app.ticker.add(layout);

  return {
    set: (on: boolean) => amount.set(on ? 1 : 0),
    snap: (on: boolean) => amount.snap(on ? 1 : 0),
    fade: (value: number) => amount.snap(value),
  };
}

export { inkColor, createAscii };
export type { Ascii };
