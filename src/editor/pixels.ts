type Pixels = {
  size: number; // px
  data: Uint8Array;
};

function createPixels(size: number): Pixels {
  return { size: size, data: new Uint8Array(size * size * 4) };
}

function inside(pixels: Pixels, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < pixels.size && y < pixels.size;
}

function getPixel(pixels: Pixels, x: number, y: number): number {
  const offset: number = (y * pixels.size + x) * 4;
  const data: Uint8Array = pixels.data;

  return (
    ((data[offset]! << 24) |
      (data[offset + 1]! << 16) |
      (data[offset + 2]! << 8) |
      data[offset + 3]!) >>>
    0
  );
}

function setPixel(pixels: Pixels, x: number, y: number, color: number): void {
  if (!inside(pixels, x, y)) {
    return;
  }

  const offset: number = (y * pixels.size + x) * 4;
  const data: Uint8Array = pixels.data;
  data[offset] = (color >>> 24) & 0xff;
  data[offset + 1] = (color >>> 16) & 0xff;
  data[offset + 2] = (color >>> 8) & 0xff;
  data[offset + 3] = color & 0xff;
}

function drawLine(
  pixels: Pixels,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  plot: (x: number, y: number) => void,
): void {
  const stepX: number = fromX < toX ? 1 : -1;
  const stepY: number = fromY < toY ? 1 : -1;
  const distanceX: number = Math.abs(toX - fromX);
  const distanceY: number = -Math.abs(toY - fromY);
  let error: number = distanceX + distanceY;
  let x: number = fromX;
  let y: number = fromY;

  while (true) {
    if (inside(pixels, x, y)) {
      plot(x, y);
    }

    if (x === toX && y === toY) {
      return;
    }

    const double: number = error * 2;

    if (double >= distanceY) {
      error += distanceY;
      x += stepX;
    }

    if (double <= distanceX) {
      error += distanceX;
      y += stepY;
    }
  }
}

function floodFill(
  pixels: Pixels,
  startX: number,
  startY: number,
  color: number,
): void {
  if (!inside(pixels, startX, startY)) {
    return;
  }

  const target: number = getPixel(pixels, startX, startY);

  if (target === color) {
    return;
  }

  const stack: Array<number> = [startX, startY];

  while (stack.length > 0) {
    const y: number = stack.pop()!;
    const x: number = stack.pop()!;

    if (!inside(pixels, x, y) || getPixel(pixels, x, y) !== target) {
      continue;
    }

    setPixel(pixels, x, y, color);
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
}

function isEmpty(pixels: Pixels): boolean {
  for (let offset = 3; offset < pixels.data.length; offset += 4) {
    if (pixels.data[offset] !== 0) {
      return false;
    }
  }

  return true;
}

const sharePrefix: string = "GEREGNET-SPRITE-1:";

function toBase64(bytes: Uint8Array): string {
  let text: string = "";

  for (let index = 0; index < bytes.length; index++) {
    text += String.fromCharCode(bytes[index]!);
  }

  return btoa(text);
}

function fromBase64(encoded: string): Uint8Array | null {
  try {
    const text: string = atob(encoded);
    const bytes: Uint8Array = new Uint8Array(text.length);

    for (let index = 0; index < text.length; index++) {
      bytes[index] = text.charCodeAt(index);
    }

    return bytes;
  } catch {
    return null;
  }
}

async function transform(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const output: ReadableStream<Uint8Array> = new Blob([bytes.slice().buffer])
    .stream()
    .pipeThrough(stream);

  return new Uint8Array(await new Response(output).arrayBuffer());
}

async function exportPixels(pixels: Pixels): Promise<string> {
  const packed: Uint8Array = await transform(
    pixels.data,
    new CompressionStream("deflate-raw"),
  );

  return sharePrefix + toBase64(packed);
}

async function importPixels(
  pixels: Pixels,
  shared: string,
): Promise<Uint8Array | null> {
  const text: string = shared.trim();

  if (!text.startsWith(sharePrefix)) {
    return null;
  }

  const packed: Uint8Array | null = fromBase64(text.slice(sharePrefix.length));

  if (packed === null) {
    return null;
  }

  try {
    const data: Uint8Array = await transform(
      packed,
      new DecompressionStream("deflate-raw"),
    );

    return data.length === pixels.data.length ? data : null;
  } catch {
    return null;
  }
}

function encodePixels(pixels: Pixels): string {
  let text: string = "";

  for (let index = 0; index < pixels.data.length; index++) {
    text += String.fromCharCode(pixels.data[index]!);
  }

  return btoa(text);
}

function decodePixels(pixels: Pixels, encoded: string): boolean {
  const text: string = atob(encoded);

  if (text.length !== pixels.data.length) {
    return false;
  }

  for (let index = 0; index < text.length; index++) {
    pixels.data[index] = text.charCodeAt(index);
  }

  return true;
}

export {
  createPixels,
  inside,
  getPixel,
  setPixel,
  drawLine,
  floodFill,
  isEmpty,
  encodePixels,
  decodePixels,
  exportPixels,
  importPixels,
};
export type { Pixels };
