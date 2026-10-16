import { Container, Graphics, Text, type Application } from "pixi.js";
import { createGlide, mix, type Glide } from "../../ui/motion";
import { categoryList, categoryNames, type Category } from "./kinds";
import { createSerif, diamond, diamondSize, trim, trimLit } from "./style";

type Tabs = {
  view: Container;
  paint: (category: Category, focused: boolean) => void;
  layout: () => void;
  reset: (category: Category, focused: boolean) => void;
};

const tabSize: number = 26; // px
const tabHover: number = 1.06;
const tabGap: number = 56; // px
const ornamentLength: number = 0.16; // of screen width
const ornamentGap: number = 30; // px
const focusGap: number = 16; // px
const headerY: number = 0.11; // of screen height

function createTabs(
  app: Application,
  pick: (category: Category) => void,
): Tabs {
  const view: Container = new Container();
  const ornament: Graphics = new Graphics();
  const tabs: Array<Text> = new Array();
  const tabGlows: Map<Text, Glide> = new Map();
  const markX: Glide = createGlide(0, drawOrnament);
  const markWidth: Glide = createGlide(0, drawOrnament);
  let markPlaced: boolean = false;
  let category: Category = categoryList[0]!;
  let onTabs: boolean = true;

  for (let index = 0; index < categoryList.length; index++) {
    const value: Category = categoryList[index]!;
    const tab: Text = createSerif(tabSize, "#ffffff");

    tab.text = categoryNames.get(value)!.toUpperCase();
    tab.anchor.set(0.5);
    tab.eventMode = "static";
    tab.cursor = "pointer";
    tab.on("pointertap", () => pick(value));

    const hover: Glide = createGlide(1, (scale: number) => {
      tab.scale.set(scale);
    });

    tab.on("pointerover", () => hover.set(tabHover));
    tab.on("pointerout", () => hover.set(1));
    tabs.push(tab);
    view.addChild(tab);
  }

  function paint(next: Category, focused: boolean): void {
    category = next;
    onTabs = focused;

    const current: Text | undefined = tabs[categoryList.indexOf(category)];

    for (const tab of tabs) {
      let glow: Glide | undefined = tabGlows.get(tab);

      if (glow === undefined) {
        glow = createGlide(tab === current ? 1 : 0, (amount: number) => {
          tab.tint = mix(trim, trimLit, amount);
          tab.alpha = 0.7 + amount * 0.3;
        });
        tabGlows.set(tab, glow);
      }

      glow.set(tab === current ? 1 : 0);
    }

    if (current === undefined) {
      ornament.clear();
      return;
    }

    if (markPlaced) {
      markX.set(current.x);
      markWidth.set(current.width);
    } else {
      markPlaced = true;
      markX.snap(current.x);
      markWidth.snap(current.width);
    }

    drawOrnament();
  }

  function drawOrnament(): void {
    const center: number = markX.value();
    const half: number = markWidth.value() / 2;

    ornament.clear();

    if (tabs.length === 0) {
      return;
    }

    const first: Text = tabs[0]!;
    const last: Text = tabs[tabs.length - 1]!;
    const left: number = first.x - first.width / 2 - ornamentGap;
    const right: number = last.x + last.width / 2 + ornamentGap;
    const length: number = app.screen.width * ornamentLength;

    ornament
      .rect(left - length, -0.5, length, 1)
      .rect(right, -0.5, length, 1)
      .fill({ color: trim, alpha: 0.7 });
    diamond(ornament, left, 0, diamondSize);
    diamond(ornament, right, 0, diamondSize);
    diamond(ornament, left - length, 0, diamondSize - 2);
    diamond(ornament, right + length, 0, diamondSize - 2);
    ornament
      .fill(trim)
      .rect(center - half, tabSize * 0.85, half * 2, 1.5)
      .fill(trimLit);
    diamond(ornament, center, tabSize * 0.85 + 0.75, diamondSize);

    if (onTabs) {
      diamond(ornament, center - half - focusGap, 0, diamondSize);
      diamond(ornament, center + half + focusGap, 0, diamondSize);
    }

    ornament.fill(trimLit);
  }

  function layout(): void {
    let tabX: number = 0;

    for (const tab of tabs) {
      tab.x = tabX + tab.width / 2;
      tabX += tab.width + tabGap;
    }

    for (const tab of tabs) {
      tab.x -= (tabX - tabGap) / 2;
    }

    view.position.set(
      Math.round(app.screen.width / 2),
      Math.round(app.screen.height * headerY),
    );
    paint(category, onTabs);
  }

  function reset(next: Category, focused: boolean): void {
    markPlaced = false;
    paint(next, focused);

    for (const [tab, glow] of tabGlows) {
      glow.snap(tabs.indexOf(tab) === categoryList.indexOf(next) ? 1 : 0);
    }
  }

  view.addChild(ornament);

  return { view: view, paint: paint, layout: layout, reset: reset };
}

export { createTabs };
export type { Tabs };
