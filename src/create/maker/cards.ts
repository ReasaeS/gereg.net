import type { Container } from "pixi.js";
import type {
  Background,
  Creations,
  Cutscene,
  Enemy,
  Pattern,
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
import type { Item, Selection } from "./studio";

async function createCards(
  creations: Creations,
  pick: Selection,
): Promise<Live> {
  const cardScene: Scene = createScene(
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
  );
  const cardTicks: Clock = createClock();

  function show(kind: Kind, index: number): Container | null {
    const item: Item | undefined = listOf(creations, kind)[index];

    cardPreview.clear();
    cardPreview.overlay.visible = false;
    cardPreview.setBackground(null);
    cardPreview.setPlayerVisible(false);

    if (item === undefined) {
      return null;
    }

    if (kind === "cutscene") {
      cardScene.play(item as Cutscene, 0);
      return cardScene.view;
    }

    if (kind === "pattern") {
      cardPreview.setPattern(item as Pattern);
    } else if (kind === "enemy") {
      const value: Enemy = item as Enemy;

      cardPreview.setEnemy(value, null);
    } else if (kind === "sigil") {
      cardPreview.setSigil(item as Sigil);
    } else if (kind === "spell") {
      const value: Spell = item as Spell;

      cardPreview.setSpell(value, pick.patternById(value.pattern));
    } else if (kind === "background") {
      cardPreview.setBackground(item as Background);
      cardPreview.setPattern(null);
    } else if (kind === "stage") {
      const value: Stage = item as Stage;

      cardPreview.setBackground(pick.backgroundById(value.background));
      cardPreview.setPlayerVisible(true);
      cardPreview.setStage(null, pick.resolve);
      cardPreview.setStage(value, pick.resolve);
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
