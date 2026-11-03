import { Container, type Ticker } from "pixi.js";
import { tween } from "../effects/tween/tween";
import type { Topic } from "./help";

const enterDuration: number = 450; // ms
const leaveDuration: number = 250; // ms
const leaveLead: number = 150; // ms

type PageContent = {
  view: Container;
  setActive: (active: boolean) => void;
  enter?: () => void;
  back?: () => boolean;
  leave?: () => Promise<void>;
  leaveTime?: () => number;
  topic?: () => Topic;
};

type Page = {
  view: Container;
  content: PageContent | null;
};

function createPage(content: PageContent | null): Page {
  const view: Container = new Container();
  const page: Page = { view: view, content: content };

  view.visible = false;

  if (content !== null) {
    view.addChild(content.view);
  }

  return page;
}

function showPage(ticker: Ticker, page: Page): Promise<void> {
  page.view.visible = true;
  page.content?.enter?.();

  return tween(ticker, enterDuration, (progress: number) => {
    page.view.alpha = Math.min(progress * 2, 1);
  }).then(() => {
    page.content?.setActive(true);
  });
}

function hideTime(page: Page): number {
  return (
    Math.max((page.content?.leaveTime?.() ?? 0) - leaveLead, 0) + leaveDuration
  );
}

function hidePage(ticker: Ticker, page: Page): Promise<void> {
  const content: number = Math.max(
    (page.content?.leaveTime?.() ?? 0) - leaveLead,
    0,
  );

  page.content?.setActive(false);
  page.content?.leave?.();

  return tween(ticker, content, () => undefined).then(() =>
    tween(ticker, leaveDuration, (progress: number) => {
      page.view.alpha = 1 - progress;
    }).then(() => {
      page.view.visible = false;
    }),
  );
}

export { hideTime, createPage, showPage, hidePage };
export type { Page, PageContent };
