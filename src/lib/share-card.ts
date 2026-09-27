"use client";

/**
 * Draws a workout summary as a 1080×1350 PNG (portrait, fits a phone story or
 * a feed post) in the app's NeoPop style. Always the dark palette: it reads
 * well wherever it's posted.
 */

export interface CardData {
  title: string;
  date: Date;
  /** Three headline numbers, e.g. Time / Volume / Sets. */
  stats: { label: string; value: string }[];
  muscles: string[];
  prs: string[];
  exercises: { name: string; detail: string }[];
}

const W = 1080;
const H = 1350;
const PAD = 72;
const C = {
  bg: "#0d0d0d",
  dot: "#1c1c1c",
  ink: "#ffffff",
  ink2: "#a3a3a3",
  ink3: "#8a8a8a",
  line: "#2e2e2e",
  lime: "#d4ff3a",
  limeEdge: "#8fb312",
  yellow: "#ffb800",
  violet: "#9b7bff",
};

type Ctx = CanvasRenderingContext2D;

function fit(ctx: Ctx, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function wrap(ctx: Ctx, text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= max || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fit(ctx, lines.slice(maxLines - 1).join(" "), max);
  return kept;
}

/** Solid block with the NeoPop 3D edge (right + bottom). */
function plunk(ctx: Ctx, x: number, y: number, w: number, h: number, face: string, edge: string, d = 12) {
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w + d, y + d);
  ctx.lineTo(x + w + d, y + h + d);
  ctx.lineTo(x + d, y + h + d);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = face;
  ctx.fillRect(x, y, w, h);
}

export async function renderWorkoutCard(d: CardData): Promise<Blob> {
  await document.fonts?.ready;
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.textBaseline = "alphabetic";

  // Background with the app's dot grid.
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.dot;
  for (let x = 18; x < W; x += 36) for (let y = 18; y < H; y += 36) ctx.fillRect(x, y, 3, 3);

  // Brand + date.
  plunk(ctx, PAD, PAD, 60, 60, C.lime, C.limeEdge, 6);
  ctx.strokeStyle = C.bg;
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(PAD + 10, PAD + 32);
  ctx.lineTo(PAD + 20, PAD + 32);
  ctx.lineTo(PAD + 27, PAD + 16);
  ctx.lineTo(PAD + 34, PAD + 46);
  ctx.lineTo(PAD + 41, PAD + 30);
  ctx.lineTo(PAD + 50, PAD + 30);
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.font = font(800, 30);
  ctx.fillText("IRONLOG", PAD + 88, PAD + 42);
  ctx.textAlign = "right";
  ctx.fillStyle = C.ink2;
  ctx.font = font(700, 28);
  ctx.fillText(d.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).toUpperCase(), W - PAD, PAD + 42);
  ctx.textAlign = "left";

  // Title.
  let y = PAD + 60 + 40;
  ctx.fillStyle = C.ink;
  ctx.font = font(800, 88);
  for (const line of wrap(ctx, d.title, W - 2 * PAD, 2)) {
    y += 92;
    ctx.fillText(line, PAD, y);
  }

  // Lime stats block.
  y += 48;
  const bw = W - 2 * PAD - 12;
  const bh = 230;
  plunk(ctx, PAD, y, bw, bh, C.lime, C.limeEdge);
  const colW = bw / d.stats.length;
  d.stats.forEach((s, i) => {
    const x = PAD + 36 + i * colW;
    ctx.fillStyle = "rgba(13,13,13,0.7)";
    ctx.font = font(700, 26);
    ctx.fillText(s.label.toUpperCase(), x, y + 72);
    ctx.fillStyle = C.bg;
    let size = 80;
    ctx.font = font(800, size);
    while (size > 40 && ctx.measureText(s.value).width > colW - 44) ctx.font = font(800, (size -= 4));
    ctx.fillText(s.value, x, y + 170);
  });
  y += bh + 12 + 64;

  const section = (label: string, color = C.ink3) => {
    ctx.fillStyle = color;
    ctx.font = font(800, 26);
    ctx.fillText(label, PAD, y);
    y += 52;
  };
  const bottom = H - PAD - 60;

  // Muscles hit, as pills.
  if (d.muscles.length) {
    section("MUSCLES HIT");
    ctx.font = font(700, 32);
    let x = PAD;
    let rows = 1;
    for (const m of d.muscles) {
      const w = ctx.measureText(m).width + 40;
      if (x + w > W - PAD) {
        if (rows === 2) break;
        rows++;
        x = PAD;
        y += 64;
      }
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y - 38, w, 52);
      ctx.fillStyle = C.ink;
      ctx.fillText(m, x + 20, y);
      x += w + 14;
    }
    y += 76;
  }

  // Records.
  if (d.prs.length && y + 100 < bottom) {
    ctx.font = font(800, 26);
    const tag = d.prs.length > 1 ? `${d.prs.length} NEW PRS` : "NEW PR";
    const tw = ctx.measureText(tag).width + 28;
    plunk(ctx, PAD, y - 34, tw, 46, C.yellow, "#b98500", 5);
    ctx.fillStyle = C.bg;
    ctx.fillText(tag, PAD + 14, y - 2);
    y += 58;
    ctx.fillStyle = C.ink;
    ctx.font = font(700, 36);
    for (const pr of d.prs) {
      if (y > bottom - 20) break;
      ctx.fillText(fit(ctx, pr, W - 2 * PAD), PAD, y);
      y += 52;
    }
    y += 26;
  }

  // Exercises, as many as fit.
  if (d.exercises.length && y + 90 < bottom) {
    section("EXERCISES");
    for (const ex of d.exercises) {
      if (y > bottom) break;
      ctx.font = font(600, 30);
      ctx.textAlign = "right";
      ctx.fillStyle = C.ink2;
      ctx.fillText(ex.detail, W - PAD, y);
      const dw = ctx.measureText(ex.detail).width;
      ctx.textAlign = "left";
      ctx.fillStyle = C.ink;
      ctx.font = font(700, 34);
      ctx.fillText(fit(ctx, ex.name, W - 2 * PAD - dw - 32), PAD, y);
      y += 54;
    }
  }

  // Footer.
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, H - PAD - 44, W - 2 * PAD, 2);
  ctx.fillStyle = C.ink3;
  ctx.font = font(700, 26);
  ctx.fillText("Logged with IronLog", PAD, H - PAD);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the card"))), "image/png"));
}

/** Opens the share sheet with the image, or downloads it where sharing files isn't supported. */
export async function shareImage(blob: Blob, filename: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
