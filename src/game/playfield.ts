import {
  Container,
  Graphics,
  Sprite,
  type Application,
  type Texture,
  type Ticker,
} from "pixi.js";
import { getTheme } from "../theme/theme";
import {
  createHud,
  fieldHeight,
  fieldWidth,
  fieldX,
  fieldY,
  hudHeight,
  hudWidth,
  type Hud,
} from "./hud";
import { cubicBezier, tween, type Easing } from "../effects/tween/tween";
import { createClock, runClock, type Clock } from "./clock";
import { createSelector, type Selector } from "./selector";

type Playfield = {
  view: Container;
  show: () => Promise<void>;
  hide: () => Promise<void>;
  hideDuration: () => number;
  back: () => boolean;
};

const fieldScreen: number = 1; // of screen size
const fieldColor: string = "#01040f";
const playerSize: number = 32; // units
const playerSpeed: number = 300; // units/s
const focusSpeed: number = 130; // units/s
const playerStartY: number = 0.85; // of field height
const hitboxRadius: number = 3; // units
const hitboxColor: string = "#ff2a4d";
const maxDelta: number = 0.05; // s
const enterDuration: number = 450; // ms
const enterDistance: number = 400; // px
const enterEasing: Easing = cubicBezier(0.34, 1.56, 0.64, 1);
const leaveDuration: number = 250; // ms
const rollLead: number = 200; // ms
const leftKeys: Array<string> = ["ArrowLeft", "KeyA"];
const rightKeys: Array<string> = ["ArrowRight", "KeyD"];
const upKeys: Array<string> = ["ArrowUp", "KeyW"];
const downKeys: Array<string> = ["ArrowDown", "KeyS"];
const focusKeys: Array<string> = ["ShiftLeft", "ShiftRight"];

async function createPlayfield(
  app: Application,
  texture: Texture,
): Promise<Playfield> {
  const view: Container = new Container();
  const game: Container = new Container();
  const hud: Hud = await createHud();
  const selector: Selector = createSelector(app.ticker);
  const field: Container = new Container();
  const fieldMask: Graphics = new Graphics();
  const gameMask: Graphics = new Graphics();
  const back: Graphics = new Graphics();
  const player: Sprite = new Sprite(texture);
  const hitbox: Graphics = new Graphics();
  const clock: Clock = createClock();
  const held: Set<string> = new Set();
  let active: boolean = false;
  let rolling: boolean = false;

  function pressed(keys: Array<string>): boolean {
    return keys.some((key: string) => held.has(key));
  }

  function reset(): void {
    player.position.set(fieldWidth / 2, fieldHeight * playerStartY);
    held.clear();
  }

  function draw(): void {
    back.clear().rect(0, 0, fieldWidth, fieldHeight).fill(fieldColor);
    hitbox
      .clear()
      .circle(0, 0, hitboxRadius + 1)
      .fill(getTheme().highlight)
      .circle(0, 0, hitboxRadius)
      .fill(hitboxColor);
  }

  function layout(): void {
    const scale: number =
      Math.min(app.screen.width / hudWidth, app.screen.height / hudHeight) *
      fieldScreen;

    game.scale.set(scale);
    game.position.set(
      Math.round(app.screen.width / 2 - (hudWidth * scale) / 2),
      Math.round(app.screen.height / 2 - (hudHeight * scale) / 2),
    );
    hud.setScale(scale);
    selector.setScale(scale);
  }

  player.anchor.set(0.5);
  player.width = playerSize;
  player.height = playerSize;
  fieldMask.rect(0, 0, fieldWidth, fieldHeight).fill(0xffffff);
  field.position.set(fieldX, fieldY);
  field.addChild(back, fieldMask, player, hitbox);
  field.mask = fieldMask;
  gameMask.rect(0, 0, hudWidth, hudHeight).fill(0xffffff);
  game.addChild(hud.view, selector.view, field, gameMask);
  game.mask = gameMask;
  view.addChild(game);
  view.eventMode = "passive";
  view.visible = false;
  draw();
  layout();
  reset();

  app.renderer.on("resize", layout);

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    held.add(event.code);

    if (event.code.startsWith("Arrow") || event.code === "Space") {
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event: KeyboardEvent) => {
    held.delete(event.code);
  });

  window.addEventListener("blur", () => {
    held.clear();
  });

  app.ticker.add((ticker: Ticker) => {
    if (!view.visible) {
      return;
    }

    if (!active) {
      return;
    }

    runClock(clock, Math.min(ticker.deltaMS / 1000, maxDelta), movePlayer);
  });

  function movePlayer(delta: number): void {
    const focused: boolean = pressed(focusKeys);
    const speed: number = focused ? focusSpeed : playerSpeed;
    let x: number = (pressed(rightKeys) ? 1 : 0) - (pressed(leftKeys) ? 1 : 0);
    let y: number = (pressed(downKeys) ? 1 : 0) - (pressed(upKeys) ? 1 : 0);

    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }

    player.position.set(
      Math.min(
        Math.max(player.x + x * speed * delta, playerSize / 2),
        fieldWidth - playerSize / 2,
      ),
      Math.min(
        Math.max(player.y + y * speed * delta, playerSize / 2),
        fieldHeight - playerSize / 2,
      ),
    );
    hitbox.position.copyFrom(player.position);
    hitbox.visible = focused;
  }

  function openSelector(): Promise<void> {
    active = false;
    rolling = true;
    held.clear();
    hitbox.visible = false;

    return selector.rollDown().then(() => {
      rolling = false;
      selector.setActive(true);
    });
  }

  selector.onChoose(() => {
    selector.setActive(false);
    rolling = true;
    reset();
    selector.rollUp().then(() => {
      rolling = false;
      active = true;
    });
  });

  function show(): Promise<void> {
    reset();
    hud.refresh();
    selector.close();
    hitbox.visible = false;
    view.visible = true;
    tween(app.ticker, enterDuration - rollLead, () => undefined).then(
      openSelector,
    );

    return tween(app.ticker, enterDuration, (progress: number) => {
      view.y = -enterDistance * (1 - enterEasing(progress));
      view.alpha = Math.min(progress * 2, 1);
    });
  }

  function goBack(): boolean {
    if (rolling) {
      return true;
    }

    if (active) {
      openSelector();
      return true;
    }

    return false;
  }

  function doorTime(): number {
    return Math.max(selector.rollUpDuration() - rollLead, 0);
  }

  function hide(): Promise<void> {
    const door: number = doorTime();

    active = false;
    selector.setActive(false);
    held.clear();
    selector.rollUp();

    return tween(app.ticker, door, () => undefined)
      .then(() =>
        tween(app.ticker, leaveDuration, (progress: number) => {
          view.y = -enterDistance * progress * progress;
          view.alpha = 1 - progress;
        }),
      )
      .then(() => {
        view.visible = false;
      });
  }

  return {
    view: view,
    show: show,
    hide: hide,
    hideDuration: () => doorTime() + leaveDuration,
    back: goBack,
  };
}

export {
  leaveDuration,
  playerSpeed,
  focusSpeed,
  hitboxRadius,
  hitboxColor,
  leftKeys,
  rightKeys,
  upKeys,
  downKeys,
  focusKeys,
  createPlayfield,
};
export type { Playfield };
