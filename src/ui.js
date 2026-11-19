// Interfaz: estado de la simulación, acciones, diálogos y pantalla de resultado.
import { createSim, derived, advance, outcome, EMS_DELAY } from './engine.js';
import { Scene3D } from './scene.js';
import { CASE_INFO, DIVISION_HTML, ACTIONS, DOING, NARC_STEPS, DESPERTAR, LLAMAR } from './content.js';
import { $, fmt, esc } from './util.js';
import { drawChart } from './charts.js';

// ================= Estado =================
let S = null, cfg = { caseId: null, realtime: false, showO2: true };
let known = {}, feed = [], timeline = [], busy = false, modalOpen = false, rtTimer = null, endReason = null, extra = {}, has3D = false, lastHist = -1;

const doseT = (i) => (S.doses[i] ? S.doses[i].t : null);

// ================= Inicio =================
function buildIntro() {
  const box = $('cases'); box.innerHTML = '';
  for (const id of Object.keys(CASE_INFO)) {
    const c = CASE_INFO[id];
    const b = document.createElement('button');
    b.className = 'case'; b.type = 'button'; b.id = 'case-' + id;
    b.setAttribute('aria-pressed', cfg.caseId === id ? 'true' : 'false');
    b.innerHTML = `<span class="tag">${c.tag}</span><strong>${c.title}</strong><span class="d">${c.short}</span>`;
    b.onclick = () => { cfg.caseId = id; Scene3D.prepare(id); buildIntro(); $('btn-start').disabled = false; $('start-hint').textContent = c.place; };
    box.appendChild(b);
  }
}
export function initUI() {
  $('division-intro').innerHTML = DIVISION_HTML;
  $('btn-start').onclick = () => { cfg.realtime = $('opt-realtime').checked; cfg.showO2 = $('opt-o2').checked; startSim(); };
  $('cam-wide').onclick = () => setCam('wide');
  $('cam-face').onclick = () => setCam('face');
  buildIntro();
}
function setCam(v) { if (!has3D) return; Scene3D.setView(v); $('cam-wide').setAttribute('aria-pressed', v === 'wide'); $('cam-face').setAttribute('aria-pressed', v === 'face'); }

function show(screen) {
  for (const s of ['intro', 'sim', 'result']) $('screen-' + s).hidden = s !== screen;
  window.scrollTo({ top: 0 });
}

// ================= Simulación =================
function startSim() {
  S = createSim(cfg.caseId);
  known = { resp: false, breath: false, pupils: false };
  feed = []; timeline = []; busy = false; modalOpen = false; endReason = null; lastHist = -1;
  extra = { letGo: false, seFue: false, conv: null, convMalas: 0, agit: 0, emocion: null, earlyDose: false, extraDoseAwake: false, narcErrors: [], anim: 'none' };
  const c = CASE_INFO[cfg.caseId];
  $('sim-tag').textContent = c.tag; $('sim-title').textContent = c.title; $('scene-caption').textContent = c.place;
  $('o2box').hidden = !cfg.showO2; $('live-charts').hidden = !cfg.showO2;
  buildActions();
  show('sim');
  try {
    Scene3D.init($('stage'), cfg.caseId); has3D = true; setCam('wide');
  } catch {
    has3D = false;
    if (!$('no3d')) { const d = document.createElement('div'); d.className = 'no3d'; d.id = 'no3d'; d.textContent = 'Este navegador no puede mostrar la escena 3D. La simulación funciona igual con los signos y las gráficas.'; $('stage').appendChild(d); }
  }
  say(c.intro);
  render();
  clearInterval(rtTimer);
  if (cfg.realtime) rtTimer = setInterval(rtTick, 1000);
}

function buildActions() {
  const box = $('actions'); box.innerHTML = '';
  for (const g of ACTIONS) {
    const wrap = document.createElement('div'); wrap.className = 'agroup';
    wrap.innerHTML = `<h3>${g.group}</h3>`;
    const row = document.createElement('div'); row.className = 'abtns';
    for (const a of g.items) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'act' + (a.key ? ' key' : ''); b.id = 'act-' + a.id;
      b.innerHTML = `<b>${a.label}</b>${a.hint ? `<small>${a.hint}</small>` : ''}`;
      b.onclick = () => doAction(a.id);
      row.appendChild(b);
    }
    wrap.appendChild(row); box.appendChild(wrap);
  }
}

function say(text, kind) { feed.unshift({ t: S.t, text, kind: kind || 'info' }); renderFeed(); }
function renderFeed() { $('feed').innerHTML = feed.map((f) => `<div class="item ${f.kind === 'crit' ? 'crit' : ''}"><span class="t">${fmt(f.t)}</span><span>${f.text}</span></div>`).join(''); }

// ---------- Textos de signos ----------
function breathingText(d) {
  if (S.arrest) return { t: 'No respira; solo jadea de vez en cuando', c: 'bad' };
  const n = Math.round(d.rr);
  if (n < 2) return { t: 'Casi no respira', c: 'bad' };
  if (n < 8) return { t: `Muy lenta: ${n} por minuto`, c: 'bad' };
  if (n < 12) return { t: `Lenta pero presente: ${n} por minuto`, c: 'mid' };
  return { t: `Normal: ${n} por minuto`, c: 'ok' };
}
function respText(d) {
  return [
    { t: 'No responde a la voz ni al dolor', c: 'bad' },
    { t: 'Solo se queja cuando le frotas el pecho', c: 'bad' },
    { t: 'Abre los ojos y se vuelve a dormir', c: 'mid' },
    { t: 'Despierta y habla', c: 'ok' },
  ][d.cons];
}
function eyeSVG(mm) {
  const r = Math.max(1.1, mm * 1.05);
  return `<svg viewBox="0 0 46 28" aria-hidden="true"><path d="M2 14 Q23 -3 44 14 Q23 31 2 14Z" fill="#fff" stroke="#1C2854" stroke-width="1.6"/><circle cx="23" cy="14" r="8.5" fill="#6b4a2f"/><circle cx="23" cy="14" r="${r.toFixed(1)}" fill="#0d0d0d"/><circle cx="25.5" cy="11.5" r="1.3" fill="#fff" opacity=".8"/></svg>`;
}
function pupilText(d) {
  const mm = d.pupil;
  if (mm < 1.8) return { t: `Puntiformes (${mm.toFixed(1)} mm); no cambian con la luz`, c: 'bad', mm };
  if (mm < 2.8) return { t: `Pequeñas (${mm.toFixed(1)} mm)`, c: 'mid', mm };
  return { t: `Normales (${mm.toFixed(1)} mm)`, c: 'ok', mm };
}
function colorText() {
  if (S.o2 < 75) return { t: 'Labios y uñas violeta o azules', c: 'bad' };
  if (S.o2 < 88) return { t: 'Labios pálidos, algo morados', c: 'mid' };
  return { t: 'Color normal', c: 'ok' };
}
function bodyText(d) {
  if (S.arrest || S.o2 < 70) return { t: 'Piel fría y grisácea; cuerpo flojo', c: 'bad' };
  if (d.cons <= 1) return { t: S.o2 < 85 ? 'Cuerpo flojo, piel fría' : 'Cuerpo flojo', c: 'bad' };
  if (d.cons === 2) return { t: 'Somnolienta, sin fuerza', c: 'mid' };
  return S.doses.length ? { t: 'Suda, tiembla, tiene náuseas', c: 'mid' } : { t: 'Normal', c: 'ok' };
}
function soundText(d) {
  if (S.arrest) return { t: 'Jadeos aislados', c: 'bad' };
  if (S.aspirated && S.t - S.vomitAt < 90) return { t: 'Tos y gorgoteo', c: 'bad' };
  if (d.rr < 8 && d.cons <= 1) return (S.position === 'lado' || S.airwayOpen) ? { t: 'Respiración muy débil', c: 'bad' } : { t: 'Ronca fuerte o gorgotea', c: 'bad' };
  return { t: 'Sin ruidos anormales', c: 'ok' };
}

function poseName(d) {
  if (d.cons === 3 && !S.arrest) return 'sitting';
  if (S.position === 'lado') return 'side';
  if (S.airwayOpen || extra.anim === 'breaths' || extra.anim === 'cpr') return 'open';
  return 'supine';
}

function render() {
  const d = derived(S);
  $('clk').textContent = fmt(S.t);
  const ems = $('ems');
  if (S.called911 === null) { ems.textContent = 'Sin llamar'; ems.className = 'val off'; }
  else { const left = Math.max(0, S.called911 + EMS_DELAY - S.t); ems.textContent = left > 0 ? fmt(left) : 'Llegó'; ems.className = 'val ems'; }

  const setSign = (id, o, html) => { const el = $(id); el.innerHTML = (html || '') + `<span>${esc(o.t)}</span>`; el.className = 'v ' + o.c; };
  known.resp ? setSign('s-resp', respText(d)) : setSign('s-resp', { t: 'Sin evaluar', c: 'unknown' });
  known.breath ? setSign('s-breath', breathingText(d)) : setSign('s-breath', { t: 'Sin evaluar', c: 'unknown' });
  if (known.pupils) { const p = pupilText(d); setSign('s-pupil', p, eyeSVG(p.mm)); } else setSign('s-pupil', { t: 'Sin evaluar', c: 'unknown' });
  setSign('s-color', colorText());
  setSign('s-body', bodyText(d));
  known.breath || known.resp ? setSign('s-sound', soundText(d)) : setSign('s-sound', { t: 'Acércate para escuchar', c: 'unknown' });
  $('s-pos').textContent = d.cons === 3 && !S.arrest ? 'Sentada' : S.position === 'lado' ? 'Posición de rescate (de lado)' : S.airwayOpen ? 'Boca arriba, vía aérea abierta' : 'Boca arriba';

  const o2 = Math.round(S.o2);
  $('o2num').textContent = o2 + ' %';
  const fill = $('o2fill'); fill.style.width = o2 + '%';
  fill.style.backgroundColor = o2 < 75 ? 'var(--crit)' : o2 < 85 ? 'var(--warn)' : 'var(--good)';

  for (let i = 0; i < 2; i++) {
    const el = $('dose' + (i + 1)), used = S.doses.length > i;
    el.className = 'dose' + (used ? ' used' : '');
    el.innerHTML = `<svg viewBox="0 0 12 24"><rect x="1.5" y="8" width="9" height="15" rx="2.5" fill="#f4f4f2" stroke="#c8312b" stroke-width="1.4"/><rect x="4" y="1" width="4" height="8" rx="2" fill="#9aa3b5"/></svg>Dosis ${i + 1}`;
  }

  if (has3D) Scene3D.update({
    pose: poseName(d), anim: extra.anim, rr: S.arrest ? 0 : d.rr, arrest: S.arrest,
    cyan: Math.max(0, Math.min(1, (92 - S.o2) / 42)), cons: d.cons, vomit: S.vomitAt !== null && S.t - S.vomitAt < 600,
    phone: S.called911 !== null, dosesUsed: S.doses.length, pupil: d.pupil, agit: extra.agit / 100, emocion: extra.emocion,
  });
  $('alarm').classList.toggle('on', S.arrest);
  const doing = $('doing'); doing.hidden = !DOING[extra.anim]; doing.textContent = DOING[extra.anim] || '';

  if (cfg.showO2 && S.hist.length !== lastHist) { lastHist = S.hist.length; drawLive(); }

  const lock = busy || modalOpen || S.ended;
  document.querySelectorAll('.act').forEach((b) => (b.disabled = lock));
  if (!lock) { $('act-call').disabled = S.called911 !== null; $('act-nalox').disabled = S.doses.length >= 2; }
}

// ---------- Gráficas ----------
function chartEvents(withEnd) {
  const ev = [];
  if (S.called911 !== null) ev.push({ t: S.called911, label: '9-1-1', color: 'var(--navy)' });
  S.doses.forEach((d, i) => ev.push({ t: d.t, label: 'Narcan ' + (i + 1), color: '#c99a1c' }));
  if (S.arrestAt !== null && S.arrestAt > 0) ev.push({ t: S.arrestAt, label: 'Paro', color: 'var(--crit)' });
  if (cfg.caseId === 'tardio' && S.arrestAt === 0) ev.push({ t: 0, label: 'Paro', color: 'var(--crit)' });
  if (S.rosc !== null) ev.push({ t: S.rosc, label: 'Pulso', color: 'var(--good)' });
  if (withEnd && endReason === 'ems') ev.push({ t: S.t, label: 'Ambulancia', color: 'var(--good)' });
  return ev.sort((a, b) => a.t - b.t);
}
function series(i) { return S.hist.map((h) => [h[0], h[3] && i === 2 ? 0 : h[i]]); }
function drawLive() {
  const ev = chartEvents(false), tEnd = Math.max(S.t, 240);
  drawChart($('ch-o2'), { data: series(1), yMax: 100, yTicks: [0, 50, 85], band: [0, 85], bandColor: 'var(--crit-soft)', h: 118, events: ev, labels: true, tEnd, fmtV: (v) => v + ' %' });
  drawChart($('ch-rr'), { data: series(2), yMax: 20, yTicks: [0, 10, 20], band: [12, 20], bandColor: 'var(--good-soft)', h: 92, events: ev, labels: false, tEnd, fmtV: (v) => v + ' por min' });
}

// ---------- Avance del tiempo ----------
function run(sec, mode, done) {
  busy = true; extra.anim = mode; render();
  const frames = Math.max(1, Math.min(26, Math.ceil(sec / 4)));
  const chunk = Math.ceil(sec / frames);
  let spent = 0;
  const prog = $('prog');
  const tick = () => {
    const n = Math.min(chunk, sec - spent);
    const ev = advance(S, n, mode);
    spent += n;
    prog.style.width = Math.round((spent / sec) * 100) + '%';
    render();
    if (ev.length || spent >= sec) {
      busy = false; extra.anim = 'none'; prog.style.width = '0';
      if (done) done();
      handleEvents(ev);
      render();
    } else setTimeout(tick, mode === 'none' ? 45 : 70);
  };
  setTimeout(tick, 30);
}
function rtTick() {
  if (!S || S.ended || busy || modalOpen) return;
  handleEvents(advance(S, 1, 'none'));
  render();
}

function doAction(id) {
  if (!S || S.ended || busy || modalOpen) return;
  const d = derived(S);
  const first = (key) => !timeline.some((x) => x.id === key);
  const tl = (label, verdict, note) => timeline.push({ t: S.t, id, label, verdict, note: note || '' });
  switch (id) {
    case 'resp':
      known.resp = true;
      say(`Le gritas su nombre y le frotas el esternón con los nudillos. ${respText(d).t}.`);
      tl('Verificaste si respondía', first('resp') ? 'good' : 'info');
      run(10, 'none'); break;
    case 'pupils': {
      known.pupils = true;
      const p = pupilText(d);
      say(`Le abres un párpado con el pulgar. Pupilas: ${p.t.toLowerCase()}.`);
      tl('Le miraste las pupilas', 'good');
      if (has3D) { setCam('face'); Scene3D.checkPupils(); }
      run(5, 'none'); break;
    }
    case 'breath':
      known.breath = true;
      say(`Acercas la cara a su boca y miras el pecho durante 10 segundos. ${breathingText(d).t}. ${soundText(d).t}.`);
      tl('Revisaste la respiración', 'good');
      run(10, 'none'); break;
    case 'call': {
      S.called911 = S.t;
      say('Llamas al 9-1-1 y pones el teléfono en altavoz. Das la dirección y dices: "Una persona no responde y casi no respira". La operadora te dice que la ambulancia va en camino y que no la dejes sola.');
      const late = S.t > 120;
      tl('Llamaste al 9-1-1', late ? 'warn' : 'good', late ? 'Lo ideal es llamar desde el principio.' : '');
      run(20, 'none'); break;
    }
    case 'airway':
      if (S.arrest) {
        S.position = 'espalda'; S.airwayOpen = true;
        say('La pones boca arriba y le subes la barbilla. La vía aérea está abierta, pero no respira: necesita RCP.', 'crit');
        tl('Abriste las vías aéreas', 'info', 'Sin respiración, el siguiente paso es la RCP.');
        run(8, 'none'); break;
      }
      S.position = 'espalda'; S.airwayOpen = true;
      say(d.rr >= 1 ? 'La pones boca arriba, le inclinas la cabeza hacia atrás y le subes la barbilla. El ronquido baja y el aire entra mejor.' : 'La pones boca arriba y le subes la barbilla para abrir la vía aérea.');
      tl('Abriste las vías aéreas', 'good');
      run(10, 'none'); break;
    case 'nalox':
      if (S.doses.length >= 2) return;
      if (S.doses.length === 0) openNarcanTask(); else giveDose(1, 0, []);
      break;
    case 'breaths':
      if (!S.arrest && d.cons >= 2) {
        say('La persona respira por su cuenta y reacciona. No necesita respiraciones de rescate.');
        tl('Intentaste dar respiraciones a alguien que respiraba', 'info'); run(5, 'none'); return;
      }
      S.position = 'espalda'; S.airwayOpen = true; known.breath = true;
      if (S.arrest) {
        say('Le das respiraciones. El pecho sube, pero su corazón no está bombeando: sin compresiones el oxígeno no llega al cerebro.', 'crit');
        tl('Diste solo respiraciones de rescate', 'bad', 'Si no respira o solo jadea, hace falta RCP con compresiones.');
      } else {
        say('Le subes la barbilla, le tapas la nariz y le das una respiración cada 5 segundos. Ves que el pecho sube.');
        tl('Diste respiraciones de rescate (1 min)', 'good');
      }
      run(60, 'breaths'); break;
    case 'cpr':
      if (!S.arrest && d.cons >= 2) {
        say('La persona respira y reacciona. No necesita RCP.');
        tl('Intentaste RCP en alguien que respiraba', 'info'); run(5, 'none'); return;
      }
      S.position = 'espalda'; S.airwayOpen = true; known.breath = true;
      say('La pones boca arriba en el piso y empiezas la RCP: 30 compresiones fuertes y rápidas en el centro del pecho y 2 respiraciones, sin parar.');
      tl('Hiciste RCP (2 min)', S.arrest ? 'good' : 'info', S.arrest ? '' : 'Respiraba lento: bastaban respiraciones de rescate, pero ante la duda la RCP es aceptable.');
      run(120, 'cpr'); break;
    case 'lado':
      if (S.arrest) {
        say('La pones de lado, pero no respira. De lado no se le puede dar RCP.', 'crit');
        tl('La pusiste de lado sin que respirara', 'bad', 'La posición de rescate es para quien respira por su cuenta.');
        run(10, 'none'); return;
      }
      S.position = 'lado';
      say('La giras de lado, con la rodilla de arriba doblada y la mano bajo la mejilla. Así la vía aérea queda abierta y no se ahoga si vomita.');
      tl('La pusiste en posición de rescate', d.rr >= 6 ? 'good' : 'warn', d.rr >= 6 ? '' : 'Todavía respiraba muy poco: primero necesitaba naloxona y respiraciones de rescate.');
      run(15, 'none'); break;
    case 'observe': {
      let verdict = 'good', note = '';
      if (S.arrest) { verdict = 'bad'; note = 'No respiraba: necesitaba RCP.'; }
      else if (d.rr < 8 && d.cons <= 1) { verdict = 'bad'; note = 'Respiraba muy poco y nadie la ayudaba a respirar.'; }
      const secs = (!S.arrest && d.cons === 3) ? 120 : 60;
      say(S.arrest ? 'Esperas, pero la persona no se mueve ni respira.' : 'Te quedas a su lado y vigilas su respiración.', S.arrest ? 'crit' : 'info');
      tl(`Te quedaste vigilándola (${secs / 60} min)`, verdict, note);
      run(secs, 'none'); break;
    }
    case 'water':
      S.myths++;
      say('Le echas agua fría. No reacciona, y ahora está mojada y fría. El agua no revierte una sobredosis y puede hacer que se ahogue.', 'crit');
      tl('Le echaste agua fría', 'bad', 'Es un mito: se pierde tiempo y puede causar hipotermia o ahogamiento.');
      run(45, 'none'); break;
    case 'sleep':
      S.myths++;
      say('Decides dejarla "dormir la nota". Pasan dos minutos y el ronquido es cada vez más lento.', 'crit');
      tl('La dejaste "dormir la nota"', 'bad', 'Roncar o no despertar es una emergencia, no un sueño profundo.');
      run(120, 'none'); break;
    case 'leave': {
      tl('Te fuiste del lugar', 'bad');
      S.left = true;
      let ev = [];
      while (!ev.some((e) => ['death', 'timeout', 'ems'].includes(e))) ev = advance(S, 30, 'none');
      finish('leave'); break;
    }
  }
}

function giveDose(f, extraSec, notes) {
  const d = derived(S);
  const n = S.doses.length + 1;
  let verdict = f >= 1 ? 'good' : f > 0 ? 'warn' : 'bad', note = notes.join(' ');
  if (d.cons === 3) { verdict = 'bad'; note = 'Ya estaba despierta: otra dosis solo empeora la abstinencia.'; extra.extraDoseAwake = true; }
  else if (n === 2 && S.t - doseT(0) < 170) { verdict = 'warn'; note = (note + ' La guía del Departamento es esperar 3 minutos entre dosis.').trim(); extra.earlyDose = true; }
  if (S.arrest && !note) note = 'Si hay otra persona, que dé el Narcan mientras tú sigues la RCP.';
  S.doses.push({ t: S.t, f });
  if (f === 0) say('El spray se perdió en el aire. Ese dispositivo ya no sirve: cada uno tiene una sola dosis.', 'crit');
  else if (n === 1) say(f < 1 ? 'Le das Narcan, pero no entró toda la dosis en una sola fosa nasal. Tarda de 2 a 3 minutos en hacer efecto.' : 'Le das 4 mg de Narcan en una fosa nasal. Tarda de 2 a 3 minutos en hacer efecto.');
  else say('Le das la segunda dosis en la otra fosa nasal. Ya no te quedan más.');
  timeline.push({ t: S.t, id: 'nalox', label: f === 0 ? 'Perdiste una dosis de Narcan' : `Diste la dosis ${n} de Narcan`, verdict, note });
  run(15 + extraSec, 'none');
}

// ---------- Administración de Narcan paso a paso ----------
function openNarcanTask() {
  const st = { i: 0, f: 1, sec: 0, notes: [], wasted: false };
  const draw = (fb) => {
    const step = NARC_STEPS[st.i];
    openModal(`<span class="eyebrow">Administrar naloxona · paso ${st.i + 1} de 3</span>
      <div class="steps">${NARC_STEPS.map((_, k) => `<i class="${k <= st.i ? 'on' : ''}"></i>`).join('')}</div>
      <h2>${step.q}</h2>
      ${fb ? `<div class="feedback ${fb.c}">${fb.t}</div><div class="opts"><button class="btn primary" id="nx">${fb.end ? 'Continuar' : 'Siguiente paso'}</button></div>`
        : `<div class="opts">${step.o.map((o, k) => `<button class="btn" data-k="${k}">${o.t}</button>`).join('')}</div>`}`);
    if (fb) {
      $('nx').onclick = () => {
        if (fb.end) { closeModal(); giveDose(st.wasted ? 0 : st.f, st.sec, st.notes); }
        else { st.i++; draw(); }
      };
      return;
    }
    $('modal-card').querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => {
      const o = step.o[+b.dataset.k];
      if (o.sec) st.sec += o.sec;
      if (o.f) st.f = Math.min(st.f, o.f);
      if (!o.ok) { st.notes.push(o.fb); extra.narcErrors.push(o.t); }
      if (o.wasted) st.wasted = true;
      const end = st.wasted || st.i === NARC_STEPS.length - 1;
      draw({ t: o.fb, c: o.ok ? 'ok' : o.wasted ? 'no' : 'mid', end });
    }));
  };
  draw();
}

// `ev` son los eventos de un mismo segundo, en el orden fijo de advance() (engine.js): primero el que no termina el
// caso y después el que lo termina. Si en ese segundo también llega la ambulancia (o termina el caso), no se abren
// el diálogo del vómito ni la conversación al despertar: el resultado los taparía.
function handleEvents(ev) {
  const termina = ev.some((e) => ['ems', 'death', 'timeout'].includes(e));
  for (const e of ev) {
    if (S.ended) return;
    if (e === 'arrest') { say('La persona deja de respirar. Solo jadea de vez en cuando y no se mueve. Su corazón se detuvo.', 'crit'); known.breath = true; }
    else if (e === 'rosc') say('Con la RCP y la naloxona vuelve a tener pulso y empieza a respirar por su cuenta, todavía lento. Sigue sin despertar.');
    else if (e === 'vomit') {
      if (S.position === 'lado') { S.vomitHandled = true; say('Vomita. Como está de lado, el vómito sale de la boca y no se ahoga.'); }
      else if (!termina) openVomit();
    }
    else if (e === 'awake') { if (!termina) openAwake(); }
    else if (e === 'ems') finish('ems');
    else if (e === 'death') finish('death');
    else if (e === 'timeout') finish('timeout');
  }
}

// ---------- Diálogos ----------
function openModal(html, crit) {
  modalOpen = true;
  const card = $('modal-card'); card.className = 'card' + (crit ? ' crit' : ''); card.innerHTML = html;
  $('modal').hidden = false; render();
  const b = card.querySelector('button'); if (b) b.focus();
}
function closeModal() { modalOpen = false; $('modal').hidden = true; render(); }

function openVomit() {
  openModal(`<span class="eyebrow">Al ${fmt(S.t)}</span><h2>Está vomitando</h2>
    <p>La naloxona empieza a hacer efecto y la persona vomita mientras sigue boca arriba y medio inconsciente.</p>
    <div class="opts"><button class="btn" id="v1">Ponerla de lado y limpiarle la boca</button><button class="btn" id="v2">Seguir con lo que estabas haciendo</button></div>`, true);
  $('v1').onclick = () => {
    S.position = 'lado'; S.vomitHandled = true;
    timeline.push({ t: S.t, id: 'vomit', label: 'La viraste de lado cuando vomitó', verdict: 'good' });
    say('La viras de lado y le limpias la boca. Vuelve a respirar sin gorgoteo.');
    closeModal(); run(10, 'none');
  };
  $('v2').onclick = () => {
    S.aspirated = true; S.damage += 28; S.o2 = Math.max(10, S.o2 - 14);
    timeline.push({ t: S.t, id: 'vomit', label: 'Siguió boca arriba mientras vomitaba', verdict: 'bad', note: 'El vómito pasó a los pulmones (broncoaspiración).' });
    say('El vómito se le va a los pulmones. Tose, se ahoga y le baja el oxígeno.', 'crit');
    closeModal();
  };
}
// Conversación para calmar a la persona cuando despierta (contenido y reglas en DESPERTAR, content.js).
// La agitación (0 a 100) también mueve la escena 3D: con más agitación, la persona niega, mira a los lados,
// se mece y tiembla más (conducta al azar en scene.js).
const perfilDe = (id) => DESPERTAR[CASE_INFO[id].despertar] || DESPERTAR.nota;
function openAwake() {
  const P = perfilDe(cfg.caseId);
  // ?emocion=asco en la dirección fija la reacción (capturas, talleres), como ?persona= fija la persona.
  const fijas = P.variantes.filter((w) => w.emocion === new URLSearchParams(location.search).get('emocion'));
  const opciones = fijas.length ? fijas : P.variantes;
  const v = opciones[Math.floor(Math.random() * opciones.length)];
  const x = P.lo === 'la' ? 'a' : 'o', el = P.lo === 'la' ? 'ella' : 'él';
  const cv = { i: 0, orden: [] };
  extra.emocion = v.emocion;
  const setAgit = (a) => { extra.agit = Math.max(0, Math.min(100, a)); render(); };
  setAgit(v.agit);
  const nivel = () => extra.agit >= 70 ? `Muy alterad${x}` : extra.agit >= 40 ? `Alterad${x}` : `Más tranquil${x}`;
  const texto = (o) => (o.accion === 'cancelar' && S.called911 === null ? '"Bueno, si usted no quiere, no llamamos a nadie."' : o.t);
  const mezclar = (a) => a.map((o) => [Math.random(), o]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

  const terminar = (fin, nota) => {
    extra.conv = fin;
    closeModal();
    if (fin === 'calma') {
      extra.emocion = 'gratitud'; render();
      timeline.push({ t: S.t, id: 'awake', label: `${P.lo === 'la' ? 'La' : 'Lo'} calmaste y se quedó contigo`, verdict: 'good' });
      say(cv.cancelo && P.fin.calmaSinAmbulancia ? P.fin.calmaSinAmbulancia : P.fin.calma + (S.called911 === null ? ' Todavía nadie ha llamado al 9-1-1.' : ''));
    } else if (fin === 'malaGana') {
      timeline.push({ t: S.t, id: 'awake', label: `Se quedó, pero seguía alterad${x}`, verdict: 'warn', note: 'Hablar bajo, explicar qué pasó y no regañar ayuda a que se calme.' });
      say(P.fin.malaGana + (S.called911 === null ? ' Todavía nadie ha llamado al 9-1-1.' : ''));
    } else if (fin === 'seVa') {
      extra.seFue = true;
      timeline.push({ t: S.t, id: 'awake', label: `Se fue alterad${x}`, verdict: 'bad', note: 'Regañar, amenazar o sujetar sube el enojo. Explicar con calma y acompañar ayuda a que se quede.' });
      say(P.fin.seVa, 'crit');
      finish('letgo');
    } else {
      extra.letGo = true;
      timeline.push({ t: S.t, id: 'awake', label: `No te quedaste con ${el}`, verdict: 'bad', note: nota });
      finish('letgo');
    }
  };

  const responder = (o) => {
    if (o.ok === 'no') {
      extra.convMalas = (extra.convMalas || 0) + 1;
      if (!o.accion) timeline.push({ t: S.t, id: 'awake', label: 'Al despertar: ' + texto(o), verdict: 'bad', note: o.fb });
    }
    if (o.accion === 'dosis') {
      extra.extraDoseAwake = true; S.doses.push({ t: S.t, f: 1 });
      timeline.push({ t: S.t, id: 'nalox', label: 'Le diste otra dosis estando despiert' + x, verdict: 'bad', note: 'No hacía falta: solo empeora la abstinencia.' });
      say(`Le das otra dosis. Se pone más agitad${x}, vomita y tiembla más. No hacía falta: ya respiraba bien.`, 'crit');
    }
    if (o.accion === 'cancelar') {
      cv.cancelo = true;
      if (S.called911 !== null) { S.called911 = null; say('Llamas al 9-1-1 y cancelas la ambulancia.', 'crit'); }
      timeline.push({ t: S.t, id: 'call', label: 'Aceptaste que no llegara la ambulancia', verdict: 'bad', note: o.fb });
    }
    setAgit(extra.agit + o.d);
    const ultimo = cv.i === P.turnos.length - 1;
    // Se va si la agitación llega al máximo, pero no por una sola respuesta: desde el segundo turno.
    const seVa = extra.agit >= 100 && cv.i >= 1 && o.accion !== 'irse';
    const next = o.accion === 'irse' ? () => terminar('dejar', o.fb)
      : seVa ? () => terminar('seVa')
      : ultimo ? () => terminar(extra.agit <= 35 ? 'calma' : 'malaGana')
      : () => { cv.i++; draw(); };
    draw({ c: o.ok, t: o.fb, aviso: seVa ? P.fin.seVa : '', next });
  };

  const draw = (fb) => {
    const T = P.turnos[cv.i];
    if (!fb) cv.orden = mezclar(T.o.filter((o) => o.accion !== 'dosis' || S.doses.length < 2));
    const linea = cv.i === 0 ? v.dice : extra.agit >= 60 ? T.alta : T.baja;
    openModal(`<span class="eyebrow">Al ${fmt(S.t)} · Despertó · ${cv.i + 1} de ${P.turnos.length}</span>
      <h2>${cv.i === 0 ? 'Despertó' : 'Sigues hablando con ' + el}</h2>
      ${cv.i === 0 ? `<p>${v.escena}</p>` : ''}
      <p class="dice">${linea}</p>
      <div class="agit" role="meter" aria-label="Agitación" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(extra.agit)}" aria-valuetext="${nivel()}">
        <span>Agitación</span><span class="bar"><i class="${extra.agit >= 70 ? 'alta' : extra.agit < 40 ? 'baja' : ''}" style="width:${extra.agit}%"></i></span><b>${nivel()}</b></div>
      ${fb ? `<div class="feedback ${fb.c}">${fb.t}</div>${fb.aviso ? `<p class="dice">${fb.aviso}</p>` : ''}
        <div class="opts"><button class="btn primary" id="cv-next">Seguir</button></div>`
      : `<div class="opts">${cv.orden.map((o, k) => `<button class="btn" data-k="${k}">${texto(o)}</button>`).join('')}</div>
        ${S.called911 === null ? '<button class="btn ghost" id="cv-911">Llamar al 9-1-1 en altavoz sin dejar de hablarle</button>' : ''}`}`, cv.i === 0 && !fb && extra.agit >= 70);
    if (fb) { $('cv-next').onclick = fb.next; return; }
    $('modal-card').querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => responder(cv.orden[+b.dataset.k])));
    if ($('cv-911')) $('cv-911').onclick = () => {
      S.called911 = S.t;
      timeline.push({ t: S.t, id: 'call', label: 'Llamaste al 9-1-1 después de que despertó', verdict: 'warn', note: LLAMAR.fb });
      say('Llamas al 9-1-1 en altavoz sin dejar de hablarle. La ambulancia va en camino.');
      setAgit(extra.agit + LLAMAR.d);
      draw();
    };
  };
  draw();
}

// ================= Resultado =================
function finish(reason) {
  if (S.ended) return;
  S.ended = true; endReason = reason; clearInterval(rtTimer); render();
  setTimeout(showResult, reason === 'ems' || reason === 'death' ? 1100 : 300);
}

function showResult() {
  let oc = outcome(S);
  if (endReason === 'letgo' && oc !== 'muerte') oc = 'riesgo';
  if (endReason === 'leave' && oc !== 'muerte' && S.awakeAt !== null && S.called911 === null) oc = 'riesgo';
  const c = CASE_INFO[cfg.caseId];
  const x = perfilDe(cfg.caseId).lo === 'la' ? 'a' : 'o';
  const tNal = S.doses.length ? doseT(0) : null;
  const vent = timeline.find((x) => x.id === 'breaths' || x.id === 'cpr');
  const tVent = vent ? vent.t : null;
  const tCpr = (timeline.find((x) => x.id === 'cpr') || { t: null }).t;

  const headline = { sobrevive: 'Sobrevivió', dano: 'Sobrevivió con posible daño cerebral', muerte: 'La persona murió', riesgo: 'Sobrevivió por ahora, pero quedó en riesgo' }[oc];
  let story;
  if (oc === 'muerte') {
    if (endReason === 'leave') story = 'Te fuiste y nadie más llegó a ayudar. Sin oxígeno, su corazón se detuvo. La Ley 35 de Puerto Rico protege a quien, de buena fe, administra naloxona para salvar una vida: llama al 9-1-1 y quédate.';
    else if (S.doses.length === 0 && !tVent) story = 'Nadie le dio naloxona ni la ayudó a respirar. Una sobredosis de opioides apaga la respiración: sin oxígeno, el cerebro se daña en minutos y el corazón termina por detenerse.';
    else if (S.arrest && S.arrestNoCpr > 60) story = 'Su corazón se detuvo y pasó demasiado tiempo sin compresiones. Cuando alguien no respira o solo jadea, la RCP es lo único que mueve la sangre hasta que llega la ambulancia.';
    else story = 'Pasó demasiado tiempo con muy poco oxígeno. Cada minuto cuenta: llamar al 9-1-1, abrir la vía aérea, dar naloxona y ayudar a respirar desde el principio cambia el resultado.';
  } else if (oc === 'dano') story = 'La ambulancia llegó y la persona vive, pero estuvo varios minutos con muy poco oxígeno. Puede quedar con problemas de memoria, movimiento o habla. Actuar más rápido en los primeros minutos reduce ese riesgo.';
  else if (oc === 'riesgo') story = extra.seFue
    ? `Se fue alterad${x} antes de que l${x} revisaran. La naloxona dura de 30 a 90 minutos y lo que ${c.despertar === 'nota' ? 'usó' : 'tomó'} puede durar más: puede volver a dejar de respirar sin nadie cerca.`
    : endReason === 'letgo'
      ? (c.despertar === 'nota'
        ? 'Se fue solo. La naloxona dura de 30 a 90 minutos y el fentanilo puede durar más: puede volver a dejar de respirar en la calle, o si usa otra vez para quitarse la abstinencia, sin nadie cerca.'
        : `Quedó sin nadie que l${x} vigilara. La naloxona dura de 30 a 90 minutos y lo que tomó puede durar más: puede volver a dejar de respirar sin que nadie se dé cuenta.`)
      : 'Despertó, pero quedó sin compañía. Si la droga dura más que la naloxona, puede volver a caer sin que nadie lo vea.';
  else story = S.called911 !== null
    ? 'Llegaron los paramédicos y la persona está viva y respirando. La llevarán al hospital para vigilarla, porque la naloxona puede pasarse antes que la droga. Después, el Programa de Navegadores puede ayudarla a llegar a tratamiento.'
    : 'La persona sobrevivió, pero nadie llamó al 9-1-1. Debe evaluarla personal médico: la naloxona puede pasarse antes que la droga.';

  const check = [];
  const ck = (ok, title, note) => check.push({ ok, title, note });
  const triad = ['resp', 'pupils', 'breath'].filter((k) => timeline.some((x) => x.id === k)).length;
  ck(triad === 3 ? 'ok' : triad ? 'mid' : 'no', 'Identificar la tríada', triad === 3 ? 'Revisaste respuesta, pupilas y respiración.' : `Revisaste ${triad} de 3 signos (respuesta, pupilas, respiración).`);
  ck(S.called911 !== null ? (S.called911 <= 120 ? 'ok' : 'mid') : 'no', 'Llamar al 9-1-1', S.called911 !== null ? `Llamaste al ${fmt(S.called911)}.` : 'Nadie llamó. Sin ambulancia, todo depende de ti.');
  const airwayDone = timeline.some((x) => ['airway', 'breaths', 'cpr', 'lado'].includes(x.id));
  ck(airwayDone ? 'ok' : 'no', 'Abrir las vías aéreas', airwayDone ? 'Subiste la barbilla o la pusiste en posición de rescate.' : 'Boca arriba y sin subir la barbilla, la lengua bloquea el paso del aire.');
  const goodDose = S.doses.find((d) => d.f > 0);
  ck(goodDose ? (goodDose.t <= 120 && !extra.narcErrors.length ? 'ok' : 'mid') : 'no', 'Dar naloxona correctamente',
    goodDose ? (extra.narcErrors.length ? `Primera dosis al ${fmt(goodDose.t)}, con errores en la técnica.` : `Primera dosis al ${fmt(goodDose.t)}, con buena técnica.`) : 'No recibió naloxona.');
  if (cfg.caseId === 'tardio') ck(tCpr !== null ? (tCpr <= 30 ? 'ok' : 'mid') : 'no', 'Empezar la RCP de inmediato', tCpr !== null ? `Empezaste al ${fmt(tCpr)}.` : 'No hubo RCP. Jadear no es respirar.');
  else ck(tVent !== null ? (tVent <= 120 ? 'ok' : 'mid') : 'no', 'Ayudarla a respirar', tVent !== null ? `Primeras respiraciones al ${fmt(tVent)}.` : 'Nadie le dio respiraciones mientras la naloxona hacía efecto.');
  if ((S.vomitAt !== null || cfg.caseId === 'xilazina' || S.rosc !== null) && oc !== 'muerte')
    ck(S.aspirated ? 'no' : (S.position === 'lado' || S.vomitHandled ? 'ok' : 'mid'), 'Posición de rescate',
      S.aspirated ? 'Vomitó boca arriba y se broncoaspiró.' : (S.position === 'lado' || S.vomitHandled ? 'Quedó protegida si vomitaba.' : 'Quedó boca arriba; si vomita se puede ahogar.'));
  if (extra.conv && extra.conv !== 'dejar') ck(extra.conv === 'calma' && extra.convMalas ? 'mid' : { calma: 'ok', malaGana: 'mid', seVa: 'no' }[extra.conv], `Calmarl${x} al despertar`,
    { calma: extra.convMalas ? 'Se calmó y se quedó contigo, pero alguna respuesta no fue segura o no ayudó. Revísala en tus decisiones.' : 'Hablaste con calma, explicaste qué pasó y se quedó contigo.', malaGana: 'Se quedó, pero seguía alterad' + x + '. Evita regañar, amenazar o dar órdenes.', seVa: 'Se fue alterad' + x + '. Explicar con calma y acompañar ayuda a que se quede.' }[extra.conv]);
  ck(extra.letGo || S.left ? 'no' : extra.seFue ? 'mid' : 'ok', `No dejarl${x} sol${x}`,
    extra.letGo ? `Dejaste que se quedara sin compañía.` : S.left ? 'Te fuiste del lugar.' : extra.seFue ? 'Te quedaste, pero se fue.' : 'Te quedaste hasta el final.');
  if (S.myths > 0) ck('no', 'Evitar los mitos', 'El agua fría o dejarla dormir solo hacen perder tiempo.');
  if (extra.earlyDose) ck('mid', 'Esperar 3 minutos entre dosis', 'Diste la segunda dosis demasiado pronto.');

  const metric = (lbl, t) => `<div class="metric"><span class="lbl">${lbl}</span><span class="val ${t === null ? 'none' : ''}">${t === null ? 'No ocurrió' : fmt(t)}</span></div>`;
  const tl = timeline.slice().sort((a, b) => a.t - b.t);

  $('screen-result').innerHTML = `
    <span class="eyebrow">${c.tag} · ${c.title}</span>
    <div class="verdict ${oc}"><h2>${headline}</h2><p>${story}</p></div>
    <div class="metrics">
      ${metric('Llamada al 9-1-1', S.called911)}
      ${metric('Primera dosis de Narcan', tNal)}
      ${metric(cfg.caseId === 'tardio' ? 'Inicio de la RCP' : 'Primeras respiraciones', cfg.caseId === 'tardio' ? tCpr : tVent)}
      <div class="metric"><span class="lbl">Tiempo con oxígeno bajo 85 %</span><span class="val">${fmt(S.critSeconds)}</span></div>
    </div>
    <div class="panel">
      <h3>Lo que pasó en su cuerpo</h3>
      <div class="charts">
        <div class="chart"><div class="ttl"><b>Oxígeno en sangre (%)</b><span>Zona de peligro bajo 85 %</span></div><svg id="r-o2"></svg></div>
        <div class="chart"><div class="ttl"><b>Respiraciones por minuto</b><span>Normal: 12 a 20</span></div><svg id="r-rr"></svg></div>
      </div>
      <p class="note">Las líneas punteadas marcan tus decisiones clave. Pasa el cursor sobre la gráfica para ver cada momento.</p>
    </div>
    <div class="two">
      <div class="panel"><h3>Lo esencial</h3>
        <ul class="checklist">${check.map((x) => `<li><span class="mark ${x.ok}" aria-label="${x.ok === 'ok' ? 'Bien' : x.ok === 'mid' ? 'Mejorable' : 'Faltó'}">${x.ok === 'ok' ? '✓' : x.ok === 'mid' ? '!' : '✕'}</span><span><b>${x.title}</b><small>${x.note}</small></span></li>`).join('')}</ul>
      </div>
      <div class="panel"><h3>Tus decisiones</h3>
        <ul class="timeline">${tl.map((x) => `<li class="${x.verdict}"><span class="t">${fmt(x.t)}</span><span>${esc(x.label)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</span></li>`).join('') || '<li><span class="t">—</span><span>No tomaste ninguna acción.</span></li>'}</ul>
      </div>
    </div>
    <div class="panel"><h3>Para recordar en este caso</h3><ul class="lessons">${c.lessons.map((l) => `<li>${l}</li>`).join('')}</ul></div>
    <div class="panel">
      <h3>Cómo administrar naloxona · Departamento de Salud</h3>
      <ol class="proto">
        <li><b>Llama al 9-1-1</b>y quédate junto a la persona hasta que llegue la asistencia médica.</li>
        <li><b>Identifica la tríada:</b>pupilas contraídas, problemas para respirar y no responde.</li>
        <li><b>Boca arriba y vía aérea abierta:</b>sube la barbilla. Comienza la RCP si es necesaria.</li>
        <li><b>Sostén el dispositivo:</b>pulgar en el émbolo; índice y dedo del corazón a cada lado de la boquilla. No lo pruebes ni lo batas.</li>
        <li><b>Administra:</b>introduce la boquilla en una fosa nasal hasta que tus dedos rocen la nariz y presiona el émbolo rápido y firme.</li>
        <li><b>Espera 3 minutos</b>antes de dar otra dosis, si hace falta. Pon a la persona en posición de rescate y no la dejes sola.</li>
      </ol>
      <p class="law"><b>Ley 35 de Puerto Rico:</b> protege a todas las personas que, de buena fe, administren naloxona para salvar la vida de otra persona.</p>
    </div>
    <div class="division">${DIVISION_HTML}</div>
    <div class="row"><button class="btn primary" id="again">Repetir este caso</button><button class="btn" id="other">Escoger otro caso</button></div>`;
  $('again').onclick = () => startSim();
  $('other').onclick = () => { buildIntro(); show('intro'); };
  show('result');
  const ev = chartEvents(true);
  drawChart($('r-o2'), { data: series(1), yMax: 100, yTicks: [0, 50, 85], band: [0, 85], bandColor: 'var(--crit-soft)', h: 190, events: ev, labels: true, tEnd: S.t, hover: true, fmtV: (v) => v + ' % de oxígeno' });
  drawChart($('r-rr'), { data: series(2), yMax: 20, yTicks: [0, 10, 20], band: [12, 20], bandColor: 'var(--good-soft)', h: 130, events: ev, labels: false, tEnd: S.t, hover: true, fmtV: (v) => v + ' respiraciones por min' });
}
