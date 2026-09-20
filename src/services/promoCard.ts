import logoUrl from "@/assets/aries-logo.png";
import { PROMO_ENTER_CASH, formatCash } from "@/data/achievements";
import { encodeGif, quantizeToPalette } from "@/services/gifEncode";

export const PROMO_CARD_W = 960;
export const PROMO_CARD_H = 540;

const PALETTE = [
  5, 5, 7, 13, 13, 16, 24, 24, 28, 39, 39, 42, 63, 63, 70, 82, 82, 91, 113, 113, 122, 161, 161, 170, 212, 212, 216, 244,
  244, 245, 255, 255, 255, 80, 55, 8, 140, 95, 12, 201, 140, 20, 251, 191, 36, 255, 247, 237,
];

let logo: HTMLImageElement | null = null;

function loadLogo() {
  if (logo?.complete && logo.naturalWidth) return Promise.resolve(logo);
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      logo = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = logoUrl;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export async function drawPromoCard(
  ctx: CanvasRenderingContext2D,
  opts: { code: string; name?: string; pulse?: number },
) {
  const { width: w, height: h } = ctx.canvas;
  const pulse = opts.pulse ?? 1;
  await Promise.all([document.fonts.ready, loadLogo()]);

  const bg = ctx.createRadialGradient(w * 0.5, h * 0.18, 20, w * 0.5, h * 0.5, w * 0.72);
  bg.addColorStop(0, "#1a1a1a");
  bg.addColorStop(1, "#050505");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  roundRect(ctx, 28, 28, w - 56, h - 56, 28);
  ctx.stroke();

  const mark = await loadLogo();
  if (mark) ctx.drawImage(mark, w / 2 - 36, 58, 72, 72);

  ctx.fillStyle = "#ffffff";
  ctx.font = "28px Ethnocentric, Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ARIES", w / 2, 162);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText("PANEL", w / 2, 186);

  ctx.fillStyle = "#d4d4d8";
  ctx.font = "16px Inter, sans-serif";
  ctx.fillText("Wpisz kod w zakładce ustawienia", w / 2, 228);

  const chipX = w / 2 - 250;
  const chipY = 246;
  const chipW = 500;
  const chipH = 96;
  const goldA = 0.35 + pulse * 0.65;
  roundRect(ctx, chipX, chipY, chipW, chipH, 18);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fill();
  ctx.strokeStyle = `rgba(251, 191, 36, ${goldA})`;
  ctx.lineWidth = 2 + pulse * 1.5;
  ctx.stroke();

  ctx.fillStyle = pulse > 0.55 ? "#fff7ed" : "#fbbf24";
  ctx.font = "700 48px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(opts.code, w / 2, 310);

  ctx.fillStyle = "#d4d4d8";
  ctx.font = "18px Inter, sans-serif";
  ctx.fillText(`Aby otrzymać ${formatCash(PROMO_ENTER_CASH)} in game`, w / 2, 392);

  ctx.fillStyle = "#52525b";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText("ARIES PANEL", w / 2, h - 48);
}

function makeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = PROMO_CARD_W;
  canvas.height = PROMO_CARD_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Nie udało się narysować karty.");
  return { canvas, ctx };
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function fileBase(code: string) {
  const clean = code.replace(/[^A-Z0-9-]/g, "");
  return clean.startsWith("ARIES") ? clean : `ARIES-${clean}`;
}

export async function downloadPromoPng(code: string, name?: string) {
  const { canvas, ctx } = makeCanvas();
  await drawPromoCard(ctx, { code, name, pulse: 1 });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Nie udało się zapisać PNG.");
  saveBlob(blob, `${fileBase(code)}.png`);
}

export async function downloadPromoGif(code: string, name?: string) {
  const { canvas, ctx } = makeCanvas();
  const frames = 8;
  const indexed: Uint8Array[] = [];
  for (let i = 0; i < frames; i++) {
    const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((i / frames) * Math.PI * 2));
    await drawPromoCard(ctx, { code, name, pulse });
    indexed.push(quantizeToPalette(ctx.getImageData(0, 0, canvas.width, canvas.height).data, PALETTE));
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
  }
  const blob = encodeGif(indexed, canvas.width, canvas.height, PALETTE, 14);
  saveBlob(blob, `${fileBase(code)}.gif`);
}
