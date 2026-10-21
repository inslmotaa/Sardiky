/*
 * Gráfico de linha de uma série (peso ou medida ao longo do tempo).
 * Linha de 2px, pontos com anel na cor do fundo, grade discreta, valor no último ponto,
 * dica ao passar o dedo/mouse e tabela com os mesmos dados para acessibilidade.
 */
import { esc, fmtDate, fmtNum } from "./util.js";

const COLOR = "#ff1f30";
const SURFACE = "#111111";

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

export function lineChart(container, points, { title, unit = "", decimals = 1 }) {
  const pts = points.filter((p) => p.value != null && !isNaN(p.value)).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (pts.length < 2) {
    container.innerHTML = `<div class="chart__empty">${esc(title)}: registre pelo menos duas avaliações para ver o gráfico.</div>`;
    return;
  }
  // Desenha na largura real do espaço, para o texto não encolher no celular
  const W = Math.max(300, Math.min(900, Math.round((container.clientWidth || 640) - 34)));
  const H = W < 500 ? 220 : 260, m = { t: 20, r: 62, b: 34, l: 44 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const values = pts.map((p) => p.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x = (i) => m.l + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const y = (v) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;
  const line = pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.value).toFixed(1)).join(" ");
  const area = line + ` L${x(pts.length - 1).toFixed(1)} ${m.t + ih} L${x(0).toFixed(1)} ${m.t + ih} Z`;
  const last = pts[pts.length - 1];
  const labelEvery = Math.ceil(pts.length / 5);

  container.innerHTML = `
    <figure class="chart">
      <figcaption class="chart__title">${esc(title)}</figcaption>
      <div class="chart__plot">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}: de ${fmtNum(pts[0].value, decimals)} para ${fmtNum(last.value, decimals)} ${esc(unit)}">
          ${ticks.map((t) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" class="chart__grid"/><text x="${m.l - 8}" y="${y(t)}" class="chart__tick" text-anchor="end" dominant-baseline="middle">${fmtNum(t, t % 1 ? 1 : 0)}</text>`).join("")}
          ${pts.map((p, i) => (i % labelEvery === 0 || i === pts.length - 1 ? `<text x="${x(i)}" y="${H - 10}" class="chart__tick" text-anchor="middle">${esc(fmtDate(p.date, { day: "2-digit", month: "short" }))}</text>` : "")).join("")}
          <path d="${area}" fill="${COLOR}" opacity=".1"/>
          <path d="${line}" fill="none" stroke="${COLOR}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="4" fill="${COLOR}" stroke="${SURFACE}" stroke-width="2"/>`).join("")}
          <text x="${x(pts.length - 1) + 10}" y="${y(last.value)}" class="chart__end" dominant-baseline="middle">${fmtNum(last.value, decimals)}${unit ? " " + esc(unit) : ""}</text>
          <line class="chart__cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>
          <rect class="chart__hit" x="${m.l - 10}" y="${m.t}" width="${iw + 20}" height="${ih}" fill="transparent"/>
        </svg>
        <div class="chart__tip" hidden></div>
      </div>
      <details class="chart__table"><summary>Ver em tabela</summary>
        <table><thead><tr><th>Data</th><th>${esc(title)}</th></tr></thead><tbody>
          ${pts.map((p) => `<tr><td>${esc(fmtDate(p.date))}</td><td>${fmtNum(p.value, decimals)} ${esc(unit)}</td></tr>`).join("")}
        </tbody></table>
      </details>
    </figure>`;

  const svg = container.querySelector("svg");
  const tip = container.querySelector(".chart__tip");
  const cross = container.querySelector(".chart__cross");
  const hit = container.querySelector(".chart__hit");
  const move = (e) => {
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(x(i) - sx) < Math.abs(x(best) - sx)) best = i; });
    const p = pts[best];
    cross.setAttribute("x1", x(best)); cross.setAttribute("x2", x(best)); cross.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.innerHTML = `<b>${fmtNum(p.value, decimals)} ${esc(unit)}</b><span>${esc(fmtDate(p.date))}</span>`;
    tip.style.left = (x(best) / W) * 100 + "%";
    tip.style.top = (y(p.value) / H) * 100 + "%";
  };
  const leave = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", leave);
}
