/*
 * Preparo das fotos no próprio aparelho: reduz para no máximo 2048px no lado maior,
 * salva em JPEG (qualidade 0,85) e, como a imagem é redesenhada num canvas,
 * os dados ocultos do arquivo (EXIF, incluindo localização) não vão junto.
 */
export const MAX_SIDE = 2048;
export const QUALITY = 0.85;

const canvasToBlob = (canvas, q = QUALITY) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))), "image/jpeg", q));

function fit(w, h, max = MAX_SIDE) {
  const s = Math.min(1, max / Math.max(w, h));
  return [Math.round(w * s), Math.round(h * s)];
}

async function decode(file) {
  if ("createImageBitmap" in window) {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { /* tenta pelo <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/* Arquivo da galeria → JPEG pronto para envio */
export async function fileToJpeg(file) {
  const src = await decode(file);
  const w = src.width || src.naturalWidth;
  const h = src.height || src.naturalHeight;
  const [cw, ch] = fit(w, h);
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  c.getContext("2d").drawImage(src, 0, 0, cw, ch);
  if (src.close) src.close();
  return canvasToBlob(c);
}

/* Quadro atual da câmera → JPEG (mirror = desfaz o espelhamento da câmera frontal) */
export async function videoFrameToJpeg(video, { mirror = false } = {}) {
  const [cw, ch] = fit(video.videoWidth, video.videoHeight);
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const ctx = c.getContext("2d");
  if (mirror) { ctx.translate(cw, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, cw, ch);
  return canvasToBlob(c);
}

export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar a imagem."));
    img.src = src;
  });

export { canvasToBlob };
