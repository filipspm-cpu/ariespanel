function lzw(indexes: Uint8Array, minCode: number) {
  const clear = 1 << minCode;
  const eoi = clear + 1;
  let nBits = minCode + 1;
  let maxCode = (1 << nBits) - 1;
  let next = eoi + 1;
  let clearFlag = false;
  const dict = new Map<number, number>();
  const bytes: number[] = [];
  let acc = 0;
  let n = 0;

  const output = (code: number) => {
    acc |= code << n;
    n += nBits;
    while (n >= 8) {
      bytes.push(acc & 255);
      acc >>>= 8;
      n -= 8;
    }
    if (clearFlag) {
      nBits = minCode + 1;
      maxCode = (1 << nBits) - 1;
      clearFlag = false;
    } else if (next > maxCode && nBits < 12) {
      nBits += 1;
      maxCode = nBits === 12 ? 4096 : (1 << nBits) - 1;
    }
  };

  const reset = () => {
    dict.clear();
    next = eoi + 1;
    clearFlag = true;
  };

  output(clear);
  let prev = indexes[0];
  for (let i = 1; i < indexes.length; i++) {
    const k = indexes[i];
    const key = (prev << 12) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prev = found;
      continue;
    }
    output(prev);
    if (next < 4096) {
      dict.set(key, next);
      next += 1;
    } else {
      reset();
      output(clear);
    }
    prev = k;
  }
  output(prev);
  output(eoi);
  if (n > 0) bytes.push(acc & 255);

  const blocks: number[] = [minCode];
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    blocks.push(chunk.length, ...chunk);
  }
  blocks.push(0);
  return blocks;
}

export function encodeGif(
  frames: Uint8Array[],
  width: number,
  height: number,
  palette: number[],
  delayCs: number,
) {
  const colors = Math.max(2, palette.length / 3);
  const tableSize = Math.max(2, Math.ceil(Math.log2(colors)));
  const tableColors = 1 << tableSize;
  const gct: number[] = [];
  for (let i = 0; i < tableColors * 3; i++) gct.push(palette[i] ?? 0);
  const minCode = Math.max(2, tableSize);
  const out: number[] = [71, 73, 70, 56, 57, 97];
  out.push(width & 255, width >> 8, height & 255, height >> 8);
  out.push(0x80 | (tableSize - 1), 0, 0);
  out.push(...gct);
  out.push(0x21, 0xff, 11, 78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48, 3, 1, 0, 0, 0);
  for (const frame of frames) {
    out.push(0x21, 0xf9, 4, 0x04, delayCs & 255, delayCs >> 8, 0, 0);
    out.push(0x2c, 0, 0, 0, 0, width & 255, width >> 8, height & 255, height >> 8, 0);
    out.push(...lzw(frame, minCode));
  }
  out.push(0x3b);
  return new Blob([new Uint8Array(out)], { type: "image/gif" });
}

export function quantizeToPalette(data: Uint8ClampedArray, palette: number[]) {
  const colors = palette.length / 3;
  const out = new Uint8Array(data.length / 4);
  const cache = new Map<number, number>();
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = (r << 16) | (g << 8) | b;
    const hit = cache.get(key);
    if (hit !== undefined) {
      out[p] = hit;
      continue;
    }
    let best = 0;
    let dist = 1e12;
    for (let c = 0; c < colors; c++) {
      const dr = r - palette[c * 3];
      const dg = g - palette[c * 3 + 1];
      const db = b - palette[c * 3 + 2];
      const d = dr * dr + dg * dg + db * db;
      if (d < dist) {
        dist = d;
        best = c;
      }
    }
    cache.set(key, best);
    out[p] = best;
  }
  return out;
}
