/*
 * Imagem de antes e depois (1080×1350, formato do feed do Instagram) e compartilhamento.
 * A marca da Fonseca Team é opcional.
 */
import { loadImage, canvasToBlob } from "./image.js";
import { downloadBlob, fmtDate } from "./util.js";

const W = 1080, H = 1350;

function cover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

async function ensureFonts() {
  if (!document.fonts) return;
  try { await Promise.all([document.fonts.load('italic 900 64px "Barlow Condensed"'), document.fonts.load('700 28px "Barlow Condensed"')]); } catch (e) { /* usa a fonte reserva */ }
}

export async function makeBeforeAfter({ beforeURL, afterURL, beforeDate, afterDate, brand = true, handle = "" }) {
  await ensureFonts();
  const [a, b] = await Promise.all([loadImage(beforeURL), loadImage(afterURL)]);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);

  const top = brand ? 120 : 0;
  const bottom = brand ? 110 : 0;
  const gap = 8;
  const pw = (W - gap) / 2, ph = H - top - bottom;
  cover(ctx, a, 0, top, pw, ph);
  cover(ctx, b, pw + gap, top, pw, ph);

  // Rótulos
  const label = (txt, date, x, red) => {
    ctx.fillStyle = red ? "#de0213" : "rgba(5,5,5,.78)";
    ctx.fillRect(x + 24, top + 24, 210, 70);
    ctx.fillStyle = "#fff";
    ctx.font = 'italic 900 44px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillText(txt, x + 40, top + 52);
    ctx.font = '700 22px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.fillText(date, x + 40, top + 82);
  };
  label("ANTES", fmtDate(beforeDate), 0, false);
  label("DEPOIS", fmtDate(afterDate), pw + gap, true);

  if (brand) {
    ctx.fillStyle = "#de0213";
    ctx.fillRect(0, top - 6, W, 6);
    ctx.fillRect(0, H - bottom, W, 6);
    try {
      const logo = await loadImage(new URL("../../assets/logo-mark.png", import.meta.url).href);
      const lh = 64, lw = (logo.width / logo.height) * lh;
      ctx.drawImage(logo, 40, (top - lh) / 2 - 3, lw, lh);
    } catch (e) { /* sem logo */ }
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.font = 'italic 900 64px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.fillText("FONSECA TEAM", 170, top / 2);
    ctx.font = '700 30px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.fillStyle = "#d4d4d4";
    ctx.textAlign = "center";
    ctx.fillText((handle ? handle + "  ·  " : "") + "CONSULTORIA ONLINE", W / 2, H - bottom / 2 + 2);
    ctx.textAlign = "left";
  }
  return canvasToBlob(c, 0.9);
}

/* Abre o compartilhamento do celular; sem suporte, baixa a imagem. */
export async function shareImage(blob, filename = "fonseca-team-evolucao.jpg") {
  const file = new File([blob], filename, { type: "image/jpeg" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Minha evolução" });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
