import {
  Container,
  Graphics,
  Text,
  type Application,
  type Ticker,
} from "pixi.js";
import { droneTexture, playerTexture } from "../../editor/drawings";
import { loadAudio, playSound } from "../sound";
import { cleanName } from "../transcript";
import { createClock, runClock, type Clock } from "../../game/clock";
import { playKeys } from "../../game/input";
import {
  fieldHeight,
  fieldWidth,
  fieldX,
  fieldY,
  hudHeight,
  hudScale,
  hudWidth,
} from "../../game/field";
import type { PageContent } from "../../menu/page";
import {
  cubicBezier,
  frameDelta,
  tween,
  type Easing,
} from "../../effects/tween/tween";
import type { Creations, Sound, Stage } from "../types";
import {
  loadCreations,
  onSave,
  saveCreations,
  usedFiles,
  usedSprites,
} from "../storage";
import { createHistory, type History, type Place } from "./history";
import { createPreview, type Preview } from "../preview/preview";
import {
  chipHeight,
  rowHeight,
  rowWidth,
  type Control,
} from "../../ui/widgets";
import { createRows, type Rows } from "../../ui/rows";
import { createText, screenResolution, sharpen } from "../../ui/text";
import { createGlide, type Glide } from "../../ui/motion";
import { loadTexture, removeUnused } from "../images";
import { createWallpaperView, type WallpaperView } from "../wallpaper";
import { createGallery, type Gallery, type Live } from "../gallery/gallery";
import type { Action, Deal, Kind } from "../gallery/kinds";
import type { Cursor, Item, Selection, Studio, Tab } from "./studio";
import { createKit, type Kit } from "./kit";
import { createSelection } from "./selection";
import { createScenes, type Scenes } from "./scenes";
import { createUploads, type Uploads } from "./uploads";
import { createMarkers, type Markers } from "./markers";
import { createTransport, type Transport } from "./transport";
import { createTimeline, transportWidth, type Timeline } from "./timeline";
import { createDrop, type Drop } from "./drop";
import { createCards } from "./cards";
import { exportCard, importCard, type Imported } from "../share";
import {
  createEntry,
  deleteEntry,
  duplicateEntry,
  listOf,
  nameLength,
  renameDefault,
} from "./items";
import { addPatternTab } from "./tabs/pattern";
import { addEnemyTab } from "./tabs/enemy";
import { addBackgroundTab } from "./tabs/background";
import { addWallpaperTab } from "./tabs/wallpaper";
import { addPaletteTab } from "./tabs/palette";
import { addSpellTab } from "./tabs/spell";
import { addSigilTab } from "./tabs/sigil";
import { addSoundTab, type SoundTab } from "./tabs/sound";
import { addCutsceneTab } from "./tabs/cutscene";
import { addCharacterTab } from "./tabs/character";
import { addStageTab, type StageTab } from "./tabs/stage";
import { addRunTab } from "./tabs/run";
import { addGameTab } from "./tabs/game";
import { gameStages, runStages } from "../packs";

const sectionGap: number = 6; // units
const panelLeft: number = 430; // units
const panelTop: number = 12; // units
const panelBottom: number = 470; // units
const panelColor: string = "#01040f";
const panelAlpha: number = 0.55;
const panelPadding: number = 6; // units
const headingSize: number = 16; // units
const headingHeight: number = 22; // units
const swapOutDuration: number = 200; // ms
const swapInDuration: number = 380; // ms
const swapLead: number = 100; // ms
const swapDistance: number = 80; // px
const swapEasing: Easing = cubicBezier(0.34, 1.56, 0.64, 1);
const frameSmoothing: number = 0.25; // s
const sceneKeys: Array<string> = ["KeyZ", "KeyX", "Enter", "NumpadEnter"];

async function createMaker(app: Application): Promise<PageContent> {
  const view: Container = new Container();
  const controls: Container = new Container();
  const rows: Rows = createRows();
  const itemBar: Container = new Container();
  const board: Container = new Container();
  const editor: Container = new Container();
  const creations: Creations = loadCreations();
  const tabs: Array<Tab> = new Array();
  const cursor: Cursor = {
    spawn: 0,
    keyframe: 0,
    ring: 0,
    bar: 0,
    emotion: 0,
  };
  const pick: Selection = createSelection(creations, tabs, () => tab, cursor);
  const scenes: Scenes = createScenes(
    creations,
    () => pick,
    () => tab,
  );
  const gameFrame: Container = new Container();
  const hudFrame: WallpaperView = createWallpaperView(
    hudWidth,
    hudHeight,
    1,
    frameSmoothing,
  );
  const boardShown: Glide = createGlide(
    1,
    (value: number) => {
      board.alpha = value;
      board.visible = value > 0;
    },
    frameSmoothing,
  );
  const panelBack: Graphics = new Graphics();
  const frameMask: Graphics = new Graphics();
  const preview: Preview = await createPreview(
    playerTexture(),
    droneTexture(),
    pick.backgroundById,
    pick.sigilById,
    pick.spellById,
    pick.patternById,
  );
  const ticks: Clock = createClock();
  const kit: Kit = createKit(changed, refresh);
  let frameScale: number = 1;
  let tab: Tab;
  let active: boolean = false;
  let editing: boolean = false;
  let laidOut: Tab | null = null;
  let swapToken: number = 0;
  const studio: Studio = {
    app: app,
    creations: creations,
    preview: preview,
    scene: scenes.scene,
    cursor: cursor,
    kit: kit,
    pick: pick,
    tab: () => tab,
    addTab: addTab,
    changed: changed,
    refresh: refresh,
    cleanup: cleanup,
    refreshControls: refreshControls,
    spriteRow: () => uploads.spriteRow(),
    pickImage: () => uploads.pickImage(),
    renameDefault: (kind: Kind, item: Item) =>
      renameDefault(creations, kind, item),
    playScene: scenes.play,
    showPalette: scenes.showPalette,
    pause: () => transport.pause(),
    buildMarkers: () => markers.build(),
    placeMarkers: () => markers.place(),
  };
  const history: History = createHistory(creations, () => ({
    tab: tab.name,
    selected: tab.selected,
    cursor: { ...cursor },
  }));
  const uploads: Uploads = createUploads(studio);
  const markers: Markers = createMarkers(studio);
  const transport: Transport = createTransport(
    app,
    studio,
    () => active && editing,
    scenes.shown,
  );

  function boardWanted(): number {
    return tab.name === "wallpaper" ? 0 : 1;
  }

  function lookStage(): Stage | null {
    if (tab.name === "stage") {
      return pick.stage();
    }

    if (tab.name === "run") {
      return runStages(creations, pick.run())[0] ?? null;
    }

    if (tab.name === "game") {
      return gameStages(creations, pick.game())[0] ?? null;
    }

    return null;
  }

  function paintLook(): void {
    boardShown.set(boardWanted());
    hudFrame.show(
      tab.name === "wallpaper"
        ? pick.wallpaper()
        : pick.wallpaperById(lookStage()?.wallpaper ?? null),
    );
  }

  function changed(): void {
    saveCreations(creations);
    paintLook();

    if (tab.name !== "stage") {
      preview.clear();
      tab.show();
      return;
    }

    const now: number = preview.stageTime();
    const previous: number = Math.max(
      0,
      ...pick
        .stage()
        .keyframes.map((value) => value.time)
        .filter((value: number) => value <= now),
    );

    tab.show();
    preview.seek(previous);
  }

  function cleanup(): void {
    removeUnused(new Set([...usedFiles(creations), ...history.files()]));
  }

  function travel(place: Place | null): void {
    if (place === null) {
      return;
    }

    const next: Tab | undefined = tabs.find(
      (value: Tab) => value.name === place.tab,
    );

    if (transport.playtesting()) {
      transport.setPlaytesting(false);
    }

    if (next !== undefined) {
      next.selected = place.selected;
      tab = next;
    }

    for (const value of tabs) {
      value.selected = Math.max(
        Math.min(value.selected, value.items().length - 1),
        0,
      );
    }

    Object.assign(cursor, place.cursor);
    changed();
    refreshControls();
    refresh();
    history.finish();
  }

  function refreshControls(): void {
    for (const control of tab.controls) {
      control.refresh();
    }
  }

  function addTab(
    name: string,
    items: () => Array<Item>,
    list: Array<Control>,
    show: () => void,
  ): void {
    const panel: Container = new Container();

    for (let index = 0; index < list.length; index++) {
      list[index]!.view.y = index * rowHeight;
      panel.addChild(list[index]!.view);
    }

    panel.y = 0;
    panel.visible = false;
    rows.content.addChild(panel);
    tabs.push({
      name: name,
      items: items,
      selected: 0,
      panel: panel,
      controls: list,
      show: show,
    });
  }

  addPatternTab(studio);
  addEnemyTab(studio);
  addBackgroundTab(studio);
  addWallpaperTab(studio);
  addPaletteTab(studio);
  addSpellTab(studio);
  addSigilTab(studio);

  const soundTab: SoundTab = addSoundTab(studio);

  addCutsceneTab(studio);
  addCharacterTab(studio);
  addRunTab(studio);
  addGameTab(studio);

  const stageTab: StageTab = addStageTab(studio);
  const timeline: Timeline = createTimeline(
    studio,
    stageTab.selectKeyframe,
    transport.playChip,
  );

  tabs.unshift(tabs.pop()!);
  tab = tabs[0]!;

  const heading: Text = createText(headingSize, "#ffffff");
  heading.anchor.set(0, 0.5);
  heading.y = headingHeight / 2;
  itemBar.addChild(heading);

  rows.view.y = headingHeight + sectionGap;
  controls.addChild(itemBar, rows.view);

  function refresh(): void {
    if (tab.items()[tab.selected] === undefined) {
      return;
    }

    heading.text = pick.current().name.toUpperCase();

    for (let index = 0; index < tabs.length; index++) {
      const value: Tab = tabs[index]!;
      value.panel.visible = value === tab;
    }

    const snap: boolean = laidOut !== tab;

    if (snap) {
      rows.top();
    }

    laidOut = tab;
    rows.place(tab.controls, snap);
    layout();
    timeline.view.visible = tab.name === "stage";
    tab.show();
    paintLook();

    if (tab.name === "stage") {
      markers.build();
    }
  }

  const cards: Live = await createCards(creations, pick);
  const gallery: Gallery = createGallery(
    app,
    () => creations,
    (kind: Kind, index: number) => openItem(kind, index),
    (deal: Deal) => createItem(deal),
    (kind: Kind, index: number, action: Action) => {
      if (action === "rename") {
        renameItem(kind, index);
      } else if (action === "delete") {
        deleteItem(kind, index);
      } else if (action === "duplicate") {
        duplicateItem(kind, index);
      } else {
        void exportCard(creations, kind, index);
      }
    },
    cards,
  );
  const drop: Drop = createDrop(app, dropLabel, (file: File | undefined) => {
    if (active && !editing && file !== undefined) {
      void receiveCard(file);
      return;
    }

    if (!active || !editing) {
      return;
    }

    if (tab.name === "sound") {
      soundTab.useAudio(file);
    } else {
      uploads.useImage(file);
    }
  });

  async function receiveCard(file: File): Promise<void> {
    const imported: Imported | null = await importCard(creations, file);

    if (imported === null) {
      window.alert('"' + file.name + '" is not a GEREG.NET card file.');
      return;
    }

    saveCreations(creations);
    await Promise.all([
      ...[...usedSprites(creations)].map(loadTexture),
      ...creations.sounds.map((value: Sound) => loadAudio(value.file)),
    ]);
    gallery.focus(imported.kind, imported.index);
  }

  function dropLabel(): string | null {
    if (active && !editing) {
      return "DROP A CARD FILE TO IMPORT";
    }

    if (!active || !editing) {
      return null;
    }

    if (tab.name === "sound") {
      return "DROP AUDIO FILE FOR SOUND";
    }

    if (tab.name === "character") {
      return "DROP IMAGE FOR EMOTION SPRITE";
    }

    return pick.current().sprite === undefined
      ? null
      : "DROP IMAGE FOR " + tab.name.toUpperCase() + " SPRITE";
  }

  function renameItem(kind: Kind, index: number): void {
    const item: Item | undefined = listOf(creations, kind)[index];
    const name: string | null =
      item === undefined ? null : window.prompt("Name", item.name);

    if (item === undefined || name === null || name.trim() === "") {
      return;
    }

    item.name = (
      kind === "character" ? cleanName(name) || item.name : name.trim()
    ).slice(0, nameLength);
    saveCreations(creations);
    gallery.refresh();
  }

  function duplicateItem(kind: Kind, index: number): void {
    const copy: number = duplicateEntry(creations, kind, index);

    if (copy < 0) {
      return;
    }

    saveCreations(creations);
    gallery.focus(kind, copy);
  }

  function deleteItem(kind: Kind, index: number): void {
    const item: Item | undefined = listOf(creations, kind)[index];

    if (item === undefined || !window.confirm('Delete "' + item.name + '"?')) {
      return;
    }

    deleteEntry(creations, kind, index);

    for (const value of tabs) {
      value.selected = Math.max(
        Math.min(value.selected, value.items().length - 1),
        0,
      );
    }

    saveCreations(creations);
    cleanup();
    gallery.refresh();
  }

  function createItem(deal: Deal): void {
    const kind: Kind = createEntry(creations, deal);

    saveCreations(creations);
    openItem(kind, listOf(creations, kind).length - 1);
  }

  function showItem(kind: Kind, index: number): void {
    if (transport.playtesting()) {
      transport.setPlaytesting(false);
    }

    const next: Tab = tabs.find((value: Tab) => value.name === kind)!;

    next.selected = index;
    tab = next;
    cursor.spawn = 0;
    cursor.keyframe = 0;
    cursor.ring = 0;
    cursor.bar = 0;
    cursor.emotion = 0;
    kit.closeSections();
    laidOut = null;
    preview.clear();
    refresh();
    boardShown.snap(boardWanted());
  }

  function openItem(kind: Kind, index: number): void {
    editing = true;
    gallery.setActive(false);
    showItem(kind, index);
    history.begin();
    swap(gallery.view, editor, true);
  }

  function swap(from: Container, to: Container, animate: boolean): void {
    const token: number = ++swapToken;

    if (!animate) {
      from.visible = false;
      to.visible = true;
      from.alpha = 1;
      to.alpha = 1;
      from.x = 0;
      to.x = 0;
      return;
    }

    tween(app.ticker, swapOutDuration, (progress: number) => {
      if (token === swapToken) {
        from.alpha = 1 - progress;
        from.x = -swapDistance * progress * progress;
      }
    }).then(() => {
      if (token === swapToken) {
        from.visible = false;
        from.alpha = 1;
        from.x = 0;
      }
    });
    tween(app.ticker, swapOutDuration - swapLead, () => undefined).then(() => {
      if (token !== swapToken) {
        return;
      }

      to.visible = true;
      tween(app.ticker, swapInDuration, (progress: number) => {
        if (token === swapToken) {
          to.alpha = Math.min(progress * 2, 1);
          to.x = swapDistance * (1 - swapEasing(progress));
        }
      });
    });
  }

  function showSelector(animate: boolean = true): void {
    if (transport.playtesting()) {
      transport.setPlaytesting(false);
    }

    transport.stopTyping();
    editing = false;
    drop.fade();
    gallery.refresh();
    gallery.appear();
    gallery.setActive(active);
    preview.clear();
    swap(editor, gallery.view, animate && editor.visible);
  }

  transport.patternBar.position.set(
    fieldX + fieldWidth / 2 - transportWidth,
    fieldY + fieldHeight + (hudHeight - fieldY - fieldHeight - chipHeight) / 2,
  );
  transport.playtestBar.position.set(panelLeft, panelBottom - chipHeight);
  panelBack
    .rect(
      panelLeft - panelPadding,
      panelTop - panelPadding,
      rowWidth + panelPadding * 2,
      panelBottom - panelTop + panelPadding * 2,
    )
    .fill({ color: panelColor, alpha: panelAlpha });
  frameMask.rect(0, 0, hudWidth, hudHeight).fill(0xffffff);
  board.position.set(fieldX, fieldY);
  board.addChild(preview.view, soundTab.plot, scenes.scene.view);
  controls.position.set(panelLeft, panelTop);
  gameFrame.addChild(
    hudFrame.view,
    panelBack,
    board,
    controls,
    timeline.view,
    transport.patternBar,
    transport.playtestBar,
    frameMask,
  );
  gameFrame.mask = frameMask;
  editor.addChild(gameFrame);
  view.addChild(editor, gallery.view, drop.view);

  function layout(): void {
    const width: number = app.screen.width;
    const height: number = app.screen.height;
    const bottom: number = panelBottom - chipHeight - sectionGap;

    frameScale = hudScale(width, height);
    gameFrame.scale.set(frameScale);
    gameFrame.position.set(
      Math.round(width / 2 - (hudWidth * frameScale) / 2),
      Math.round(height / 2 - (hudHeight * frameScale) / 2),
    );
    rows.setViewport(bottom - panelTop - rows.view.y);
    sharpen(gameFrame, screenResolution(frameScale));
    drop.layout();
  }

  app.ticker.add((ticker: Ticker) => {
    if (view.parent?.visible !== true) {
      return;
    }

    const delta: number = frameDelta(ticker);

    if (editing) {
      rows.animate(delta);
    }

    drop.update(delta);

    if (!editing) {
      return;
    }

    preview.overlay.visible = tab.name === "stage" && !transport.playing();
    soundTab.plot.visible = tab.name === "sound";
    scenes.scene.view.visible = scenes.shown();

    if (scenes.shown()) {
      scenes.scene.update(delta);
    }

    transport.update(delta);

    if (
      transport.playtesting() ||
      (tab.name === "stage"
        ? transport.playing()
        : tab.name !== "pattern" || transport.patternPlaying())
    ) {
      runClock(ticks, frameDelta(ticker), preview.update);
    }

    if (timeline.view.visible) {
      timeline.draw();
    }
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (
      active &&
      editing &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !transport.typing() &&
      (event.code === "KeyZ" || event.code === "KeyY")
    ) {
      travel(
        event.code === "KeyY" || event.shiftKey
          ? history.redo()
          : history.undo(),
      );
      event.preventDefault();
      return;
    }

    if (!active || !editing || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.code === "KeyP" && !transport.typing()) {
      transport.playtest();
      event.preventDefault();
      return;
    }

    if (transport.playtesting() && playKeys.includes(event.code)) {
      return;
    }

    if (tab.name === "sound" && event.code === "Space") {
      playSound(pick.sound());
      event.preventDefault();
      return;
    }

    if (
      scenes.shown() &&
      !transport.typing() &&
      sceneKeys.includes(event.code)
    ) {
      scenes.scene.advance();
      event.preventDefault();
      return;
    }

    if (
      (tab.name === "stage" || tab.name === "pattern") &&
      event.code === "Space"
    ) {
      transport.togglePlaying();
      event.preventDefault();
      return;
    }
  });

  function setActive(value: boolean): void {
    if (!value && transport.playtesting()) {
      transport.setPlaytesting(false);
    }

    active = value;
    transport.stopTyping();
    view.eventMode = value ? "passive" : "none";
    drop.hide();
    gallery.setActive(value && !editing);
  }

  function back(): boolean {
    if (!editing) {
      return false;
    }

    if (transport.playtesting()) {
      transport.setPlaytesting(false);
      return true;
    }

    showSelector();
    return true;
  }

  onSave(() => {
    if (editing) {
      history.record();
    }
  });
  tab.panel.visible = true;
  refresh();
  Promise.all([
    ...[...usedSprites(creations)].map(loadTexture),
    ...creations.sounds.map((value: Sound) => loadAudio(value.file)),
  ]).then(() => {
    refresh();
    gallery.refresh();
    cleanup();
  });
  layout();
  editor.visible = false;
  showSelector(false);
  setActive(false);
  app.renderer.on("resize", layout);

  return {
    view: view,
    setActive: setActive,
    enter: () => {
      gallery.reset();
      showSelector(false);
    },
    fullscreen: () => true,
    leave: () => (editing ? Promise.resolve() : gallery.disappear()),
    leaveTime: () => (editing ? 0 : gallery.disappearTime()),
    back: back,
    topic: () => (editing ? "editor" : "gallery"),
  };
}

export { createMaker };
