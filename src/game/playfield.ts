import {
  Container,
  Graphics,
  type Application,
  type Texture,
  type Ticker,
} from "pixi.js";
import { createHud, type Hud } from "./hud";
import type { Vector } from "../create/types";
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
  createCustom,
  startLives,
  type Custom,
  type Outcome,
  type Run,
} from "./custom";
import { createBanner, type Banner } from "./banner";
import { bestScore, recordScore } from "./records";
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
const resultTime: number = 2600; // ms
const titleTime: number = 2200; // ms
const modesMenu: Menu = {
  heading: "PLAY",
  choices: [
    { name: "Story", title: "Fight through the stages" },
    { name: "Custom", title: "Play the stages you made" },
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
const pauseMenu: Menu = {
  heading: "PAUSED",
  choices: [
    { name: "Resume", title: "Back to the action" },
    { name: "Retry", title: "Start this run over" },
    { name: "Quit", title: "Leave this run" },
  ],
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
  const custom: Custom = await createCustom(texture, droneTexture);
  const banner: Banner = createBanner(fieldWidth, fieldHeight);
  const customMenu: Menu = { heading: "CUSTOM", choices: new Array() };
  let customing: boolean = false;
  let customIndex: number = 0;
  let paused: boolean = false;
  let titleToken: number = 0;
  let best: number = 0;
  let menu: Menu = modesMenu;
  let zenning: boolean = false;
  let zenElapsed: number = 0;
  let active: boolean = false;
  let rolling: boolean = false;
  const keyboard: Keyboard = createKeyboard(() => active);

  function reset(): void {
    hud.stats.score = 0;
    hud.stats.hiScore = 0;
    hud.stats.graze = 0;
    hud.stats.lives = startLives;
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
    banner.setScale(scale);
  }

  fieldMask.rect(0, 0, fieldWidth, fieldHeight).fill(0xffffff);
  field.position.set(fieldX, fieldY);
  field.addChild(
    back,
    zen.view,
    custom.view,
    fieldMask,
    ...pilot.layers(),
    banner.view,
  );
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
  window.addEventListener("blur", () => {
    if (active && !rolling) {
      pause();
    }
  });

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
    if (customing) {
      playCustom(delta);
      return;
    }

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

  function setPilotShown(shown: boolean): void {
    for (const layer of pilot.layers()) {
      layer.visible = shown;
    }
  }

  function playCustom(delta: number): void {
    const input: Vector = steering(keyboard.pressed);

    custom.update(delta, {
      x: input.x,
      y: input.y,
      focused: keyboard.pressed(focusKeys),
      shooting: keyboard.pressed(shotKeys),
      bombing: keyboard.pressed(bombKeys),
    });
    hud.stats.score = custom.score();
    hud.stats.hiScore = Math.max(best, custom.score());
    hud.stats.lives = Math.max(startLives - custom.hits(), 0);
    hud.stats.bombs = custom.bombs();
    hud.stats.graze = custom.grazes();
    hud.refresh();

    const outcome: Outcome | null = custom.outcome();

    if (outcome !== null) {
      finishCustom(outcome);
    }
  }

  function finishCustom(outcome: Outcome): void {
    titleToken++;
    const stageId: string = custom.stage()!.id;
    const score: number = custom.score();
    const record: boolean = recordScore(stageId, score);

    active = false;
    rolling = true;
    keyboard.clear();
    banner.show(
      outcome === "clear" ? "STAGE CLEAR" : "GAME OVER",
      "SCORE " + score,
      record,
    );
    tween(app.ticker, resultTime, () => undefined).then(() => {
      if (!customing) {
        return;
      }

      banner.hide();
      stopCustom();
      openCustomMenu();
    });
  }

  function stopCustom(): void {
    if (!customing) {
      return;
    }

    customing = false;
    custom.stop();
    setPilotShown(true);
    hud.setLook(null, null);
    hud.setBadge("NORMAL");
  }

  function openCustomMenu(): Promise<void> {
    customMenu.choices = custom.choices();

    return openMenu(customMenu);
  }

  async function startCustom(index: number): Promise<void> {
    selector.setActive(false);
    rolling = true;

    const run: Run | null = await custom.start(index);

    if (run === null) {
      rolling = false;
      selector.setActive(true);
      return;
    }

    reset();
    customing = true;
    customIndex = index;
    best = bestScore(run.stage.id);
    setPilotShown(false);
    hud.setLook(run.wallpaper, run.palette);
    hud.setBadge(run.difficulty);
    hud.stats.hiScore = best;
    hud.refresh();
    selector.rollUp().then(() => {
      const owner: number = ++titleToken;

      rolling = false;
      active = customing;
      banner.show(
        run.stage.name.toUpperCase(),
        run.difficulty.toUpperCase(),
        false,
      );
      tween(app.ticker, titleTime, () => undefined).then(() => {
        if (owner === titleToken && active) {
          banner.hide();
        }
      });
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
        openCustomMenu();
      } else if (index === 2) {
        openMenu(multiplayerMenu);
      } else {
        startPlaying(true);
      }
    } else if (menu === stagesMenu) {
      startPlaying(false);
    } else if (menu === customMenu && custom.count() > 0) {
      void startCustom(index);
    } else if (menu === pauseMenu) {
      if (index === 0) {
        resume();
      } else if (index === 1) {
        retry();
      } else {
        quit();
      }
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

  function pause(): void {
    titleToken++;
    paused = true;
    banner.show("PAUSED", "ESC TO RESUME", false);
    openMenu(pauseMenu);
  }

  function resume(): void {
    selector.setActive(false);
    rolling = true;
    banner.hide();
    selector.rollUp().then(() => {
      rolling = false;
      paused = false;
      active = true;
    });
  }

  function retry(): void {
    paused = false;
    banner.hide();

    if (customing) {
      stopCustom();
      void startCustom(customIndex);
    } else if (zenning) {
      stopZen();
      startPlaying(true);
    } else {
      startPlaying(false);
    }
  }

  function quit(): void {
    const wasZen: boolean = zenning;

    paused = false;
    banner.hide();

    if (customing) {
      stopCustom();
      openCustomMenu();
      return;
    }

    stopZen();
    openMenu(wasZen ? modesMenu : stagesMenu);
  }

  function goBack(): boolean {
    if (rolling) {
      return true;
    }

    if (active) {
      pause();
      return true;
    }

    if (paused) {
      resume();
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
    stopCustom();
    paused = false;
    banner.hide();
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
