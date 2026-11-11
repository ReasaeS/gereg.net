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
const tipHeight: number = 112; // px
const outlineWidth: number = 5; // px
const outlineColor: string = "#020b30";
const bodyColor: string = "#8fdcff";
const shadeColor: string = "#5cb4f0";
const cheekColor: string = "#ff8fb1";
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
const shadeStart: number = 0.25; // rad
const shadeEnd: number = 2.5; // rad
const umbrellaTilt: number = 0.4; // rad
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
  const leftHand: Graphics = new Graphics();
  const rightHand: Container = new Container();
  const rightPalm: Graphics = new Graphics();
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

  function drawBody(): void {
    const top: number = -tipHeight;

    body
      .clear()
      .moveTo(0, top)
      .bezierCurveTo(
        bodyRadius * 0.35,
        top * 0.6,
        bodyRadius,
        -bodyRadius * 0.55,
        bodyRadius,
        0,
      )
      .arc(0, 0, bodyRadius, 0, Math.PI)
      .bezierCurveTo(
        -bodyRadius,
        -bodyRadius * 0.55,
        -bodyRadius * 0.35,
        top * 0.6,
        0,
        top,
      )
      .closePath()
      .fill(bodyColor)
      .stroke({ color: outlineColor, width: outlineWidth, join: "round" })
      .moveTo(
        Math.cos(shadeStart) * bodyRadius * 0.82,
        Math.sin(shadeStart) * bodyRadius * 0.82,
      )
      .arc(0, 0, bodyRadius * 0.82, shadeStart, shadeEnd)
      .stroke({ color: shadeColor, width: 9, cap: "round" })
      .ellipse(-bodyRadius * 0.48, -bodyRadius * 0.62, 9, 17)
      .fill({ color: "#ffffff", alpha: 0.75 })
      .circle(-bodyRadius * 0.6, -bodyRadius * 0.18, 5)
      .fill({ color: "#ffffff", alpha: 0.75 })
      .ellipse(-eyeX - 17, 14, 11, 7)
      .fill({ color: cheekColor, alpha: 0.65 })
      .ellipse(eyeX + 17, 14, 11, 7)
      .fill({ color: cheekColor, alpha: 0.65 });
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
    graphics
      .clear()
      .circle(0, 0, handRadius)
      .fill(bodyColor)
      .stroke({ color: outlineColor, width: outlineWidth - 1 });
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
      mouth
        .ellipse(0, 18, 9, 8)
        .fill(outlineColor)
        .ellipse(0, 22, 5, 3)
        .fill(cheekColor);
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
    drawHand(leftHand);
    drawHand(rightPalm);
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
    const squash: number =
      1 + 0.04 * bob + (hopping > 0.85 ? (hopping - 0.85) * 0.6 : 0);
    const waving: number = waveLeft / waveTime;

    figure.y = -bob * bobHeight - lift;
    figure.scale.set(1 / Math.sqrt(squash), squash);
    shadow.scale.set(1 - (bob * 0.04 + lift / hopHeight) * 0.25);
    umbrella.rotation =
      umbrellaTilt + Math.sin(time * swaySpeed * Math.PI * 2) * swayAngle;
    leftHand.y = handY + Math.sin(time * bobSpeed * Math.PI * 2 + 1) * 3;
    rightHand.rotation =
      waving > 0
        ? waveAngle * 0.6 +
          Math.sin(time * waveSpeed * Math.PI * 2) * waveAngle * waving
        : 0;
    rightPalm.y = waving > 0 ? -handRadius * 3 * Math.min(waving * 3, 1) : 0;
    drawEyes(blinking > 0);
    drawMouth(talking && Math.sin(time * mouthRate * Math.PI * 2) > -0.2);
  }

  drawBody();
  umbrella.pivot.set(0, stickLength);
  umbrella.position.set(-handX + 10, handY);
  umbrella.addChild(stick, canopy);
  leftHand.position.set(-handX, handY);
  rightHand.position.set(handX, handY);
  rightHand.addChild(rightPalm);
  face.addChild(eyes, mouth);
  figure.addChild(umbrella, body, face, leftHand, rightHand);
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
