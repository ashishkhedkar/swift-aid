// static/js/app.js — Main controller: dispatch, loop, UI wiring

// ─── State ──────────────────────────────────────────
let grid, sigMan, engine;
let ambulances = [];
let animFrame  = null;
let lastTime   = 0;
let tick       = 0;
let running    = false;
let mapMode    = 'gis';  // 'gis' | 'grid'

// Session
let ssMissions = 0, ssSaved = 0;

// UI
let curPriority = 'P1';
let curUnits    = 1;
let logLines    = [];

// ─── Boot ────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  grid   = new CityGrid(CONFIG.GRID, CONFIG.CELL);
  sigMan = new SignalManager(CONFIG.GRID);
  engine = new DecisionEngine(sigMan, grid);

  initRenderer();      // renderer.js
  initGISMap();        // gis_layer.js

  window.addEventListener('resize', () => {
    resizeCanvas();
    if (gisMap) gisMap.invalidateSize();
  });

  setMapMode('gis', document.getElementById('mm-gis'));
  setInterval(tickClock, 1000);
  tickClock();
  addLog('System initialised — Pune emergency grid loaded', 'b');
  addLog(`${HOSPITALS.length} hospitals registered, ${CONFIG.GRID*CONFIG.GRID} intersections active`, '');
  loop(performance.now());
});

// ─── Map Mode ────────────────────────────────────────
function setMapMode(mode, btn) {
  mapMode = mode;
  document.querySelectorAll('.mm-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const gisEl    = document.getElementById('gis-map');
  const gridEl   = document.getElementById('grid-canvas');
  const coordHud = document.getElementById('coords-hud');

  if (mode === 'gis') {
    gisEl.classList.remove('hidden');
    gridEl.classList.add('hidden');
    coordHud.style.display = 'block';
    if (gisMap) gisMap.invalidateSize();
  } else {
    gisEl.classList.add('hidden');
    gridEl.classList.remove('hidden');
    coordHud.style.display = 'none';
    resizeCanvas();
  }
}

// ─── Dispatch ────────────────────────────────────────
function dispatch() {
  if (running) return;
  sigMan.reset();
  ambulances = [];

  const n    = curUnits;
  const pri  = curPriority;
  const algo = document.getElementById('algo-select').value;

  const starts = pickEdgeNodes(n);
  const ends   = pickEdgeNodes(n, starts);

  for (let i = 0; i < n; i++) {
    const [sr, sc] = starts[i];
    const [er, ec] = ends[i];
    const path = computeRoute(grid, sr, sc, er, ec, algo);
    const ox = getCanvasOffsets().ox, oy = getCanvasOffsets().oy;
    const amb = new Ambulance(sr, sc, er, ec, pri, ox, oy);
    amb.setPath(path);
    ambulances.push(amb);
    addLog(`Unit #${amb.id} dispatched  priority=${pri}  algo=${algo}`, 'g');

    // GIS: draw route + pan
    if (mapMode === 'gis') {
      const waypoints = path.map(pt => nodeToLatLng(pt.r, pt.c));
      drawGISRoute(waypoints, PRIORITY_COLORS[pri]);
      if (i === 0) panToRoute(path);
    }
  }

  const normT = ambulances.reduce((s,a) => s + estimateNormalTime(a.path, grid), 0);
  const aiT   = ambulances.reduce((s,a) => s + estimateAITime(a.path, grid), 0);
  const saved = Math.max(0, normT - aiT);
  ssSaved += saved;

  updateBA(normT, aiT, saved);
  setMetric('m-hops', ambulances[0]?.path.length - 1 || '--');
  setMetric('m-eta',  aiT.toFixed(1) + 's');
  setMetric('m-saved', saved.toFixed(1) + 's', 'c-green');

  running = true;
  setBadge('AI SYSTEM ACTIVE', 'badge-active');
  setSysDot('on', 'AI ACTIVE');
  document.getElementById('hdr-units').textContent = ambulances.length;
}

function runDemo() {
  if (running) return;
  loadScenario('peak');
  curPriority = 'P1';
  curUnits = 1;
  document.getElementById('algo-select').value = 'astar';
  document.querySelectorAll('.pb').forEach(b => b.classList.toggle('active', b.dataset.p === 'P1'));
  document.getElementById('unit-count').textContent = '1';
  setTimeout(() => {
    dispatch();
    addLog('Auto demo: peak-hour P1 — A* routing', 'b');
  }, 80);
}

function resetAll() {
  running = false;
  ambulances = [];
  grid   = new CityGrid(CONFIG.GRID, CONFIG.CELL);
  sigMan = new SignalManager(CONFIG.GRID);
  engine = new DecisionEngine(sigMan, grid);
  clearGISRoute();
  setBadge('SYSTEM READY — SELECT MODE AND DISPATCH', 'badge-idle');
  setSysDot('', 'STANDBY');
  ['m-eta','m-saved','m-hops'].forEach(id => setMetric(id, '--'));
  setMetric('m-sigs', '0', 'c-amber');
  document.getElementById('hdr-units').textContent = '0';
  document.getElementById('hud-spd').textContent = '0';
  document.getElementById('ba-without').textContent = '--';
  document.getElementById('ba-with').textContent = '--';
  addLog('City reset — all units cleared', '');
}

function loadScenario(name) {
  const sc = SCENARIOS[name];
  if (!sc) return;
  grid.regenerate(sc.congestionMultiplier);
  sc.signalChaos ? sigMan.chaos() : sigMan.reset();
  curUnits = sc.units;
  document.getElementById('unit-count').textContent = curUnits;
  curPriority = sc.priority;
  document.querySelectorAll('.pb').forEach(b => b.classList.toggle('active', b.dataset.p === sc.priority));
  addLog(`Scenario: ${sc.name} — ${sc.description}`, 'a');
}

// ─── Main Loop ───────────────────────────────────────
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 16.67, 3);
  lastTime = ts;
  tick++;

  if (tick % 2 === 0) sigMan.tick(true);

  if (running && ambulances.length) {
    updateAmbs(dt);
    const action = engine.update(ambulances);
    if (action?.reroute) {
      const amb = action.reroute;
      const algo = document.getElementById('algo-select').value;
      const newPath = computeRoute(grid, amb.r, amb.c, amb.destR, amb.destC, algo);
      if (newPath.length > 1) {
        amb.setPath(newPath);
        addLog(`Unit #${amb.id} rerouted — congestion avoided`, 'a');
        if (mapMode === 'gis') drawGISRoute(newPath.map(pt => nodeToLatLng(pt.r, pt.c)), PRIORITY_COLORS[amb.priorityLabel]);
      }
    }
    checkComplete();
    updateLiveUI();
  }

  if (mapMode === 'grid') renderGrid();
  else if (running) {
    // Update GIS ambulance markers
    for (const amb of ambulances) {
      if (amb.state === 'moving' || amb.state === 'arrived') {
        const [lat, lng] = nodeToLatLng(amb.r, amb.c);
        updateAmbulanceMarker(amb.id, lat, lng, amb.priorityLabel);
      }
    }
  }

  animFrame = requestAnimationFrame(loop);
}

function updateAmbs(dt) {
  const { ox, oy } = getCanvasOffsets();
  for (const amb of ambulances) {
    amb.ox = ox; amb.oy = oy;
    const { nodeLeft } = amb.tick(dt, grid);
    if (nodeLeft) sigMan.release(nodeLeft.r, nodeLeft.c, amb.id);
  }
}

function checkComplete() {
  const arrived = ambulances.filter(a => a.state === 'arrived');
  if (!arrived.length || arrived.length < ambulances.length) return;
  running = false;
  ssMissions += arrived.length;
  arrived.forEach(a => addLog(`Unit #${a.id} arrived — ${a.elapsedSeconds.toFixed(1)}s`, 'g'));
  addLog(`${sigMan.overrideCount} signals cleared this session`, 'a');
  setBadge('ALL UNITS ON SCENE', 'badge-done');
  setSysDot('', 'STANDBY');
  document.getElementById('hdr-units').textContent = '0';
  document.getElementById('ss-missions').textContent = ssMissions;
  document.getElementById('ss-saved').textContent = ssSaved.toFixed(1) + 's';
  document.getElementById('ss-sigs').textContent = sigMan.overrideCount;
  const avg = ssMissions > 0 ? (ssSaved / ssMissions).toFixed(1) + 's' : '--';
  document.getElementById('ss-avg').textContent = avg;
}

function updateLiveUI() {
  const totalSigs = ambulances.reduce((s, a) => s + a.sigsOverridden, 0);
  setMetric('m-sigs', totalSigs, 'c-amber');
  document.getElementById('hdr-sigs').textContent = sigMan.overrideCount;
  const active = ambulances.find(a => a.state === 'moving');
  document.getElementById('hud-spd').textContent = active ? active.currentSpeed : '0';
  if (active) setMetric('m-eta', (active.remainingHops * 0.85).toFixed(1) + 's');
}

// ─── UI helpers ──────────────────────────────────────
function setPriority(btn) {
  document.querySelectorAll('.pb').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  curPriority = btn.dataset.p;
}

function changeUnits(d) {
  curUnits = Math.max(1, Math.min(3, curUnits + d));
  document.getElementById('unit-count').textContent = curUnits;
}

function setMetric(id, val, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  if (cls) el.className = 'mcard-val ' + cls;
}

function updateBA(norm, ai, saved) {
  document.getElementById('ba-without').textContent = norm.toFixed(1) + 's';
  document.getElementById('ba-with').textContent    = ai.toFixed(1)   + 's';
  const pct = Math.round((saved / norm) * 100);
  document.getElementById('bf-green').style.width = (100 - pct) + '%';
  const mins = saved / 60;
  const survBoost = (mins * CONFIG.CARDIAC_SURVIVAL_PER_MIN).toFixed(1);
  document.getElementById('impact-txt').textContent =
    `+${survBoost}% cardiac survival improvement (${saved.toFixed(1)}s saved)`;
}

function setBadge(text, cls) {
  const el = document.getElementById('top-badge');
  el.textContent = text;
  el.className = cls || 'badge-idle';
}

function setSysDot(state, text) {
  document.getElementById('sys-dot').className = 'sys-dot ' + state;
  document.getElementById('sys-text').textContent = text;
}

function addLog(msg, cls) {
  const t = new Date().toLocaleTimeString('en', { hour12: false });
  logLines.unshift({ t, msg, cls });
  if (logLines.length > 50) logLines.pop();
  document.getElementById('event-log').innerHTML =
    logLines.map(l =>
      `<div class="le ${l.cls}"><span class="le-t">${l.t}</span><span class="le-m">${l.msg}</span></div>`
    ).join('');
}

function clearLog() {
  logLines = [];
  document.getElementById('event-log').innerHTML = '';
}

function tickClock() {
  document.getElementById('hdr-time').textContent =
    new Date().toLocaleTimeString('en', { hour12: false });
}

// ─── Edge node picker ────────────────────────────────
function pickEdgeNodes(n, exclude = []) {
  const G = CONFIG.GRID, out = [];
  const all = [];
  for (let c = 0; c <= G; c++) { all.push([0,c]); all.push([G,c]); }
  for (let r = 1; r < G; r++) { all.push([r,0]); all.push([r,G]); }
  const excStr = exclude.map(e => e.join(','));
  const pool = all.filter(e => !excStr.includes(e.join(',')));
  for (let i = 0; i < n; i++) out.push(pool[Math.floor(Math.random() * pool.length)]);
  return out;
}
