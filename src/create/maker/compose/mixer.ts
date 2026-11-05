import { Container, Graphics, Text } from "pixi.js";
import type { Channel, Insert } from "../../types";
import { delayHigh, delayLow, insertCount, volumeMost } from "../../arrange";
import { createText } from "../../../ui/text";
import {
  buttonHeight,
  createButton,
  createFader,
  createKnob,
  type Button,
  type Knob,
} from "./controls";
import {
  accentColor,
  areaHeight,
  areaLeft,
  areaTop,
  areaWidth,
  dimColor,
  ledColor,
  ledOff,
  panelColor,
  rename,
  smallSize,
  stripColor,
  textColor,
  type Panel,
  type Session,
} from "./shared";

type Field = "pan" | "grit" | "space" | "delay" | "filter";

type Setting = {
  name: string;
  min: number;
  max: number;
  step: number;
  rest: number;
  field: Field;
  centered: boolean;
};

type Strip = {
  name: Button;
  mute: Button;
  knobs: Array<Knob>;
  values: Array<Text>;
  fader: Knob;
  level: Text;
  routed: Text;
};

const stripGap: number = 3; // units
const stripWidth: number =
  (areaWidth - stripGap * (insertCount - 1)) / insertCount; // units
const stripInset: number = 3; // units
const numberY: number = 6; // units
const nameY: number = 16; // units
const knobRadius: number = 8; // units
const knobsTop: number = 48; // units
const knobGap: number = 31; // units
const faderTop: number = 206; // units
const faderHeight: number = 72; // units
const muteY: number = faderTop + faderHeight + 14; // units
const routedY: number = muteY + buttonHeight + 6; // units
const routedLines: number = 2;
const lineHeight: number = 9; // units
const settings: Array<Setting> = [
  {
    name: "Pan",
    min: -1,
    max: 1,
    step: 0.01,
    rest: 0,
    field: "pan",
    centered: true,
  },
  {
    name: "Grit",
    min: 0,
    max: 1,
    step: 0.01,
    rest: 0,
    field: "grit",
    centered: false,
  },
  {
    name: "Space",
    min: 0,
    max: 1,
    step: 0.01,
    rest: 0,
    field: "space",
    centered: false,
  },
  {
    name: "Echo",
    min: delayLow,
    max: delayHigh,
    step: 1,
    rest: 3,
    field: "delay",
    centered: false,
  },
  {
    name: "Filter",
    min: 0,
    max: 1,
    step: 0.01,
    rest: 1,
    field: "filter",
    centered: false,
  },
];

function createMixer(session: Session): Panel {
  const view: Container = new Container();
  const backs: Graphics = new Graphics();
  const strips: Array<Strip> = new Array();
  let ready: boolean = false;

  function insert(index: number): Insert {
    return session.score().inserts[index]!;
  }

  function shown(setting: Setting, value: number): string {
    return setting.field === "delay"
      ? value + " ST"
      : setting.field === "pan"
        ? Math.abs(value) < 0.005
          ? "C"
          : Math.round(Math.abs(value) * 100) + (value < 0 ? "L" : "R")
        : Math.round(value * 100) + "%";
  }

  function redraw(): void {
    const selected: Channel | null = session.channel();

    backs.clear();
    strips.forEach((strip: Strip, index: number) => {
      const x: number = index * (stripWidth + stripGap);
      const routed: Array<Channel> = session
        .score()
        .channels.filter((channel: Channel) => channel.insert === index);
      const lit: boolean = selected !== null && selected.insert === index;

      backs
        .rect(x, 0, stripWidth, areaHeight)
        .fill(index === 0 ? panelColor : stripColor)
        .rect(x, 0, stripWidth, areaHeight)
        .stroke({
          color: lit ? accentColor : "#1f272b",
          width: 1,
          alignment: 1,
        })
        .circle(x + stripWidth - 8, muteY + buttonHeight / 2, 3)
        .fill(insert(index).mute ? ledOff : ledColor);
      strip.name.label.text = insert(index).name.toUpperCase().slice(0, 8);
      strip.mute.paint();
      strip.knobs.forEach((knob: Knob, order: number) => {
        knob.refresh();
        strip.values[order]!.text = shown(
          settings[order]!,
          insert(index)[settings[order]!.field],
        );
      });
      strip.fader.refresh();
      strip.level.text = Math.round(insert(index).volume * 100) + "%";
      strip.routed.text = routed
        .slice(0, routedLines)
        .map((channel: Channel) => channel.name.toUpperCase().slice(0, 9))
        .concat(
          routed.length > routedLines
            ? ["+" + (routed.length - routedLines) + " MORE"]
            : [],
        )
        .join("\n");
    });
  }

  for (let index = 0; index < insertCount; index++) {
    const strip: Container = new Container();
    const number: Text = createText(smallSize, dimColor);
    const name: Button = createButton("", stripWidth - stripInset * 2, () =>
      rename(insert(index).name, (value: string) => {
        session.record();
        insert(index).name = value;
        session.edited();
        redraw();
      }),
    );
    const mute: Button = createButton(
      "Mute",
      stripWidth - stripInset * 2 - 14,
      () => {
        session.record();
        insert(index).mute = !insert(index).mute;
        session.edited();
        redraw();
      },
      () => ready && insert(index).mute,
    );
    const knobs: Array<Knob> = new Array();
    const values: Array<Text> = new Array();
    const level: Text = createText(smallSize, textColor);
    const routed: Text = createText(smallSize, dimColor);
    const fader: Knob = createFader(
      faderHeight,
      0,
      volumeMost,
      1,
      () => insert(index).volume,
      (amount: number) => {
        session.record();
        insert(index).volume = amount;
        level.text = Math.round(amount * 100) + "%";
        session.edited();
      },
    );

    number.text = index === 0 ? "MASTER" : "INSERT " + index;
    number.anchor.set(0.5, 0.5);
    number.position.set(stripWidth / 2, numberY);
    name.view.position.set(stripInset, nameY);
    strip.addChild(number, name.view);
    settings.forEach((setting: Setting, order: number) => {
      const y: number = knobsTop + order * knobGap;
      const label: Text = createText(smallSize, dimColor);
      const value: Text = createText(smallSize, textColor);
      const knob: Knob = createKnob(
        knobRadius,
        setting.min,
        setting.max,
        setting.step,
        setting.rest,
        () => insert(index)[setting.field],
        (amount: number) => {
          session.record();
          insert(index)[setting.field] = amount;
          value.text = shown(setting, amount);
          session.edited();
        },
        setting.centered,
      );

      knob.view.position.set(stripInset + knobRadius + 2, y);
      label.text = setting.name.toUpperCase();
      label.anchor.set(0, 1);
      label.position.set(stripInset + knobRadius * 2 + 7, y);
      value.anchor.set(0, 0);
      value.position.set(stripInset + knobRadius * 2 + 7, y);
      strip.addChild(knob.view, label, value);
      knobs.push(knob);
      values.push(value);
    });
    fader.view.position.set(stripWidth / 2, faderTop);
    level.anchor.set(0.5, 1);
    level.position.set(stripWidth / 2, faderTop - 6);
    mute.view.position.set(stripInset, muteY);
    routed.position.set(stripInset, routedY);
    routed.style.lineHeight = lineHeight;
    strip.addChild(fader.view, level, mute.view, routed);
    strip.x = index * (stripWidth + stripGap);
    view.addChild(strip);
    strips.push({
      name: name,
      mute: mute,
      knobs: knobs,
      values: values,
      fader: fader,
      level: level,
      routed: routed,
    });
  }

  ready = true;
  view.addChildAt(backs, 0);
  view.position.set(areaLeft, areaTop);

  return {
    view: view,
    redraw: redraw,
    tick: () => undefined,
    key: () => false,
  };
}

export { createMixer };
