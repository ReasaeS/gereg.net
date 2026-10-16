import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type FederatedPointerEvent,
} from "pixi.js";
import type { Keyframe } from "../types";
import { getTheme } from "../../theme/theme";
import { createText } from "../../ui/text";
import { chipHeight } from "../../ui/widgets";
import { fieldHeight, fieldX, fieldY } from "../../game/field";
import type { Studio } from "./studio";

type Timeline = {
  view: Container;
  draw: () => void;
};

const timelineColor: string = "#061a52";
const markerColor: string = "#9fd8ff";
const timelineGap: number = 6; // units
const timelineHeight: number = 10; // units
const columnCenter: number = fieldX / 2; // units
const clockGap: number = 8; // units
const clockSize: number = 8; // units
const markerWidth: number = 1.5; // units
const playheadWidth: number = 1; // units
const keyframeSize: number = 4; // units
const transportWidth: number = 24; // units
const timelineLength: number = fieldHeight - chipHeight - timelineGap;

function createTimeline(
  studio: Studio,
  selectKeyframe: (index: number) => void,
  playChip: Container,
): Timeline {
  const { preview, cursor } = studio;
  const { stage } = studio.pick;
  const view: Container = new Container();
  const track: Graphics = new Graphics();
  const clock: Text = createText(clockSize, "#ffffff");
  const total: Text = createText(clockSize, "#ffffff");
  const transport: Container = new Container();

  function timelineY(time: number): number {
    return (1 - time / stage().length) * timelineLength;
  }

  function seekTimeline(y: number): void {
    const amount: number = Math.min(Math.max(1 - y / timelineLength, 0), 1);
    const keyframes: Array<Keyframe> = stage().keyframes;

    for (let index = 0; index < keyframes.length; index++) {
      const at: number = timelineY(keyframes[index]!.time);

      if (Math.abs(at - y) <= keyframeSize + 2) {
        selectKeyframe(index);
        return;
      }
    }

    preview.seek(amount * stage().length);
  }

  function draw(): void {
    const length: number = stage().length;
    const now: number = preview.stageTime();

    track
      .clear()
      .rect(0, 0, timelineHeight, timelineLength)
      .fill({ color: timelineColor, alpha: 0.85 });

    for (let index = 0; index < stage().keyframes.length; index++) {
      const value: Keyframe = stage().keyframes[index]!;
      const color: string =
        index === cursor.keyframe ? getTheme().accent : markerColor;
      const y: number = timelineY(value.time);

      for (const entry of value.spawns) {
        for (let wave = 1; wave < entry.count; wave++) {
          const at: number = value.time + wave * entry.gap;

          if (at <= length) {
            track
              .rect(
                timelineHeight / 3,
                timelineY(at) - markerWidth / 2,
                timelineHeight / 3,
                markerWidth,
              )
              .fill({ color: color, alpha: 0.6 });
          }
        }
      }

      track
        .poly([
          0,
          y,
          timelineHeight / 2,
          y - keyframeSize,
          timelineHeight,
          y,
          timelineHeight / 2,
          y + keyframeSize,
        ])
        .fill(color);
    }

    track
      .rect(
        -4,
        timelineY(now) - playheadWidth / 2,
        timelineHeight + 8,
        playheadWidth,
      )
      .fill(getTheme().highlight);
    clock.text = now.toFixed(1) + "s";
    total.text = length + "s";
  }

  track.eventMode = "static";
  track.cursor = "pointer";
  track.on("pointerdown", (event: FederatedPointerEvent) => {
    seekTimeline(track.toLocal(event.global).y);
  });
  transport.addChild(playChip);
  view.addChild(track, clock, total, transport);
  track.position.set(columnCenter - timelineHeight / 2, 0);
  track.hitArea = new Rectangle(
    -6,
    -keyframeSize,
    timelineHeight + 12,
    timelineLength + keyframeSize * 2,
  );
  clock.anchor.set(0.5);
  clock.position.set(columnCenter, fieldHeight + clockGap);
  total.anchor.set(0.5);
  total.position.set(columnCenter, -clockGap);
  transport.position.set(
    columnCenter - transportWidth / 2,
    timelineLength + timelineGap,
  );
  view.position.set(0, fieldY);

  return { view: view, draw: draw };
}

export { createTimeline, transportWidth };
export type { Timeline };
