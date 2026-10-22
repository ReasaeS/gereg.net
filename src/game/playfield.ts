import {
  Container,
  Graphics,
  type Application,
  type Texture,
  type Ticker,
} from "pixi.js";
import { createHud, type Hud } from "./hud";
import type { Stage, Vector } from "../create/types";
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
import {
  createSelector,
  type Choice,
  type Menu,
  type Selector,
} from "./selector";
import { levels, type Level } from "./levels";
import { createZen, type Zen } from "./zen";
import { minPower } from "./drones";
import { startBombs } from "./bomb";
import { createPilot, type Pilot } from "./pilot";
import {
  createCustom,
  formatLength,
  startLives,
  type Custom,
  type Leg,
  type Outcome,
  type Plan,
  type Tally,
} from "./custom";
import { createBanner, type Banner } from "./banner";
import { createResults, type Results } from "./results";
import { bestScore, recordScore } from "./records";
import { addStats } from "./stats";
import { checkAchievements } from "./achievements";
import {
  bombKeys,
  createKeyboard,
  focusKeys,
  promptName,
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
const resultsDelay: number = 700; // ms
const watchSpeeds: Array<number> = [1, 2, 4];
const titleTime: number = 2200; // ms
const attractDelay: number = 350; // ms
const emptyTime: number = 2200; // ms
const favouriteTime: number = 1200; // ms
const previewDetail: string = "ENTER TO PLAY  ·  F TO FAVOURITE";
const modesMenu: Menu = {
  heading: "PLAY",
  remember: true,
  choices: [
    { name: "Story", title: "Fight through the stages" },
    { name: "Custom", title: "Play your games" },
    { name: "Multiplayer", title: "Play alongside others" },
    { name: "Zen", title: "Roam under your own skies" },
    { name: "Watch", title: "Sit back while your stages play" },
  ],
};
const stagesMenu: Menu = {
  heading: "STAGE SELECT",
  searchable: true,
  choices: levels.map((level: Level) => ({
    name: level.name,
    title: level.title,
  })),
};
const resumeChoice: Choice = { name: "Resume", title: "Back to the action" };
const retryChoice: Choice = { name: "Retry", title: "Start this run over" };
const stageChoice: Choice = {
  name: "Retry stage",
  title: "Practice from this stage",
};
const quitChoice: Choice = { name: "Quit", title: "Leave this run" };
const pauseMenu: Menu = {
  heading: "PAUSED",
  choices: [resumeChoice, retryChoice, quitChoice],
};
const continueMenu: Menu = {
  heading: "CONTINUE?",
  choices: [
    { name: "Continue", title: "Keep going, score resets to 0" },
    { name: "Give up", title: "End the run here" },
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
  const results: Results = createResults(fieldWidth, fieldHeight);
  let resultsReady: boolean = false;
  let attracting: boolean = false;
  let watching: boolean = false;
  let watchSpeed: number = 1;
  let badge: string = "NORMAL";
  let attractToken: number = 0;
  let favouriteToken: number = 0;
  const customMenu: Menu = {
    heading: "CUSTOM",
    choices: new Array(),
    remember: true,
    searchable: true,
  };
  const difficultyMenu: Menu = {
    heading: "DIFFICULTY",
    choices: new Array(),
    remember: true,
  };
  const startMenu: Menu = {
    heading: "START FROM",
    choices: new Array(),
    remember: true,
    searchable: true,
  };
  let startPlan: Plan | null = null;
  let startBack: Menu = customMenu;
  let customing: boolean = false;
  let customPick: number = 0;
  let customPlan: Plan | null = null;
  let legOrder: number = 0;
  let runTime: number = 0;
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
    results.setScale(scale);
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
    results.view,
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

  results.view.eventMode = "static";
  results.view.on("pointertap", closeResults);
  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (
      view.visible &&
      results.shown() &&
      (["Enter", "NumpadEnter", "Space"].includes(event.code) ||
        shotKeys.includes(event.code))
    ) {
      closeResults();
      event.preventDefault();
    } else if (view.visible && results.shown() && event.code === "KeyR") {
      retryResults();
      event.preventDefault();
    }
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (
      !view.visible ||
      rolling ||
      active ||
      menu !== customMenu ||
      results.shown() ||
      custom.count() === 0 ||
      event.code !== "KeyF" ||
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    const index: number = custom.toggleFavourite(selector.chosenIndex());

    const owner: number = ++favouriteToken;

    customMenu.choices = custom.choices();
    selector.reload(index);
    banner.show(
      customMenu.choices[index]?.starred === true
        ? "ADDED TO FAVOURITES"
        : "REMOVED FROM FAVOURITES",
      "F TO TOGGLE",
      false,
    );
    tween(app.ticker, favouriteTime, () => undefined).then(() => {
      if (owner !== favouriteToken || menu !== customMenu || active) {
        return;
      }

      if (attracting) {
        banner.show("PREVIEW CONTENT", previewDetail, false);
      } else {
        banner.hide();
      }
    });
    event.preventDefault();
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (
      view.visible &&
      zenning &&
      active &&
      event.code === "KeyN" &&
      !event.repeat &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      zen.next();
      event.preventDefault();
    }
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (
      !view.visible ||
      !watching ||
      rolling ||
      event.repeat ||
      !shotKeys.includes(event.code)
    ) {
      return;
    }

    watchSpeed =
      watchSpeeds[(watchSpeeds.indexOf(watchSpeed) + 1) % watchSpeeds.length]!;
    showBadge();
    event.preventDefault();
  });

  app.ticker.add((ticker: Ticker) => {
    if (!view.visible) {
      return;
    }

    zen.update(frameDelta(ticker));

    if (!active) {
      if (attracting || watching) {
        for (let pass = 0; pass < (watching ? watchSpeed : 1); pass++) {
          runClock(clock, frameDelta(ticker), stepShow);
        }
      }

      return;
    }

    if (zenning) {
      zenElapsed += frameDelta(ticker);
      hud.setElapsed(zenElapsed);
    }

    runClock(clock, frameDelta(ticker), movePlayer);
  });

  function stepShow(delta: number): void {
    custom.update(delta, {
      x: 0,
      y: 0,
      focused: false,
      shooting: false,
      bombing: false,
    });

    const leg: Leg | null = custom.takeLeg();

    if (leg !== null) {
      dress(leg);

      if (watching) {
        showTitle(leg);
      }
    }

    if (watching) {
      hud.stats.score = custom.score();
      hud.stats.hiScore = Math.max(hud.stats.hiScore, custom.score());
      hud.stats.lives = Math.max(startLives - custom.hits(), 0);
      hud.stats.bombs = custom.bombs();
      hud.stats.graze = custom.grazes();
      hud.stats.power = custom.power();
      hud.refresh();
    }
  }

  function attractPlan(index: number): Plan | null {
    if (index < 0) {
      return null;
    }

    if (menu === customMenu) {
      return custom.count() > 0 ? custom.plan(index, 0) : null;
    }

    if (menu === difficultyMenu) {
      return custom.plan(customPick, index);
    }

    if (menu === startMenu && startPlan !== null) {
      return index === 0
        ? startPlan
        : {
            ...startPlan,
            stages: startPlan.stages.slice(index - 1),
            first: index - 1,
            practice: true,
          };
    }

    return null;
  }

  function attractMenu(value: Menu): boolean {
    return (
      value === customMenu || value === difficultyMenu || value === startMenu
    );
  }

  function queueAttract(index: number): void {
    const owner: number = ++attractToken;

    tween(app.ticker, attractDelay, () => undefined).then(async () => {
      if (owner !== attractToken || customing || watching) {
        return;
      }

      const plan: Plan | null = attractPlan(index);

      if (plan === null) {
        stopAttract();
        return;
      }

      const leg: Leg | null = await custom.attract(plan);

      if (owner !== attractToken || leg === null) {
        return;
      }

      if (!attracting) {
        banner.show("PREVIEW CONTENT", previewDetail, false);
      }

      attracting = true;
      setPilotShown(false);
      dress(leg);
    });
  }

  function stopAttract(): void {
    attractToken++;

    if (customing || watching) {
      return;
    }

    custom.stop();

    if (attracting) {
      attracting = false;
      banner.hide();
      setPilotShown(true);
      hud.setLook(null, null);
      hud.setBadge("NORMAL");
    }
  }

  function startWatch(): void {
    selector.setActive(false);
    rolling = true;
    stopAttract();
    void custom.watch().then((leg: Leg | null) => {
      if (leg === null) {
        rolling = false;
        selector.setActive(true);
        banner.show(
          "NOTHING TO WATCH",
          "BUILD A STAGE IN THE CREATE MENU",
          false,
        );
        tween(app.ticker, emptyTime, () => undefined).then(() => banner.hide());
        return;
      }

      reset();
      watching = true;
      watchSpeed = 1;
      setPilotShown(false);
      dress(leg);
      badge = "WATCH";
      showBadge();
      hud.refresh();
      hud.setReadout(false, true);
      selector.rollUp().then(() => {
        rolling = false;
        hud.setReadout(true, false);
        showTitle(leg);
      });
    });
  }

  function stopWatch(): void {
    if (!watching) {
      return;
    }

    watching = false;
    watchSpeed = 1;
    custom.stop();
    setPilotShown(true);
    hud.setLook(null, null);
    hud.setBadge("NORMAL");
    banner.hide();
  }

  selector.onSelect((index: number) => {
    if (attractMenu(menu)) {
      queueAttract(index);
    } else {
      stopAttract();
    }
  });

  function movePlayer(delta: number): void {
    if (customing) {
      if (active) {
        playCustom(delta);
      }

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
    if (!attractMenu(next)) {
      stopAttract();
    }

    active = false;
    rolling = true;
    keyboard.clear();
    pilot.hitbox.visible = false;
    selector.setActive(false);

    if (next !== pauseMenu && next !== continueMenu) {
      hud.setReadout(false, false);
    }

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

    runTime += delta;
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
    hud.stats.power = custom.power();
    hud.refresh();

    const outcome: Outcome | null = custom.outcome();

    if (outcome === "next") {
      nextStage();
    } else if (outcome === "over") {
      offerContinue();
    } else if (outcome !== null) {
      finishCustom(outcome);
    }
  }

  function showTitle(leg: Leg): void {
    const owner: number = ++titleToken;
    const plan: Plan | null = custom.current();

    banner.show(
      leg.stage.name.toUpperCase(),
      watching
        ? "WATCH  ·  " +
            leg.difficulty.toUpperCase() +
            "  ·  " +
            promptName("shot") +
            " TO SPEED UP  ·  ESC TO EXIT"
        : (plan?.practice === true ? "PRACTICE  ·  " : "") +
            (leg.total > 1 || plan?.practice === true
              ? (plan?.name.toUpperCase() ?? "") +
                "  ·  STAGE " +
                (leg.order + 1 + (plan?.first ?? 0)) +
                " / " +
                (leg.total + (plan?.first ?? 0))
              : leg.difficulty.toUpperCase()),
      false,
    );
    tween(app.ticker, titleTime, () => undefined).then(() => {
      if (owner === titleToken && (active || watching)) {
        banner.hide();
      }
    });
  }

  function dress(leg: Leg): void {
    hud.setLook(leg.wallpaper, leg.palette);
    badge = leg.difficulty;
    showBadge();
  }

  function showBadge(): void {
    hud.setBadge(watching && watchSpeed > 1 ? watchSpeed + "X SPEED" : badge);
  }

  function nextStage(): void {
    const leg: Leg | null = custom.advance();

    if (leg === null) {
      finishCustom("clear");
      return;
    }

    legOrder = leg.order;
    dress(leg);
    showTitle(leg);
  }

  function offerContinue(): void {
    titleToken++;
    custom.setPaused(true);
    banner.show("GAME OVER", "SCORE " + custom.score(), false);
    openMenu(continueMenu);
  }

  function continueRun(): void {
    custom.resurrect();
    resume();
  }

  function giveUp(): void {
    selector.setActive(false);
    rolling = true;
    selector.rollUp().then(() => finishCustom("over"));
  }

  function finishCustom(outcome: Outcome): void {
    titleToken++;
    const plan: Plan = custom.current()!;
    const score: number = custom.score();
    const continued: number = custom.continues();
    const record: boolean =
      continued === 0 && !plan.practice && recordScore(plan.id, score);

    const tally: Tally = custom.tally(outcome);

    addStats({
      clears: outcome === "over" ? 0 : 1,
      gameOvers: outcome === "over" ? 1 : 0,
      misses: tally.misses,
      bombs: tally.bombs,
      grazes: tally.graze,
      items: tally.items,
      score: score,
      best: plan.practice ? 0 : score,
    });
    checkAchievements({
      cleared: outcome !== "over",
      misses: tally.misses,
      bombs: tally.bombs,
      continues: continued,
      stages: plan.stages.length,
    });
    const rows: Array<[string, string]> = [
      ["Score", score.toLocaleString()],
      ["Best", Math.max(best, record ? score : 0).toLocaleString()],
    ];

    if (tally.total > 1) {
      rows.push(["Stages cleared", tally.cleared + " / " + tally.total]);
    }

    rows.push(
      ["Time", formatLength(runTime)],
      ["Graze", String(tally.graze)],
      ["Items", String(tally.items)],
      ["Bombs used", String(tally.bombs)],
      ["Misses", String(tally.misses)],
    );

    if (continued > 0) {
      rows.push(["Continues", String(continued)]);
    }

    active = false;
    rolling = true;
    resultsReady = false;
    keyboard.clear();
    banner.hide();
    results.show(
      outcome === "over"
        ? "GAME OVER"
        : plan.stages.length > 1
          ? "ALL CLEAR"
          : "STAGE CLEAR",
      rows,
      record,
      plan.name,
    );
    tween(app.ticker, resultsDelay, () => undefined).then(() => {
      resultsReady = true;
    });
  }

  function closeResults(): void {
    if (!results.shown() || !resultsReady) {
      return;
    }

    resultsReady = false;
    results.hide();
    stopCustom();
    openCustomMenu();
  }

  function retryResults(): void {
    const plan: Plan | null = customPlan;

    if (!results.shown() || !resultsReady || plan === null) {
      return;
    }

    resultsReady = false;
    results.hide();
    stopCustom();
    void startCustom(plan);
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

  function choosePlan(plan: Plan | null): void {
    if (plan === null || plan.stages.length <= 1) {
      void startCustom(plan);
      return;
    }

    const best: number = bestScore(plan.id);

    if (startPlan?.id !== plan.id) {
      startMenu.selected = 0;
    }

    startPlan = plan;
    startBack = menu;
    startMenu.choices = [
      {
        name: "Full run",
        title:
          plan.stages.length + " stages" + (best > 0 ? "  Best " + best : ""),
      },
      ...plan.stages.map((stage: Stage, index: number) => ({
        name: "Stage " + (index + 1),
        title: stage.name + "  Practice",
      })),
    ];
    openMenu(startMenu);
  }

  function openCustomMenu(): Promise<void> {
    customMenu.choices = custom.choices();

    return openMenu(customMenu);
  }

  async function startCustom(plan: Plan | null): Promise<void> {
    if (plan === null) {
      return;
    }

    stopAttract();
    selector.setActive(false);
    rolling = true;

    const leg: Leg | null = await custom.start(plan);

    if (leg === null) {
      rolling = false;
      selector.setActive(true);
      return;
    }

    reset();
    addStats({ runs: 1 });
    runTime = 0;
    customing = true;
    legOrder = leg.order;
    customPlan = plan;
    best = plan.practice ? 0 : bestScore(plan.id);
    setPilotShown(false);
    dress(leg);
    hud.stats.hiScore = best;
    hud.refresh();
    hud.setReadout(false, true);
    selector.rollUp().then(() => {
      rolling = false;
      hud.setReadout(true, false);
      active = customing;
      showTitle(leg);
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

    hud.setReadout(false, true);
    selector.rollUp().then(() => {
      rolling = false;
      hud.setReadout(true, false);
      active = true;
    });
  }

  function stopZen(): void {
    if (zenning) {
      addStats({ zen: zenElapsed });
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
      } else if (index === 3) {
        startPlaying(true);
      } else {
        startWatch();
      }
    } else if (menu === stagesMenu) {
      startPlaying(false);
    } else if (menu === customMenu && custom.count() > 0) {
      if (customPick !== index) {
        difficultyMenu.selected = 0;
      }

      customPick = index;
      difficultyMenu.choices = custom.gameChoices(index);
      openMenu(difficultyMenu);
    } else if (menu === difficultyMenu) {
      choosePlan(custom.plan(customPick, index));
    } else if (menu === startMenu && startPlan !== null) {
      void startCustom(
        index === 0
          ? startPlan
          : {
              ...startPlan,
              stages: startPlan.stages.slice(index - 1),
              first: index - 1,
              practice: true,
            },
      );
    } else if (menu === continueMenu) {
      if (index === 0) {
        continueRun();
      } else {
        giveUp();
      }
    } else if (menu === pauseMenu) {
      const choice: Choice | undefined = pauseMenu.choices[index];

      if (choice === resumeChoice) {
        resume();
      } else if (choice === retryChoice) {
        retry();
      } else if (choice === stageChoice) {
        retryStage();
      } else {
        quit();
      }
    }
  });

  function show(): Promise<void> {
    reset();
    hud.refresh();
    hud.setReadout(false, true);
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
    custom.setPaused(true);
    paused = true;
    pauseMenu.choices = [
      resumeChoice,
      retryChoice,
      ...(customing && legOrder > 0 ? [stageChoice] : new Array<Choice>()),
      quitChoice,
    ];
    banner.show(
      "PAUSED",
      (customing ? formatLength(runTime) + "  ·  " : "") + "ESC TO RESUME",
      false,
    );
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
      custom.setPaused(false);
    });
  }

  function retry(): void {
    paused = false;
    banner.hide();

    if (customing) {
      stopCustom();
      void startCustom(customPlan);
    } else if (zenning) {
      stopZen();
      startPlaying(true);
    } else {
      startPlaying(false);
    }
  }

  function retryStage(): void {
    const plan: Plan | null = customPlan;

    paused = false;
    banner.hide();
    stopCustom();

    if (plan !== null) {
      void startCustom({
        ...plan,
        stages: plan.stages.slice(legOrder),
        first: plan.first + legOrder,
        practice: true,
      });
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
    if (watching) {
      stopWatch();
      openMenu(modesMenu);
      return true;
    }

    if (results.shown()) {
      closeResults();
      return true;
    }

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

    if (menu === difficultyMenu) {
      openCustomMenu();
      return true;
    }

    if (menu === startMenu) {
      if (startBack === customMenu) {
        openCustomMenu();
      } else {
        openMenu(startBack);
      }

      return true;
    }

    if (menu === continueMenu) {
      giveUp();
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
    stopWatch();
    stopAttract();
    paused = false;
    banner.hide();
    results.hide();
    resultsReady = false;
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
