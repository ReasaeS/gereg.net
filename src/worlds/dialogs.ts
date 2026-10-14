import { Container, Graphics, Text, type Application } from "pixi.js";
import { getTheme } from "../theme/theme";
import { createText, screenResolution, sharpen } from "../ui/text";
import { hudHeight } from "../game/field";

type Lane = {
  view: Container;
  boxes: Array<Container>;
  offset: number; // units
  speed: number; // units/s
};

type Dialogs = {
  view: Container;
  layout: () => void;
  update: (delta: number) => void;
};

const dialogAngle: number = -Math.PI / 6; // rad
const dialogAlpha: number = 0.55;
const boxWidth: number = 200; // units
const boxHeight: number = 54; // units
const boxGap: number = 26; // units
const laneGap: number = 18; // units
const boxSlant: number = 8; // units
const boxPadding: number = 10; // units
const borderWidth: number = 1.5; // units
const tagWidth: number = 64; // units
const tagHeight: number = 14; // units
const nameSize: number = 9; // units
const lineSize: number = 10; // units
const minSpeed: number = 14; // units/s
const maxSpeed: number = 26; // units/s
const speakers: Array<string> = ["???", "Speaker", "Stranger", "Witch"];
const lines: Array<string> = [
  "Placeholder dialogue goes here.",
  "This line will be written later.",
  "Lorem ipsum dolor sit amet, consectetur.",
  "Another placeholder for a story beat.",
  "Something important is about to happen...",
  "Sed do eiusmod tempor incididunt.",
  "Who goes there?",
  "A longer placeholder line to fill the box.",
];

function createBox(index: number): Container {
  const box: Container = new Container();
  const frame: Graphics = new Graphics();
  const tag: Graphics = new Graphics();
  const name: Text = createText(nameSize, "#ffffff");
  const line: Text = createText(lineSize, "#ffffff");

  frame
    .poly([
      boxSlant,
      0,
      boxWidth,
      0,
      boxWidth - boxSlant,
      boxHeight,
      0,
      boxHeight,
    ])
    .fill({ color: getTheme().menuSelected, alpha: 0.85 })
    .stroke({ color: getTheme().highlight, width: borderWidth, alpha: 0.8 });
  tag
    .poly([
      boxSlant + tagHeight / 2,
      -tagHeight / 2,
      boxSlant + tagWidth,
      -tagHeight / 2,
      boxSlant + tagWidth - tagHeight / 2,
      tagHeight / 2,
      boxSlant,
      tagHeight / 2,
    ])
    .fill(getTheme().accent);
  name.text = speakers[index % speakers.length]!.toUpperCase();
  name.anchor.set(0, 0.5);
  name.position.set(boxSlant + tagHeight / 2 + 2, 0);
  line.text = lines[(index * 3) % lines.length]!;
  line.style.wordWrap = true;
  line.style.wordWrapWidth = boxWidth - boxSlant - boxPadding * 2;
  line.position.set(boxSlant + boxPadding, tagHeight / 2 + 4);
  box.addChild(frame, tag, name, line);

  return box;
}

function createDialogs(app: Application): Dialogs {
  const view: Container = new Container();
  const field: Container = new Container();
  let lanes: Array<Lane> = new Array();
  let length: number = 0;

  function layout(): void {
    const scale: number = app.screen.height / hudHeight;
    const reach: number = Math.hypot(app.screen.width, app.screen.height);
    const span: number = reach / scale;
    const laneCount: number = Math.ceil(span / (boxHeight + laneGap)) + 1;
    const boxCount: number = Math.ceil(span / (boxWidth + boxGap)) + 2;
    let index: number = 0;

    for (const lane of field.removeChildren()) {
      lane.destroy({ children: true });
    }

    lanes = new Array();
    length = boxCount * (boxWidth + boxGap);

    for (let row = 0; row < laneCount; row++) {
      const lane: Lane = {
        view: new Container(),
        boxes: new Array(),
        offset: Math.random() * length,
        speed:
          (row % 2 === 0 ? 1 : -1) *
          (minSpeed + (maxSpeed - minSpeed) * Math.random()),
      };

      for (let column = 0; column < boxCount; column++) {
        const box: Container = createBox(index++);

        lane.boxes.push(box);
        lane.view.addChild(box);
      }

      lane.view.y = (row - laneCount / 2) * (boxHeight + laneGap);
      lanes.push(lane);
      field.addChild(lane.view);
    }

    field.scale.set(scale);
    field.position.set(app.screen.width / 2, app.screen.height / 2);
    sharpen(field, screenResolution(scale));
    update(0);
  }

  function update(delta: number): void {
    for (const lane of lanes) {
      lane.offset = (lane.offset + lane.speed * delta + length) % length;

      for (let column = 0; column < lane.boxes.length; column++) {
        lane.boxes[column]!.x =
          ((column * (boxWidth + boxGap) + lane.offset) % length) - length / 2;
      }
    }
  }

  field.rotation = dialogAngle;
  view.addChild(field);
  view.alpha = dialogAlpha;
  view.eventMode = "none";
  layout();

  return { view: view, layout: layout, update: update };
}

export { createDialogs };
export type { Dialogs };
