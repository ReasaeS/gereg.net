import {
  Container,
  Graphics,
  Text,
  type Application,
  type Ticker,
} from "pixi.js";
import { droneTexture, playerTexture } from "../../editor/drawings";
import { loadAudio, playSound, stopSounds } from "../sound";
import { cleanName } from "../transcript";
import { createClock, runClock, type Clock } from "../../game/clock";
import { bombKeys, playKeys, shotKeys } from "../../game/input";
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
import type {
  Background,
  Bullet,
  Creations,
  Effect,
  Enemy,
  Pattern,
  Sigil,
  Sound,
  Spawn,
  Spell,
  Stage,
  Vessel,
} from "../types";
import { drawVesselFallback, readVessel, vesselTexture } from "../vessel";
import { readBullet } from "../energy";
import { bulletSide, vesselSide } from "../defaults";
import { drawBulletDefault } from "../../editor/default";
import type { Pixels } from "../../editor/pixels";
import {
  isLocked,
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
  type Option,
} from "../../ui/widgets";
import { createRows, type Rows } from "../../ui/rows";
import { createText, screenResolution, sharpen } from "../../ui/text";
import { createGlide, type Glide } from "../../ui/motion";
import { loadTexture, removeUnused } from "../images";
import { createWallpaperView, type WallpaperView } from "../wallpaper";
import { createGallery, type Gallery, type Live } from "../gallery/gallery";
import type { Action, Creation, Deal, Kind } from "../gallery/kinds";
import { createBrowser, type Browser, type Card } from "./browser";
import { createScript, type Script } from "./script";
import type { Cursor, Item, Selection, Studio, Tab } from "./studio";
import { createKit, type Kit } from "./kit";
import { createSelection } from "./selection";
import { generateStage } from "../generate";
import {
  isRolling,
  markDirty,
  registerTab,
  rollById,
  useRunner,
} from "../dice";
import { createScenes, type Scenes } from "./scenes";
import { createUploads, type Uploads } from "./uploads";
import { createMarkers, type Markers } from "./markers";
import { createPainter, type Painter } from "./painter";
import { createComposer, type Composer } from "./composer";
import { createTransport, type Transport } from "./transport";
import { createTimeline, transportWidth, type Timeline } from "./timeline";
import { createDrop, type Drop } from "./drop";
import { createToast, type Toast } from "../../ui/toast";
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
import { addBulletTab } from "./tabs/bullet";
import { addVesselTab } from "./tabs/vessel";
import { addPaletteTab } from "./tabs/palette";
import { addSpellTab } from "./tabs/spell";
import { addSigilTab } from "./tabs/sigil";
import { addSoundTab, type SoundTab } from "./tabs/sound";
import { addCutsceneTab } from "./tabs/cutscene";
import { addCharacterTab } from "./tabs/character";
import { addStageTab, type StageTab } from "./tabs/stage";
import { addRunTab } from "./tabs/run";
import { addGameTab } from "./tabs/game";
import { addOstTab } from "./tabs/ost";
import { addEffectTab } from "./tabs/effect";
import { gameStages, runStages } from "../packs";
import { onTyping } from "../../ui/typing";

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
const sceneKeys: Array<string> = ["Enter", "NumpadEnter"];

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
    track: 0,
  };
  const pick: Selection = createSelection(creations, tabs, () => tab, cursor);

  useRunner((kind: string, item: { id: string }, action: () => void) =>
    pick.withItem(kind, item as Item, action),
  );
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
  const preview: Preview = rolledPreview(
    await createPreview(
      playerTexture(),
      droneTexture(),
      (id: string | null) =>
        rollById(creations, "background", pick.backgroundById(id)),
      (id: string | null) => rollById(creations, "sigil", pick.sigilById(id)),
      (id: string | null) => rollById(creations, "spell", pick.spellById(id)),
      (id: string | null) =>
        rollById(creations, "pattern", pick.patternById(id)),
      (id: string | null) => rollById(creations, "bullet", pick.bulletById(id)),
      (id: string | null) => rollById(creations, "vessel", pick.vesselById(id)),
      (id: string | null) => rollById(creations, "effect", pick.effectById(id)),
    ),
  );
  const ticks: Clock = createClock();
  const kit: Kit = createKit(
    changed,
    refresh,
    browseCards,
    creations,
    (): Item => {
      const shown: Tab | undefined = tab as Tab | undefined;

      return shown?.items()[shown.selected] ?? { id: "", name: "" };
    },
  );

  function rolledPreview(base: Preview): Preview {
    const setBackground: Preview["setBackground"] = base.setBackground;
    const setPattern: Preview["setPattern"] = base.setPattern;
    const setEnemy: Preview["setEnemy"] = base.setEnemy;
    const setSigil: Preview["setSigil"] = base.setSigil;
    const setSpell: Preview["setSpell"] = base.setSpell;
    const setStage: Preview["setStage"] = base.setStage;
    const setEffect: Preview["setEffect"] = base.setEffect;

    return {
      ...base,
      setBackground: (value: Background | null) =>
        setBackground(rollById(creations, "background", value)),
      setPattern: (value: Pattern | null) =>
        setPattern(rollById(creations, "pattern", value)),
      setEnemy: (value: Enemy | null, bar: number | null) =>
        setEnemy(rollById(creations, "enemy", value), bar),
      setSigil: (value: Sigil | null) =>
        setSigil(rollById(creations, "sigil", value)),
      setEffect: (value: Effect | null) =>
        setEffect(rollById(creations, "effect", value)),
      setSpell: (value: Spell | null, attack: Pattern | null) =>
        setSpell(
          rollById(creations, "spell", value),
          rollById(creations, "pattern", attack),
        ),
      setStage: (
        value: Stage | null,
        resolve: (spawn: Spawn) => Enemy | null,
      ) =>
        setStage(rollById(creations, "stage", value), (spawn: Spawn) =>
          rollById(creations, "enemy", resolve(spawn)),
        ),
    };
  }
  const browser: Browser = createBrowser(app, () => creations);
  const script: Script = createScript(app);
  const painter: Painter = createPainter(
    app,
    () => changed(),
    () => refresh(),
  );
  const composer: Composer = createComposer(
    app,
    () => changed(),
    () => refresh(),
    (initial: string, apply: (text: string) => string | null) =>
      script.open(initial, apply, new Array(), "lyrics"),
  );
  const toast: Toast = createToast(app);
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
    spriteRow: (name?: string, target?: () => { sprite?: string | null }) =>
      uploads.spriteRow(name, target),
    pickImage: () => uploads.pickImage(),
    renameDefault: (kind: Kind, item: Item) =>
      renameDefault(creations, kind, item),
    playScene: scenes.play,
    showPalette: scenes.showPalette,
    pause: () => transport.pause(),
    buildMarkers: () => markers.build(),
    placeMarkers: () => markers.place(),
    openCard: (kind: Kind, index: number) => {
      saveCreations(creations);
      showItem(kind, index);
    },
    paintVessel: () => {
      const vessel: Vessel = pick.vessel();

      painter.open({
        name: vessel.name,
        side: vesselSide(vessel),
        read: (pixels: Pixels) => readVessel(vessel, pixels),
        write: (code: string) => {
          vessel.pixels = code;
          vessel.look = "drawn";
          vesselTexture(vessel);
        },
        drawDefault: drawVesselFallback,
      });
    },
    paintBullet: () => {
      const bullet: Bullet = pick.bullet();

      painter.open({
        name: bullet.name,
        side: bulletSide,
        read: (pixels: Pixels) => readBullet(bullet, pixels),
        write: (code: string) => {
          bullet.pixels = code;
        },
        drawDefault: drawBulletDefault,
      });
    },
    composeSong: () => {
      transport.stopTyping();
      composer.open(pick.sound());
    },
    editTranscript: (
      initial: string,
      apply: (text: string) => string | null,
      sounds: Array<string>,
    ) => {
      transport.stopTyping();
      script.open(initial, apply, sounds);
    },
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

  onTyping(() => browser.shown() || script.shown() || transport.typing());

  function browseCards<T>(
    name: string,
    kind: Kind | Array<Kind>,
    options: Array<Option<T>>,
    current: T,
    choose: (value: T) => void,
  ): void {
    const kinds: Array<Kind> = Array.isArray(kind) ? kind : [kind];
    const cards: Array<Card> = options.map((option: Option<T>) => {
      for (const value of kinds) {
        const list: Array<Item> = listOf(creations, value);
        const index: number = list.findIndex(
          (item: Item) => (item.id as unknown) === option.value,
        );

        if (index >= 0) {
          return {
            label: list[index]!.name,
            entry: { kind: value, index: index, item: list[index] as Creation },
          };
        }
      }

      return { label: option.label, entry: null };
    });

    transport.stopTyping();
    browser.open(
      name,
      cards,
      options.findIndex((option: Option<T>) => option.value === current),
      (index: number) => choose(options[index]!.value),
    );
  }

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
        : pick.wallpaperById(
            tab.name === "ost"
              ? (pick.ost().tracks[cursor.track]?.wallpaper ?? null)
              : (lookStage()?.wallpaper ?? null),
          ),
    );
  }

  function changed(): void {
    if (isRolling()) {
      return;
    }

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
    registerTab(name, kit.claimSections());
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
  addBulletTab(studio);
  addVesselTab(studio);

  addPaletteTab(studio);
  addSpellTab(studio);
  addSigilTab(studio);

  const soundTab: SoundTab = addSoundTab(studio);

  addOstTab(studio);
  addEffectTab(studio);
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
    if (isRolling()) {
      return;
    }

    markDirty();

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

  const cards: [Live, Live] = [
    await createCards(creations, pick),
    await createCards(creations, pick),
  ];
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
        void exportCard(creations, kind, index).then(() =>
          toast.show("Exported " + listOf(creations, kind)[index]!.name),
        );
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
    toast.show(
      "Imported " + listOf(creations, imported.kind)[imported.index]!.name,
    );
  }

  function dropLabel(): string | null {
    if (painter.shown() || composer.shown()) {
      return null;
    }

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
    toast.show("Duplicated " + listOf(creations, kind)[copy]!.name);
  }

  function deleteItem(kind: Kind, index: number): void {
    const item: Item | undefined = listOf(creations, kind)[index];

    if (item === undefined) {
      return;
    }

    if (kind === "sound" && isLocked(item.id)) {
      toast.show(item.name + " is locked");
      return;
    }

    if (!window.confirm('Delete "' + item.name + '"?')) {
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
    cursor.track = 0;
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
    composer.close();
    stopSounds();
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
  view.addChild(
    editor,
    gallery.view,
    browser.view,
    painter.view,
    composer.view,
    script.view,
    drop.view,
    toast.view,
  );

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
    browser.layout();
    painter.layout(frameScale);
    composer.layout(frameScale);
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
    browser.update(delta);
    script.update(delta);

    if (!editing) {
      return;
    }

    markers.view.visible = tab.name === "stage" && !transport.playing();
    preview.overlay.visible = markers.view.visible;
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
      browser.shown() ||
      script.shown() ||
      painter.shown() ||
      composer.shown()
    ) {
      return;
    }

    if (
      active &&
      !editing &&
      event.altKey &&
      event.code === "KeyG" &&
      !event.repeat &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      generateStage(creations);
      saveCreations(creations);
      openItem("stage", creations.stages.length - 1);
      toast.show("Random stage generated");
      event.preventDefault();
      return;
    }

    if (
      active &&
      editing &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !transport.typing() &&
      (event.code === "KeyZ" || event.code === "KeyY")
    ) {
      const redo: boolean = event.code === "KeyY" || event.shiftKey;
      const place: Place | null = redo ? history.redo() : history.undo();

      toast.show(
        place === null
          ? redo
            ? "Nothing to redo"
            : "Nothing to undo"
          : redo
            ? "Redo"
            : "Undo",
      );
      travel(place);
      event.preventDefault();
      return;
    }

    if (
      active &&
      editing &&
      tab.name === "stage" &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !transport.typing() &&
      !transport.playtesting() &&
      ["KeyC", "KeyV", "KeyD"].includes(event.code)
    ) {
      const message: string | null =
        event.code === "KeyC"
          ? stageTab.copy(event.shiftKey)
          : event.code === "KeyV"
            ? stageTab.paste()
            : event.shiftKey
              ? stageTab.mirror()
              : stageTab.duplicate();

      toast.show(message ?? "Nothing copied yet");
      event.preventDefault();
      return;
    }

    if (!active || !editing || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.code === "KeyP" && !transport.typing()) {
      if (event.shiftKey) {
        transport.watch();
      } else {
        transport.playtest();
      }

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
      (sceneKeys.includes(event.code) ||
        shotKeys.includes(event.code) ||
        bombKeys.includes(event.code))
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

    if (!value) {
      browser.close();
      script.close();
      painter.close();
      composer.close();
      stopSounds();
    }

    view.eventMode = value ? "passive" : "none";
    drop.hide();
    gallery.setActive(value && !editing);
  }

  function back(): boolean {
    if (browser.shown()) {
      browser.close();
      return true;
    }

    if (script.shown()) {
      script.close();
      return true;
    }

    if (painter.shown()) {
      painter.close();
      return true;
    }

    if (composer.shown()) {
      composer.close();
      return true;
    }

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
    leave: () => (editing ? Promise.resolve() : gallery.disappear()),
    leaveTime: () => (editing ? 0 : gallery.disappearTime()),
    back: back,
    topic: () => (editing ? "editor" : "gallery"),
    subject: () =>
      !editing
        ? "gallery." + gallery.subject()
        : composer.shown()
          ? "editor.composer"
          : painter.shown()
            ? "editor.painter"
            : "editor." + tab.name,
  };
}

export { createMaker };
