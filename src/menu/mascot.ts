import { Container, Graphics } from "pixi.js";
import { getTheme } from "../theme/theme";

type Mood = "calm" | "happy";

type Mascot = {
  view: Container;
  update: (delta: number) => void;
  setTalking: (talking: boolean) => void;
  setMood: (mood: Mood) => void;
  hop: () => void;
  wave: () => void;
  paint: () => void;
};

const mascotName: string = "PLIP";
const bodyRadius: number = 62; // px
const outlineWidth: number = 5; // px
const outlineColor: string = "#020b30";
const bodyColor: string = "#8fdcff";
const rimColor: string = "#cdf1ff";
const coreColor: string = "#ffffff";
const haloShare: number = 1.14;
const haloAlpha: number = 0.3;
const rimShare: number = 0.84;
const coreShare: number = 0.71;
const scuffLines: number = 3;
const scuffY: number = 14; // px
const scuffGap: number = 5; // px
const scuffLength: number = 12; // px
const scuffWidth: number = 2.5; // px
const scuffAlpha: number = 0.35;
const eyeX: number = 23; // px
const eyeY: number = -10; // px
const eyeWidth: number = 9; // px
const eyeHeight: number = 14; // px
const handRadius: number = 13; // px
const handX: number = 84; // px
const handY: number = 14; // px
const canopyRadius: number = 92; // px
const canopyHeight: number = 54; // px
const stickLength: number = 150; // px
const umbrellaTilt: number = -0.4; // rad
const bobHeight: number = 7; // px
const bobSpeed: number = 0.6; // Hz
const swaySpeed: number = 0.45; // Hz
const swayAngle: number = 0.06; // rad
const blinkTime: number = 0.12; // s
const blinkMin: number = 2; // s
const blinkMax: number = 5; // s
const mouthRate: number = 9; // Hz
const hopTime: number = 0.32; // s
const hopHeight: number = 16; // px
const waveTime: number = 1.1; // s
const waveSpeed: number = 3; // Hz
const waveAngle: number = 0.5; // rad

function createMascot(): Mascot {
  const view: Container = new Container();
  const shadow: Graphics = new Graphics();
  const figure: Container = new Container();
  const umbrella: Container = new Container();
  const canopy: Graphics = new Graphics();
  const stick: Graphics = new Graphics();
  const body: Graphics = new Graphics();
  const face: Container = new Container();
  const eyes: Graphics = new Graphics();
  const mouth: Graphics = new Graphics();
  const holdHand: Graphics = new Graphics();
  const waveHand: Container = new Container();
  const wavePalm: Graphics = new Graphics();
  let time: number = 0;
  let blinkLeft: number = blinkMax;
  let blinking: number = 0;
  let talking: boolean = false;
  let mood: Mood = "calm";
  let hopLeft: number = 0;
  let waveLeft: number = 0;
  let mouthOpen: boolean | null = null;
  let eyesShut: boolean | null = null;
  let eyesMood: Mood | null = null;

  function drawOrb(graphics: Graphics, radius: number): Graphics {
    return graphics
      .clear()
      .circle(0, 0, radius * haloShare)
      .fill({ color: bodyColor, alpha: haloAlpha })
      .circle(0, 0, radius)
      .fill(bodyColor)
      .circle(0, 0, radius * rimShare)
      .fill(rimColor)
      .circle(0, 0, radius * coreShare)
      .fill(coreColor);
  }

  function drawBody(): void {
    drawOrb(body, bodyRadius);

    for (const side of [-1, 1]) {
      const x: number = side * (eyeX + 17);

      for (let index = 0; index < scuffLines; index++) {
        const offset: number = (index - (scuffLines - 1) / 2) * scuffGap;
        const half: number = scuffLength / 2 - Math.abs(offset) * 0.3;

        body
          .moveTo(x + offset - side * half * 0.5, scuffY + half)
          .lineTo(x + offset + side * half * 0.5, scuffY - half)
          .stroke({
            color: outlineColor,
            width: scuffWidth,
            alpha: scuffAlpha,
            cap: "round",
          });
      }
    }
  }

  function drawUmbrella(): void {
    const accent: string = getTheme().accent;
    const scallops: number = 4;
    const width: number = (canopyRadius * 2) / scallops;

    canopy
      .clear()
      .moveTo(-canopyRadius, 0)
      .bezierCurveTo(
        -canopyRadius,
        -canopyHeight * 1.3,
        canopyRadius,
        -canopyHeight * 1.3,
        canopyRadius,
        0,
      );

    for (let index = scallops - 1; index >= 0; index--) {
      const left: number = -canopyRadius + index * width;

      canopy.quadraticCurveTo(left + width / 2, -14, left, 0);
    }

    canopy
      .closePath()
      .fill(accent)
      .stroke({ color: outlineColor, width: outlineWidth, join: "round" });

    for (let index = 1; index < scallops; index++) {
      const x: number = -canopyRadius + index * width;

      canopy
        .moveTo(0, -canopyHeight * 0.97)
        .quadraticCurveTo(x * 0.55, -canopyHeight * 0.6, x, -4)
        .stroke({ color: outlineColor, width: 3, alpha: 0.6 });
    }

    canopy
      .circle(0, -canopyHeight * 0.97 - 6, 6)
      .fill(accent)
      .stroke({ color: outlineColor, width: 4 });
    stick
      .clear()
      .moveTo(0, 0)
      .lineTo(0, stickLength)
      .arc(-10, stickLength, 10, 0, Math.PI)
      .stroke({ color: outlineColor, width: 6, cap: "round" });
  }

  function drawHand(graphics: Graphics): void {
    drawOrb(graphics, handRadius);
  }

  function drawEyes(shut: boolean): void {
    if (shut === eyesShut && mood === eyesMood) {
      return;
    }

    eyesShut = shut;
    eyesMood = mood;
    eyes.clear();

    for (const side of [-1, 1]) {
      const x: number = side * eyeX;

      if (shut || mood === "happy") {
        eyes
          .moveTo(x - eyeWidth, eyeY + (shut ? 0 : 4))
          .quadraticCurveTo(
            x,
            eyeY + (shut ? 5 : -9),
            x + eyeWidth,
            eyeY + (shut ? 0 : 4),
          )
          .stroke({ color: outlineColor, width: 5, cap: "round" });
        continue;
      }

      eyes
        .ellipse(x, eyeY, eyeWidth, eyeHeight)
        .fill(outlineColor)
        .circle(x - 3, eyeY - 6, 4)
        .fill("#ffffff")
        .circle(x + 3, eyeY + 6, 2)
        .fill("#ffffff");
    }
  }

  function drawMouth(open: boolean): void {
    if (open === mouthOpen) {
      return;
    }

    mouthOpen = open;
    mouth.clear();

    if (open) {
      mouth.ellipse(0, 18, 9, 8).fill(outlineColor);
      return;
    }

    mouth
      .moveTo(-8, 15)
      .quadraticCurveTo(0, 23, 8, 15)
      .stroke({ color: outlineColor, width: 4, cap: "round" });
  }

  function paint(): void {
    drawBody();
    drawUmbrella();
    drawHand(holdHand);
    drawHand(wavePalm);
    shadow
      .clear()
      .ellipse(0, 0, bodyRadius * 0.9, 12)
      .fill({
        color: "#000000",
        alpha: 0.35,
      });
    eyesShut = null;
    mouthOpen = null;
  }

  function update(delta: number): void {
    time += delta;
    blinkLeft -= delta;
    hopLeft = Math.max(hopLeft - delta, 0);
    waveLeft = Math.max(waveLeft - delta, 0);

    if (blinkLeft <= 0) {
      blinking = blinkTime;
      blinkLeft = blinkMin + Math.random() * (blinkMax - blinkMin);
    }

    blinking = Math.max(blinking - delta, 0);

    const bob: number = Math.sin(time * bobSpeed * Math.PI * 2);
    const hopping: number = hopLeft / hopTime;
    const lift: number = Math.sin(hopping * Math.PI) * hopHeight;
    const waving: number = waveLeft / waveTime;

    figure.y = -bob * bobHeight - lift;
    shadow.scale.set(1 - (bob * 0.04 + lift / hopHeight) * 0.25);
    umbrella.rotation =
      umbrellaTilt + Math.sin(time * swaySpeed * Math.PI * 2) * swayAngle;
    holdHand.y = handY + Math.sin(time * bobSpeed * Math.PI * 2 + 1) * 3;
    waveHand.rotation =
      waving > 0
        ? -waveAngle * 0.6 -
          Math.sin(time * waveSpeed * Math.PI * 2) * waveAngle * waving
        : 0;
    wavePalm.y = waving > 0 ? -handRadius * 3 * Math.min(waving * 3, 1) : 0;
    drawEyes(blinking > 0);
    drawMouth(talking && Math.sin(time * mouthRate * Math.PI * 2) > -0.2);
  }

  umbrella.pivot.set(0, stickLength);
  umbrella.position.set(handX - 10, handY);
  umbrella.scale.x = -1;
  umbrella.addChild(stick, canopy);
  holdHand.position.set(handX, handY);
  waveHand.position.set(-handX, handY);
  waveHand.addChild(wavePalm);
  face.addChild(eyes, mouth);
  figure.addChild(umbrella, body, face, holdHand, waveHand);
  shadow.y = bodyRadius + 22;
  view.addChild(shadow, figure);
  paint();
  update(0);

  return {
    view: view,
    update: update,
    setTalking: (value: boolean) => {
      talking = value;
    },
    setMood: (value: Mood) => {
      mood = value;
    },
    hop: () => {
      hopLeft = hopTime;
    },
    wave: () => {
      waveLeft = waveTime;
    },
    paint: paint,
  };
}

export { createMascot, mascotName };
export type { Mascot, Mood };
