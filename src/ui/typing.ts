const checks: Array<() => boolean> = new Array();

function onTyping(check: () => boolean): void {
  checks.push(check);
}

function typing(): boolean {
  const focused: Element | null = document.activeElement;

  return (
    focused instanceof HTMLInputElement ||
    focused instanceof HTMLTextAreaElement ||
    checks.some((check: () => boolean) => check())
  );
}

export { onTyping, typing };
