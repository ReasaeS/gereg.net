import { renderJob, type RenderRequest, type RenderResult } from "./render";

globalThis.addEventListener("message", (event: MessageEvent<RenderRequest>) => {
  let sides: Array<Float32Array<ArrayBuffer>> | null = null;

  try {
    sides = renderJob(event.data.job);
  } catch {
    sides = null;
  }

  const result: RenderResult = { id: event.data.id, sides: sides };

  globalThis.postMessage(result, {
    transfer: (sides ?? new Array()).map(
      (side: Float32Array<ArrayBuffer>) => side.buffer,
    ),
  });
});
