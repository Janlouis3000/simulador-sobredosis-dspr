// Gráficas SVG de oxígeno y respiraciones.
import { fmt } from './util.js';

function drawChart(svg, o) {
  const W = Math.max(280, Math.round(svg.getBoundingClientRect().width || svg.parentNode.clientWidth || 600));
  const H = o.h, L = 34, Rm = 10, T = (o.events.length && o.labels) ? 30 : 8, B = 20;
  const tMax = Math.max(120, Math.ceil(o.tEnd / 60) * 60);
  const x = (t) => L + (t / tMax) * (W - L - Rm);
  const y = (v) => T + (1 - v / o.yMax) * (H - T - B);
  let g = '';
  if (o.band) g += `<rect x="${L}" y="${y(o.band[1])}" width="${W - L - Rm}" height="${y(o.band[0]) - y(o.band[1])}" fill="${o.bandColor}"/>`;
  for (const v of o.yTicks) g += `<line x1="${L}" x2="${W - Rm}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--muted)">${v}</text>`;
  const step = tMax <= 480 ? 60 : tMax <= 960 ? 120 : 240;
  for (let t = 0; t <= tMax; t += step) g += `<text x="${x(t)}" y="${H - 5}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${t / 60} min</text>`;
  let lastX = -99, lane = 0;
  for (const e of o.events) {
    const ex = x(e.t);
    lane = ex - lastX < 52 ? (lane + 1) % 2 : 0; lastX = ex;
    g += `<line x1="${ex}" x2="${ex}" y1="${T - 2}" y2="${H - B}" stroke="${e.color}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    if (o.labels) g += `<text x="${Math.min(ex + 3, W - Rm - 46)}" y="${10 + lane * 11}" font-size="10" font-weight="600" fill="var(--ink)">${e.label}</text>`;
  }
  const pts = o.data.map(([t, v]) => `${x(t).toFixed(1)},${y(Math.min(o.yMax, v)).toFixed(1)}`);
  g += `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--navy)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  const last = o.data[o.data.length - 1];
  if (last) g += `<circle cx="${x(last[0])}" cy="${y(Math.min(o.yMax, last[1]))}" r="4" fill="var(--navy)" stroke="var(--surface)" stroke-width="2"/>`;
  g += `<g class="hover" style="display:none"><line class="hl" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-width="1"/><circle class="hc" r="4.5" fill="var(--gold)" stroke="var(--surface)" stroke-width="2"/></g>`;
  g += `<rect x="${L}" y="0" width="${W - L - Rm}" height="${H}" fill="transparent" class="hit"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = g;
  if (!o.hover) return;
  const tip = svg.parentNode.querySelector('.tip') || Object.assign(svg.parentNode.appendChild(document.createElement('div')), { className: 'tip', hidden: true });
  const hov = svg.querySelector('.hover'), hit = svg.querySelector('.hit');
  const move = (ev) => {
    const r = svg.getBoundingClientRect(), sx = (ev.clientX - r.left) * (W / r.width);
    const t = ((sx - L) / (W - L - Rm)) * tMax;
    let best = o.data[0]; for (const p of o.data) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
    const px = x(best[0]), py = y(Math.min(o.yMax, best[1]));
    hov.style.display = ''; hov.querySelector('.hl').setAttribute('x1', px); hov.querySelector('.hl').setAttribute('x2', px);
    hov.querySelector('.hc').setAttribute('cx', px); hov.querySelector('.hc').setAttribute('cy', py);
    tip.hidden = false; tip.style.left = (px / W) * r.width + 'px'; tip.style.top = ((py / H) * r.height + 18) + 'px';
    tip.textContent = `${fmt(best[0])} · ${o.fmtV(best[1])}`;
  };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerleave', () => { hov.style.display = 'none'; tip.hidden = true; });
}

export { drawChart };
