import type { Graphics } from "pixi.js";
import type { Ring, Spell } from "./data";

const ringInner: number = 0.9;
const ringCore: number = 0.42;
const orbFill: number = 0.25;

function drawRing(
  graphics: Graphics,
  ring: Ring,
  color: string,
  rotation: number,
): void {
  const radius: number = ring.radius;
  const inner: number = radius * ringInner;
  const points: number = Math.max(Math.round(ring.points), 0);
  const ticks: number = Math.max(Math.round(ring.ticks), 0);

  graphics.circle(0, 0, radius).stroke({ color: color, width: 2 });
  graphics.circle(0, 0, inner).stroke({ color: color, width: 1 });
  graphics.circle(0, 0, radius * ringCore).stroke({ color: color, width: 1 });

  for (let index = 0; index < ticks; index++) {
    const angle: number = rotation + (index / ticks) * Math.PI * 2;
    const reach: number =
      inner + (radius - inner) * (index % 2 === 0 ? 1 : 0.5);

    graphics
      .moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
      .lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
  }

  if (ticks > 0) {
    graphics.stroke({ color: color, width: 1 });
  }

  if (points === 0) {
    return;
  }

  for (let index = 0; index < points; index++) {
    const from: number = rotation + (index / points) * Math.PI * 2;
    const to: number =
      rotation +
      (((index + Math.round(ring.step)) % points) / points) * Math.PI * 2;

    graphics
      .moveTo(Math.cos(from) * inner, Math.sin(from) * inner)
      .lineTo(Math.cos(to) * inner, Math.sin(to) * inner);
  }

  graphics.stroke({ color: color, width: 1 });

  if (ring.orb <= 0) {
    return;
  }

  for (let index = 0; index < points; index++) {
    const angle: number = rotation + (index / points) * Math.PI * 2;

    graphics
      .circle(
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        radius * ring.orb,
      )
      .fill({ color: color, alpha: orbFill })
      .stroke({ color: color, width: 1 });
  }
}

function drawSpell(graphics: Graphics, spell: Spell, time: number): void {
  graphics.clear();

  for (const ring of spell.rings) {
    drawRing(graphics, ring, spell.color, (ring.spin * Math.PI * time) / 180);
  }

  graphics.alpha = spell.opacity;
}

function spellRadius(spell: Spell): number {
  return Math.max(1, ...spell.rings.map((ring: Ring) => ring.radius));
}

export { drawRing, drawSpell, spellRadius };
