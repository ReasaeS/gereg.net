import {
  Container,
  FillGradient,
  Graphics,
  Sprite,
  Text,
  type Texture,
} from "pixi.js";
import type {
  Background,
  Bar,
  Character,
  Creations,
  Cutscene,
  Difficulty,
  Enemy,
  Game,
  Keyframe,
  Line,
  Palette,
  Pattern,
  Run,
  Sigil,
  Sound,
  Spell,
  Stage,
  Wallpaper,
} from "../types";
import { placeAlong, solidSpans, wallAngle } from "../geometry";
import { getTexture } from "../images";
import { getTheme } from "../../theme/theme";
import { drawShape } from "../shape";
import { drawSigil, sigilRadius } from "../sigil";
import { drawSound, soundLength } from "../sound";
import { paintWallpaper } from "../wallpaper";
import { drawPalette } from "../palette";
import { castOf, feelingOf, speakerOf } from "../cutscene";
import type { Entry } from "./kinds";
import { difficulties, rarityOf, type Rarity } from "../rarity";
import { gameRuns, gameStages, packLength, runStages } from "../packs";
import { blend, createSerif } from "./style";

const wallpaperScale: number = 0.6;
const dotLimit: number = 24;
const miniWidth: number = 28; // px
const miniHeight: number = 40; // px
const miniGap: number = 6; // px
const miniRadius: number = 4; // px
const miniSize: number = 13; // px
const miniMargin: number = 10; // px
const miniDepth: number = 0.55;

type Mini = {
  color: string;
  fill: string | null;
  label: string;
};

function byId<T extends { id: string }>(
  list: Array<T>,
  id: string | null,
): T | null {
  return list.find((value: T) => value.id === id) ?? null;
}

function contain(sprite: Sprite, texture: Texture, size: number): void {
  sprite.texture = texture;
  sprite.anchor.set(0.5);
  sprite.scale.set(size / Math.max(texture.width, texture.height));
}

function drawBackground(
  art: Container,
  background: Background | null,
  width: number,
  height: number,
): void {
  const sky: Graphics = new Graphics();
  const mask: Graphics = new Graphics()
    .rect(0, 0, width, height)
    .fill(0xffffff);

  if (background === null) {
    sky.rect(0, 0, width, height).fill("#01040f");
    art.addChild(sky);
    return;
  }

  sky.rect(0, 0, width, height).fill(
    new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: background.top },
        { offset: 1, color: background.bottom },
      ],
    }),
  );
  art.addChild(sky);

  const texture: Texture | null = getTexture(background.sprite);

  if (texture !== null) {
    const image: Sprite = new Sprite(texture);

    image.scale.set(width / texture.width);
    image.mask = mask;
    art.addChild(image, mask);
  }
}

function drawPattern(
  art: Container,
  pattern: Pattern,
  width: number,
  height: number,
): void {
  const texture: Texture | null = getTexture(pattern.sprite);
  const dots: Graphics = new Graphics();
  const count: number = Math.min(
    Math.max(Math.round(pattern.count), 1),
    dotLimit,
  );
  const full: boolean = pattern.spread >= 360;
  const radius: number = height * 0.36;
  const size: number = Math.min(Math.max(pattern.size * 0.5, 4), 14);
  const base: number = ((pattern.heading + 90) * Math.PI) / 180;

  if (pattern.frame === "objective") {
    const direction: number = wallAngle(pattern.wall);
    const directionX: number = Math.cos(direction);
    const directionY: number = Math.sin(direction);
    const travel: number = Math.atan2(pattern.velocity.y, pattern.velocity.x);
    const travelX: number = Math.cos(travel);
    const travelY: number = Math.sin(travel);
    const span: number =
      Math.min(width, height) * 0.8 * Math.min(pattern.cover, 1);

    const spans: Array<[number, number]> = solidSpans(pattern);

    for (let index = 0; index < count; index++) {
      const along: number | null = placeAlong(spans, (index + 0.5) / count);

      if (along === null) {
        break;
      }

      const offset: number = -span / 2 + along * span;
      const x: number = width / 2 - directionX * radius - directionY * offset;
      const y: number = height / 2 - directionY * radius + directionX * offset;

      dots
        .moveTo(x, y)
        .lineTo(x + travelX * radius * 0.6, y + travelY * radius * 0.6)
        .stroke({ color: pattern.color, width: 1, alpha: 0.5 })
        .circle(
          x + travelX * radius * 0.6,
          y + travelY * radius * 0.6,
          size / 2,
        )
        .fill(pattern.color);
    }

    art.addChild(dots);
    return;
  }

  for (let index = 0; index < count; index++) {
    const offset: number =
      count === 1
        ? 0
        : full
          ? (index * 360) / count
          : -pattern.spread / 2 + (index * pattern.spread) / (count - 1);
    const angle: number = base + (offset * Math.PI) / 180;
    const x: number = width / 2 + Math.cos(angle) * radius;
    const y: number = height / 2 + Math.sin(angle) * radius;

    if (texture !== null) {
      const bullet: Sprite = new Sprite();

      contain(bullet, texture, size * 2);
      bullet.position.set(x, y);
      bullet.rotation = angle - Math.PI / 2;
      art.addChild(bullet);
    } else {
      dots.circle(x, y, size / 2).fill(pattern.color);
    }
  }

  dots.circle(width / 2, height / 2, 3).fill({ color: "#ffffff", alpha: 0.6 });
  art.addChild(dots);
}

function drawEnemy(
  art: Container,
  enemy: Enemy,
  width: number,
  height: number,
): void {
  const texture: Texture | null = getTexture(enemy.sprite);
  const size: number = height * 0.8;

  if (texture !== null) {
    const sprite: Sprite = new Sprite();

    contain(sprite, texture, size);
    sprite.position.set(width / 2, height / 2);
    art.addChild(sprite);
    return;
  }

  const body: Graphics = new Graphics();

  drawShape(body, enemy.color, size);
  body.position.set(width / 2, height / 2);
  art.addChild(body);
}

function drawSigilArt(
  art: Container,
  sigil: Sigil,
  width: number,
  height: number,
): void {
  const graphics: Graphics = new Graphics();

  drawSigil(graphics, sigil, 0);
  graphics.scale.set((Math.min(width, height) * 0.45) / sigilRadius(sigil));
  graphics.position.set(width / 2, height / 2);
  art.addChild(graphics);
}

function drawSoundArt(
  art: Container,
  sound: Sound,
  width: number,
  height: number,
): void {
  const graphics: Graphics = new Graphics();

  drawSound(graphics, sound, width * 0.8, height * 0.6, getTheme().ring);
  graphics.position.set(width * 0.1, height * 0.2);
  art.addChild(graphics);
}

function drawCharacterArt(
  art: Container,
  character: Character,
  width: number,
  height: number,
): void {
  const texture: Texture | null = getTexture(
    character.emotions[0]?.sprite ?? null,
  );

  drawBackground(art, null, width, height);

  if (texture === null) {
    const figure: Graphics = new Graphics();
    const head: number = height * 0.14;

    figure
      .circle(width / 2, height * 0.38, head)
      .fill({ color: character.color, alpha: 0.8 })
      .roundRect(
        width / 2 - head * 1.6,
        height * 0.38 + head * 1.3,
        head * 3.2,
        height,
        head,
      )
      .fill({ color: character.color, alpha: 0.8 });
    art.addChild(figure);
    return;
  }

  const portrait: Sprite = new Sprite(texture);

  portrait.anchor.set(0.5, 1);
  portrait.scale.set((height * 0.9) / texture.height);
  portrait.position.set(width / 2, height);
  art.addChild(portrait);
}

function drawCutsceneArt(
  art: Container,
  cutscene: Cutscene,
  cast: Array<Character>,
  width: number,
  height: number,
): void {
  const box: Graphics = new Graphics();
  const speakers: Array<Character> = castOf(cutscene, cast);
  const lines: number = Math.min(cutscene.lines.length, 2);

  drawBackground(art, null, width, height);

  for (const character of speakers.slice(0, 1)) {
    const said: Line | undefined = cutscene.lines.find(
      (value: Line) => value.character === character?.id,
    );
    const texture: Texture | null =
      said === undefined
        ? null
        : getTexture(feelingOf(character, said)?.sprite ?? null);

    if (texture === null) {
      continue;
    }

    const portrait: Sprite = new Sprite(texture);

    portrait.anchor.set(0.5, 1);
    portrait.scale.set((height * 0.7) / texture.height);
    portrait.position.set(width * 0.25, height * 0.7);
    art.addChild(portrait);
  }

  box
    .rect(width * 0.08, height * 0.58, width * 0.84, height * 0.3)
    .fill({ color: "#01040f", alpha: 0.82 })
    .stroke({ color: "#ffffff", width: 1, alignment: 1 });

  for (let order = 0; order < lines; order++) {
    box
      .rect(
        width * 0.13,
        height * (0.65 + order * 0.1),
        width * (order === 0 ? 0.6 : 0.4),
        height * 0.04,
      )
      .fill({
        color: speakerOf(cast, cutscene.lines[order]!)?.color ?? "#ffffff",
        alpha: 0.8,
      });
  }

  art.addChild(box);
}

function clockText(seconds: number): string {
  return (
    Math.floor(seconds / 60) +
    ":" +
    String(Math.round(seconds % 60)).padStart(2, "0")
  );
}

function drawMinis(
  art: Container,
  minis: Array<Mini>,
  width: number,
  height: number,
): void {
  const count: number = minis.length;
  const step: number =
    count <= 1
      ? 0
      : Math.min(
          miniWidth + miniGap,
          (width - miniMargin * 2 - miniWidth) / (count - 1),
        );
  const left: number = width / 2 - ((count - 1) * step + miniWidth) / 2;
  const top: number = height / 2 - miniHeight / 2;

  for (let index = 0; index < count; index++) {
    const mini: Mini = minis[index]!;
    const card: Graphics = new Graphics();
    const label: Text = createSerif(miniSize, "#ffffff");
    const x: number = left + index * step;

    card
      .roundRect(x, top, miniWidth, miniHeight, miniRadius)
      .fill({
        color:
          mini.fill === null ? "#01040f" : blend(mini.fill, mini.color, 0.25),
        alpha: mini.fill === null ? 0.6 : 1,
      })
      .roundRect(x, top, miniWidth, miniHeight, miniRadius)
      .stroke({
        color:
          mini.fill === null
            ? blend(mini.color, "#000000", miniDepth)
            : mini.color,
        width: 1.5,
        alignment: 1,
      });
    label.text = mini.label;
    label.tint =
      mini.fill === null ? blend(mini.color, "#000000", miniDepth) : mini.color;
    label.anchor.set(0.5);
    label.position.set(x + miniWidth / 2, top + miniHeight / 2);
    art.addChild(card, label);
  }
}

function drawEntry(
  art: Container,
  entry: Entry,
  creations: Creations,
  width: number,
  height: number,
): string {
  const item: Entry["item"] = entry.item;
  let detail: string = "";

  if (entry.kind === "stage") {
    const stage: Stage = item as Stage;

    drawBackground(
      art,
      byId(creations.backgrounds, stage.background),
      width,
      height,
    );
    detail =
      stage.length +
      "s  ·  " +
      stage.keyframes.length +
      (stage.keyframes.length === 1 ? " keyframe" : " keyframes");
  } else if (entry.kind === "run") {
    const run: Run = item as Run;
    const stages: Array<Stage> = runStages(creations, run);
    const color: string = rarityOf(difficulties, run.difficulty).color;

    drawBackground(
      art,
      byId(creations.backgrounds, stages[0]?.background ?? null),
      width,
      height,
    );
    drawMinis(
      art,
      run.stages.map((id: string | null, index: number) => {
        const stage: Stage | null = byId(creations.stages, id);

        return {
          color: color,
          fill:
            stage === null
              ? null
              : (byId(creations.backgrounds, stage.background)?.top ??
                "#01040f"),
          label: String(index + 1),
        };
      }),
      width,
      height,
    );
    detail =
      stages.length +
      (stages.length === 1 ? " stage" : " stages") +
      "  ·  " +
      clockText(packLength(stages));
  } else if (entry.kind === "game") {
    const game: Game = item as Game;
    const stages: Array<Stage> = gameStages(creations, game);
    const runs: number = gameRuns(creations, game).length;

    drawBackground(
      art,
      byId(creations.backgrounds, stages[0]?.background ?? null),
      width,
      height,
    );
    drawMinis(
      art,
      difficulties.map((difficulty: Rarity<Difficulty>) => {
        const run: Run | null = byId(
          creations.runs,
          game.runs[difficulty.value],
        );

        return {
          color: difficulty.color,
          fill: run === null ? null : "#01040f",
          label: run === null ? "-" : String(runStages(creations, run).length),
        };
      }),
      width,
      height,
    );
    detail =
      runs +
      (runs === 1 ? " run" : " runs") +
      "  ·  " +
      stages.length +
      (stages.length === 1 ? " stage" : " stages");
  } else if (entry.kind === "pattern") {
    const pattern: Pattern = item as Pattern;

    drawPattern(art, pattern, width, height);
    detail = pattern.count + " bullets  ·  " + pattern.rate + "/s";
  } else if (entry.kind === "enemy") {
    const enemy: Enemy = item as Enemy;

    drawEnemy(art, enemy, width, height);
    const spells: number = enemy.bars.filter(
      (bar: Bar) => bar.spell !== null,
    ).length;

    detail =
      enemy.rank === "regular" || enemy.bars.length === 1
        ? enemy.bars[0]!.health +
          " hp  ·  " +
          (byId(creations.patterns, enemy.pattern)?.name ?? "No pattern")
        : enemy.bars.length +
          " stages  ·  " +
          spells +
          (spells === 1 ? " spell" : " spells");
  } else if (entry.kind === "sound") {
    const sound: Sound = item as Sound;

    drawSoundArt(art, sound, width, height);
    detail =
      (sound.source === "file" ? "file" : sound.wave) +
      "  ·  " +
      soundLength(sound).toFixed(2) +
      "s";
  } else if (entry.kind === "character") {
    const character: Character = item as Character;

    drawCharacterArt(art, character, width, height);
    detail =
      character.emotions.length +
      (character.emotions.length === 1 ? " emotion" : " emotions");
  } else if (entry.kind === "cutscene") {
    const cutscene: Cutscene = item as Cutscene;

    const speakers: number = castOf(cutscene, creations.characters).length;

    drawCutsceneArt(art, cutscene, creations.characters, width, height);
    detail =
      speakers +
      (speakers === 1 ? " character" : " characters") +
      "  ·  " +
      cutscene.lines.length +
      (cutscene.lines.length === 1 ? " line" : " lines");
  } else if (entry.kind === "sigil") {
    const sigil: Sigil = item as Sigil;

    drawSigilArt(art, sigil, width, height);
    detail =
      sigil.rings.length + (sigil.rings.length === 1 ? " ring" : " rings");
  } else if (entry.kind === "spell") {
    const spell: Spell = item as Spell;
    const sigil: Sigil | null = byId(creations.sigils, spell.sigil);

    if (spell.background !== null) {
      drawBackground(
        art,
        byId(creations.backgrounds, spell.background),
        width,
        height,
      );
    }

    if (sigil !== null) {
      drawSigilArt(art, sigil, width, height);
    }

    detail =
      (sigil?.name ?? "No sigil") +
      "  ·  " +
      (byId(creations.patterns, spell.pattern)?.name ?? "Enemy pattern");
  } else if (entry.kind === "wallpaper") {
    const wallpaper: Wallpaper = item as Wallpaper;
    const layer: Container = new Container();

    paintWallpaper(layer, wallpaper, width, height, wallpaperScale);
    art.addChild(layer);
    detail =
      wallpaper.sprite !== null
        ? "Image"
        : wallpaper.stripes > 0
          ? "Stripes " + wallpaper.stripes
          : "Solid";
  } else if (entry.kind === "palette") {
    drawBackground(art, null, width, height);
    drawPalette(art, item as Palette, width, height);
    detail = "4 colours";
  } else {
    drawBackground(art, item as Background, width, height);
    detail = "Scroll " + (item as Background).scroll;
  }

  if (entry.kind === "stage") {
    const stage: Stage = item as Stage;
    const used: Set<string> = new Set();

    for (const spawn of stage.keyframes.flatMap(
      (keyframe: Keyframe) => keyframe.spawns,
    )) {
      const enemy: Enemy | null = byId(creations.enemies, spawn.enemy);

      if (enemy === null || used.has(enemy.id) || used.size >= 4) {
        continue;
      }

      const holder: Container = new Container();

      drawEnemy(holder, enemy, 36, 36);
      holder.position.set(width / 2 - 72 + used.size * 40, height / 2 - 18);
      art.addChild(holder);
      used.add(enemy.id);
    }
  }

  return detail;
}

export { drawEntry };
