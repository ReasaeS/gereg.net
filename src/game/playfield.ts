import {
  Container,
  Graphics,
  type Application,
  type Texture,
  type Ticker,
} from "pixi.js";
import { createHud, type Hud } from "./hud";
import {
  fieldHeight,
  fieldWidth,
  fieldX,
  fieldY,
  hudHeight,
  hudScale,
  hudWidth,
} from "./field";
import {
  cubicBezier,
  frameDelta,
  tween,
  type Easing,
} from "../effects/tween/tween";
import { createClock, runClock, type Clock } from "./clock";
import { createSelector, type Menu, type Selector } from "./selector";
import { levels, type Level } from "./levels";
import { createZen, type Zen } from "./zen";
import { minPower } from "./drones";
import { startBombs } from "./bomb";
import { createPilot, type Pilot } from "./pilot";
import {
  bombKeys,
  createKeyboard,
  focusKeys,
  shotKeys,
  steering,
  type Keyboard,
} from "./input";

type Playfield = {
  view: Container;
  show: () => Promise<void>;
  hide: () => Promise<void>;
  hideDuration: () => number;
  back: () => boolean;
};

const fieldColor: string = "#01040f";
const playerStartY: number = 0.85; // of field height
const enterDuration: number = 450; // ms
const enterDistance: number = 400; // px
const enterEasing: Easing = cubicBezier(0.34, 1.56, 0.64, 1);
const leaveDuration: number = 250; // ms
const rollLead: number = 200; // ms
const modesMenu: Menu = {
  heading: "PLAY",
  choices: [
    { name: "Story", title: "Fight through the stages" },
    { name: "Multiplayer", title: "Play alongside others" },
    { name: "Zen", title: "Roam under your own skies" },
  ],
};
const stagesMenu: Menu = {
  heading: "STAGE SELECT",
  choices: levels.map((level: Level) => ({
    name: level.name,
    title: level.title,
  })),
};
const multiplayerMenu: Menu = {
  heading: "MULTIPLAYER",
  choices: [
    { name: "Local", title: "Coming soon" },
    { name: "Online", title: "Coming soon" },
  ],
};

async function createPlayfield(
  app: Application,
  texture: Texture,
  droneTexture: Texture,
): Promise<Playfield> {
  const view: Container = new Container();
  const game: Container = new Container();
  const hud: Hud = await createHud();
  const selector: Selector = createSelector(app.ticker);
  const field: Container = new Container();
  const fieldMask: Graphics = new Graphics();
  const gameMask: Graphics = new Graphics();
  const back: Graphics = new Graphics();
  const pilot: Pilot = createPilot(
    texture,
    droneTexture,
    fieldWidth,
    fieldHeight,
  );
  const clock: Clock = createClock();
  const zen: Zen = createZen(hud.setLook);
  let menu: Menu = modesMenu;
  let zenning: boolean = false;
  let zenElapsed: number = 0;
  let active: boolean = false;
  let rolling: boolean = false;
  const keyboard: Keyboard = createKeyboard(() => active);

  function reset(): void {
    pilot.reset(fieldWidth / 2, fieldHeight * playerStartY);
    keyboard.clear();
    pilot.bomb.setStock(startBombs);
    hud.stats.bombs = startBombs;
    hud.stats.power = minPower;
    pilot.squad.setPower(hud.stats.power);
    hud.refresh();
  }

  function draw(): void {
    back.clear().rect(0, 0, fieldWidth, fieldHeight).fill(fieldColor);
    pilot.redraw();
  }

  function layout(): void {
    const scale: number = hudScale(app.screen.width, app.screen.height);

    game.scale.set(scale);
    game.position.set(
      Math.round(app.screen.width / 2 - (hudWidth * scale) / 2),
      Math.round(app.screen.height / 2 - (hudHeight * scale) / 2),
    );
    hud.setScale(scale);
    selector.setScale(scale);
  }

  fieldMask.rect(0, 0, fieldWidth, fieldHeight).fill(0xffffff);
  field.position.set(fieldX, fieldY);
  field.addChild(back, zen.view, fieldMask, ...pilot.layers());
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

  app.ticker.add((ticker: Ticker) => {
    if (!view.visible) {
      return;
    }

    zen.update(frameDelta(ticker));

    if (!active) {
      return;
    }

    if (zenning) {
      zenElapsed += frameDelta(ticker);
      hud.setElapsed(zenElapsed);
    }

    runClock(clock, frameDelta(ticker), movePlayer);
  });

  function movePlayer(delta: number): void {
    pilot.squad.setPower(hud.stats.power);

    if (
      pilot.update(
        delta,
        steering(keyboard.pressed),
        keyboard.pressed(focusKeys),
        keyboard.pressed(shotKeys),
        keyboard.pressed(bombKeys),
      )
    ) {
      hud.stats.bombs = pilot.bomb.stock();
      hud.refresh();
    }
  }

  function openMenu(next: Menu): Promise<void> {
    active = false;
    rolling = true;
    keyboard.clear();
    pilot.hitbox.visible = false;
    selector.setActive(false);

    return selector
      .rollUp()
      .then(() => {
        menu = next;
        selector.setMenu(next);
        return selector.rollDown();
      })
      .then(() => {
        rolling = false;
        selector.setActive(true);
      });
  }

  function startPlaying(zenMode: boolean): void {
    selector.setActive(false);
    rolling = true;
    reset();
    zenning = zenMode;

    if (zenMode) {
      zenElapsed = 0;
      hud.setElapsed(0);
      hud.setZen(true);
      pilot.squad.setDrones(false);
      zen.start();
    }

    selector.rollUp().then(() => {
      rolling = false;
      active = true;
    });
  }

  function stopZen(): void {
    if (zenning) {
      zenning = false;
      zen.stop();
      hud.setZen(false);
      pilot.squad.setDrones(true);
    }
  }

  selector.onChoose((index: number) => {
    if (menu === modesMenu) {
      if (index === 0) {
        openMenu(stagesMenu);
      } else if (index === 1) {
        openMenu(multiplayerMenu);
      } else {
        startPlaying(true);
      }
    } else if (menu === stagesMenu) {
      startPlaying(false);
    }
  });

  function show(): Promise<void> {
    reset();
    hud.refresh();
    selector.close();
    pilot.hitbox.visible = false;
    view.visible = true;
    tween(app.ticker, enterDuration - rollLead, () => undefined).then(() =>
      openMenu(modesMenu),
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
      const wasZen: boolean = zenning;

      stopZen();
      openMenu(wasZen ? modesMenu : stagesMenu);
      return true;
    }

    if (menu !== modesMenu) {
      openMenu(modesMenu);
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
    keyboard.clear();
    stopZen();
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

export { createPlayfield };
export type { Playfield };
