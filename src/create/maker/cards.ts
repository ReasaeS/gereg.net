import type { Container } from "pixi.js";
import type {
  Background,
  Creations,
  Cutscene,
  Enemy,
  Game,
  Pattern,
  Run,
  Sigil,
  Spell,
  Stage,
} from "../types";
import { createScene, type Scene } from "../cutscene";
import { createPreview, type Preview } from "../preview/preview";
import { createClock, runClock, type Clock } from "../../game/clock";
import { droneTexture, playerTexture } from "../../editor/drawings";
import type { Live } from "../gallery/gallery";
import type { Kind } from "../gallery/kinds";
import { listOf } from "./items";
import { bulletDemo } from "./tabs/bullet";
import { vesselDemo } from "./tabs/vessel";
import { gameStages, runStages } from "../packs";
import type { Item, Selection } from "./studio";

async function createCards(
  creations: Creations,
  pick: Selection,
): Promise<Live> {
  const cardScene: Scene = createScene(
    () => undefined,
    () => undefined,
    () => creations.characters,
    true,
  );
  const cardPreview: Preview = await createPreview(
    playerTexture(),
    droneTexture(),
    pick.backgroundById,
    pick.sigilById,
    pick.spellById,
    pick.patternById,
    pick.bulletById,
    pick.vesselById,
    pick.effectById,
  );
  const cardTicks: Clock = createClock();

  function show(kind: Kind, index: number): Container | null {
    const item: Item | undefined = listOf(creations, kind)[index];

    cardPreview.setAutopilot(false);
    cardPreview.setPlaytest(false);
    cardPreview.clear();
    cardPreview.overlay.visible = false;
    cardPreview.setBackground(null);
    cardPreview.setPlayerVisible(false);

    if (item === undefined) {
      return null;
    }

    let shownKind: Kind = kind;
    let shown: Item = item;
    let packed: Array<Stage> | null = null;

    if (shownKind === "cutscene") {
      cardScene.play(shown as Cutscene, 0);
      return cardScene.view;
    }

    if (shownKind === "pattern") {
      cardPreview.setPattern(shown as Pattern);
    } else if (shownKind === "enemy") {
      const value: Enemy = shown as Enemy;

      cardPreview.setEnemy(value, null);
    } else if (shownKind === "sigil") {
      cardPreview.setSigil(shown as Sigil);
    } else if (shownKind === "spell") {
      const value: Spell = shown as Spell;

      cardPreview.setSpell(value, pick.patternById(value.pattern));
    } else if (shownKind === "bullet") {
      cardPreview.setPattern(bulletDemo(shown.id));
    } else if (shownKind === "vessel") {
      cardPreview.setEnemy(vesselDemo(shown.id), null);
    } else if (shownKind === "background") {
      cardPreview.setBackground(shown as Background);
      cardPreview.setPattern(null);
    } else if (
      shownKind === "stage" ||
      shownKind === "run" ||
      shownKind === "game"
    ) {
      const value: Stage | null =
        shownKind === "stage" && packed === null
          ? (shown as Stage)
          : ((packed !== null
              ? packed
              : shownKind === "run"
                ? runStages(creations, shown as Run)
                : gameStages(creations, shown as Game))[0] ?? null);

      if (value === null) {
        return null;
      }

      cardPreview.setBackground(pick.backgroundById(value.background));
      cardPreview.setPlayerVisible(true);
      cardPreview.setStage(null, pick.resolve);
      cardPreview.setStage(value, pick.resolve);
      cardPreview.setPlaytest(true);
      cardPreview.setAutopilot(true);
    } else {
      return null;
    }

    return cardPreview.view;
  }

  function update(delta: number): void {
    if (cardScene.view.parent !== null) {
      cardScene.update(delta);
      return;
    }

    runClock(cardTicks, delta, cardPreview.update);
  }

  return { show: show, update: update };
}

export { createCards };
