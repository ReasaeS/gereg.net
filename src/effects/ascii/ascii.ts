import {
  Container,
  Filter,
  GlProgram,
  Rectangle,
  Text,
  type Application,
  type Texture,
} from "pixi.js";
import { createGlide, type Glide } from "../../ui/motion";

type Ascii = {
  set: (on: boolean) => void;
};

const glyphs: string = " .:-=+*#%@";
const cellWidth: number = 8; // px
const cellHeight: number = 14; // px
const glyphSize: number = 13; // px
const asciiSmoothing: number = 0.15; // s
const monoFamily: Array<string> = [
  "JetBrains Mono",
  "Cascadia Mono",
  "Consolas",
  "Menlo",
  "monospace",
];

const vertex: string = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;

    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

const fragment: string = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uGlyphs;
uniform highp vec4 uInputSize;
uniform vec2 uCell;
uniform float uCount;
uniform float uMix;

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
    vec2 origin = floor(pixel / uCell) * uCell;
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
    float peak = max(max(color.r, color.g), max(color.b, 0.25));
    vec3 tint = color.rgb / peak * mix(0.55, 1.0, light);

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

function createAscii(app: Application, target: Container): Ascii {
  const resolution: number = app.renderer.resolution;
  const filter: Filter = new Filter({
    glProgram: GlProgram.from({
      vertex: vertex,
      fragment: fragment,
      name: "ascii-filter",
    }),
    resources: {
      asciiUniforms: {
        uCell: {
          value: new Float32Array([
            cellWidth * resolution,
            cellHeight * resolution,
          ]),
          type: "vec2<f32>",
        },
        uCount: { value: glyphs.length, type: "f32" },
        uMix: { value: 1, type: "f32" },
      },
      uGlyphs: createAtlas(app, resolution).source,
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

  target.filterArea = app.screen;
  target.filters = [filter];

  return { set: (on: boolean) => amount.set(on ? 1 : 0) };
}

export { createAscii };
export type { Ascii };
