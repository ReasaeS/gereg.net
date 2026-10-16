import { Container, Graphics, Text } from "pixi.js";
import type { Bar, Enemy } from "../types";
import { fontFamily } from "../../ui/text";
import { previewHeight, previewWidth } from "./bounds";
import { barCount, type Actor } from "./actors";

type BossHud = {
  view: Container;
  graphics: Graphics;
  stages: Text;
  timer: Text;
  name: Text;
  stars: Text;
  spell: Text;
  tag: Container;
  tagBack: Graphics;
  tagText: Text;
};

const barLeft: number = 22; // units
const barRight: number = previewWidth - 34; // units
const barTop: number = 6; // units
const barHeight: number = 4; // units
const hudMargin: number = 6; // units
const hudResolution: number = 3;
const fillTime: number = 1; // s
const hurryTime: number = 10; // s
const spellTop: number = 24; // units
const spellPadding: number = 4; // units
const tagPadding: number = 3; // units

function hudText(size: number, color: string): Text {
  return new Text({
    text: "",
    resolution: hudResolution,
    style: {
      fontFamily: fontFamily,
      fontSize: size,
      fontStyle: "italic",
      fontWeight: "900",
      fill: color,
      dropShadow: {
        color: "#000000",
        alpha: 0.85,
        blur: 0,
        distance: 1,
        angle: Math.PI / 3,
      },
    },
  });
}

function createBossHud(): BossHud {
  const hud: BossHud = {
    view: new Container(),
    graphics: new Graphics(),
    stages: hudText(12, "#ffffff"),
    timer: hudText(14, "#ffffff"),
    name: hudText(9, "#9fd8ff"),
    stars: hudText(9, "#ffd84a"),
    spell: hudText(11, "#ffffff"),
    tag: new Container(),
    tagBack: new Graphics(),
    tagText: hudText(8, "#ff8a80"),
  };

  hud.stages.anchor.set(0, 0.5);
  hud.stages.position.set(hudMargin, barTop + barHeight / 2);
  hud.timer.anchor.set(1, 0.5);
  hud.timer.position.set(previewWidth - hudMargin, barTop + barHeight / 2);
  hud.name.position.set(barLeft, barTop + barHeight + 3);
  hud.stars.y = hud.name.y;
  hud.spell.anchor.set(1, 0);
  hud.spell.position.set(previewWidth - hudMargin - spellPadding, spellTop);
  hud.tagText.text = "ENEMY";
  hud.tagText.anchor.set(0.5, 1);
  hud.tagBack
    .rect(
      -hud.tagText.width / 2 - tagPadding,
      -hud.tagText.height - tagPadding / 2,
      hud.tagText.width + tagPadding * 2,
      hud.tagText.height + tagPadding / 2,
    )
    .fill({ color: "#000000", alpha: 0.6 });
  hud.tag.addChild(hud.tagBack, hud.tagText);
  hud.tag.y = previewHeight;
  hud.view.addChild(
    hud.graphics,
    hud.stages,
    hud.timer,
    hud.name,
    hud.stars,
    hud.spell,
    hud.tag,
  );
  hud.view.visible = false;

  return hud;
}

function drawBossBar(
  bossHud: BossHud,
  actors: Array<Actor>,
  delta: number,
): void {
  let boss: Actor | null = null;

  for (let index = actors.length - 1; index >= 0; index--) {
    if (actors[index]!.enemy.rank !== "regular" && !actors[index]!.dead) {
      boss = actors[index]!;
      break;
    }
  }

  bossHud.view.visible = boss !== null;

  if (boss === null) {
    return;
  }

  const enemy: Enemy = boss.enemy;
  const maximum: number = Math.max(enemy.bars[boss.bar]?.health ?? 1, 1);
  const limit: number = enemy.bars[boss.bar]?.time ?? 0;
  const left: number = Math.max(limit - boss.barTime, 0);
  const spells: number = enemy.bars
    .slice(boss.bar + 1, barCount(enemy))
    .filter((bar: Bar) => bar.spell !== null).length;
  const width: number = barRight - barLeft;

  boss.fill = Math.min(boss.fill + delta / fillTime, 1);

  const amount: number = Math.min(boss.fill, Math.max(boss.hp, 0) / maximum);

  bossHud.graphics
    .clear()
    .rect(barLeft, barTop, width, barHeight)
    .fill({ color: "#000000", alpha: 0.55 })
    .rect(barLeft, barTop, width * amount, barHeight)
    .fill("#ff5a7a")
    .rect(barLeft, barTop, width * amount, 1)
    .fill("#ffd0da")
    .rect(barLeft, barTop, width, barHeight)
    .stroke({ color: "#ffffff", width: 0.5, alpha: 0.5, alignment: 1 });
  bossHud.stages.text = String(barCount(enemy) - boss.bar - 1);
  bossHud.timer.visible = limit > 0;
  bossHud.timer.text = String(Math.ceil(left)).padStart(2, "0");
  bossHud.timer.style.fill = left < hurryTime ? "#ff3b3b" : "#ffffff";
  bossHud.name.text = enemy.name.toUpperCase();
  bossHud.stars.text = "★".repeat(spells);
  bossHud.stars.x = bossHud.name.x + bossHud.name.width + 3;
  bossHud.spell.visible = boss.spell !== null;

  if (boss.spell !== null) {
    bossHud.spell.text = boss.spell.name;
    bossHud.graphics
      .rect(
        bossHud.spell.x - bossHud.spell.width - spellPadding,
        spellTop - 1,
        bossHud.spell.width + spellPadding * 2,
        bossHud.spell.height + 2,
      )
      .fill({ color: "#000000", alpha: 0.45 });
  }

  bossHud.tag.visible = boss.view.x > 0 && boss.view.x < previewWidth;
  bossHud.tag.x = boss.view.x;
}

export { createBossHud, drawBossBar };
export type { BossHud };
