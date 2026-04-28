// static/js/renderer.js — Canvas rendering for grid simulation mode

let _canvas, _ctx, _W, _H, _ox, _oy;

function initRenderer() {
  _canvas = document.getElementById('grid-canvas');
  _ctx    = _canvas.getContext('2d');
  resizeCanvas();
}

function resizeCanvas() {
  const wrap = document.getElementById('center');
  _canvas.width  = wrap.clientWidth;
  _canvas.height = wrap.clientHeight;
  _W = _canvas.width; _H = _canvas.height;
  computeOffsets();
}

function computeOffsets() {
  const gs = CONFIG.GRID * CONFIG.CELL;
  _ox = (_W - gs) / 2;
  _oy = (_H - gs) / 2;
}

function getCanvasOffsets() { return { ox: _ox, oy: _oy }; }

// ── Build a Set of "route edges" from all active ambulances ─────────
function _buildRouteEdgeSet() {
  const set = new Set();
  for (const amb of ambulances) {
    if (!amb.path || amb.path.length < 2) continue;
    for (let i = 0; i < amb.path.length - 1; i++) {
      const a = amb.path[i], b = amb.path[i+1];
      // canonical key so both directions match
      const k = `${Math.min(a.r,b.r)},${Math.min(a.c,b.c)}-${Math.max(a.r,b.r)},${Math.max(a.c,b.c)}`;
      set.add(k);
    }
  }
  return set;
}

// ── Build set of nodes that are ON any active route ─────────────────
function _buildRouteNodeSet() {
  const set = new Set();
  for (const amb of ambulances) {
    if (!amb.path) continue;
    for (const pt of amb.path) set.add(`${pt.r},${pt.c}`);
  }
  return set;
}

function renderGrid() {
  _ctx.clearRect(0, 0, _W, _H);
  // Light background - matches page bg
  _ctx.fillStyle = '#e8eaf4';
  _ctx.fillRect(0, 0, _W, _H);

  const routeEdges = _buildRouteEdgeSet();
  const routeNodes = _buildRouteNodeSet();

  _drawBlocks();
  _drawRoads(routeEdges);          // pass set so route roads get highlighted
  _drawTrafficJams();              // solid jam overlays with label
  _drawRouteHighlight();           // thick coloured road overlay per ambulance
  for (const a of ambulances) _drawTrail(a);
  _drawSignals(routeNodes);        // signals on route are bigger + brighter
  for (const a of ambulances) _drawMarkers(a);
  for (const a of ambulances) _drawAmb(a);
}

// ── City blocks ─────────────────────────────────────────────────────
function _drawBlocks() {
  const G = CONFIG.GRID, C = CONFIG.CELL, rw = CONFIG.ROAD_WIDTH;
  _ctx.fillStyle = '#f0f2fa';  // light block fill
  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      const x = _ox + c*C + rw/2 + 2;
      const y = _oy + r*C + rw/2 + 2;
      const s = C - rw - 4;
      _rr(x, y, s, s, 3);
      _ctx.fill();
    }
  }
}

// ── Base roads — route edges get a subtle highlight ─────────────────
function _drawRoads(routeEdges) {
  const G = CONFIG.GRID;
  for (let r = 0; r <= G; r++)
    for (let c = 0; c <= G; c++) {
      if (c < G) _road(r,c,r,c+1, routeEdges);
      if (r < G) _road(r,c,r+1,c, routeEdges);
    }
}

function _road(r1,c1,r2,c2, routeEdges) {
  const p1 = _np(r1,c1), p2 = _np(r2,c2);
  const ek = `${Math.min(r1,r2)},${Math.min(c1,c2)}-${Math.max(r1,r2)},${Math.max(c1,c2)}`;
  const onRoute = routeEdges && routeEdges.has(ek);

  _ctx.save();
  // Road base — light grey tarmac
  _ctx.lineWidth   = CONFIG.ROAD_WIDTH;
  _ctx.strokeStyle = onRoute ? '#d0d4e8' : '#c8cce0';
  _ctx.lineCap     = 'square';
  _ctx.beginPath(); _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y); _ctx.stroke();
  // Centre dashes
  _ctx.lineWidth   = 0.7;
  _ctx.strokeStyle = 'rgba(100,110,160,0.18)';
  _ctx.setLineDash([5,8]);
  _ctx.beginPath(); _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y); _ctx.stroke();
  _ctx.setLineDash([]);
  _ctx.restore();
}

// ── Traffic jams — thick red overlay + "JAM" label ──────────────────
function _drawTrafficJams() {
  if (!grid) return;
  for (const { r1,c1,r2,c2,level } of grid.getCongestedEdges()) {
    const p1 = _np(r1,c1), p2 = _np(r2,c2);
    const alpha = Math.min(0.55, (level - CONFIG.CONGESTION_THRESHOLD) * 0.13);

    _ctx.save();
    // Red road fill
    _ctx.lineWidth   = CONFIG.ROAD_WIDTH - 4;
    _ctx.strokeStyle = `rgba(217,79,78,${alpha})`;
    _ctx.lineCap     = 'round';
    _ctx.beginPath(); _ctx.moveTo(p1.x,p1.y); _ctx.lineTo(p2.x,p2.y); _ctx.stroke();

    // "JAM" label at midpoint for heavy congestion
    if (level > CONFIG.CONGESTION_THRESHOLD + 1.5) {
      const mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2;
      _ctx.font         = 'bold 7px IBM Plex Mono, monospace';
      _ctx.textAlign    = 'center';
      _ctx.textBaseline = 'middle';
      // Dark pill background
      _ctx.fillStyle = 'rgba(12,10,26,0.82)';
      _rr(mx-10, my-5, 20, 10, 3); _ctx.fill();
      // Text
      _ctx.fillStyle = `rgba(217,79,78,${Math.min(1, alpha * 2.5)})`;
      _ctx.fillText('JAM', mx, my);
    }
    _ctx.restore();
  }
}

// ── Route highlight — thick coloured road overlay per ambulance ──────
// Drawn OVER base roads, UNDER signals and vehicle
function _drawRouteHighlight() {
  for (const amb of ambulances) {
    if (!amb.path || amb.path.length < 2) continue;
    const col = amb.color;

    // 1. Thick glowing road overlay along full path
    _ctx.save();
    _ctx.lineWidth   = CONFIG.ROAD_WIDTH - 2;
    _ctx.strokeStyle = col;
    _ctx.globalAlpha = 0.13;
    _ctx.lineCap     = 'round';
    _ctx.lineJoin    = 'round';
    _ctx.beginPath();
    amb.path.forEach((pt, i) => {
      const p = _np(pt.r, pt.c);
      i === 0 ? _ctx.moveTo(p.x,p.y) : _ctx.lineTo(p.x,p.y);
    });
    _ctx.stroke();
    _ctx.restore();

    // 2. Bright dashed centre line on top
    _ctx.save();
    _ctx.lineWidth   = 2.5;
    _ctx.strokeStyle = col;
    _ctx.globalAlpha = 0.7;
    _ctx.lineCap     = 'round';
    _ctx.lineJoin    = 'round';
    _ctx.setLineDash([10, 6]);
    _ctx.beginPath();
    amb.path.forEach((pt, i) => {
      const p = _np(pt.r, pt.c);
      i === 0 ? _ctx.moveTo(p.x,p.y) : _ctx.lineTo(p.x,p.y);
    });
    _ctx.stroke();
    _ctx.setLineDash([]);
    _ctx.restore();

    // 3. Already-travelled segment — slightly brighter
    if (amb.pathIdx > 0) {
      _ctx.save();
      _ctx.lineWidth   = 3;
      _ctx.strokeStyle = col;
      _ctx.globalAlpha = 0.35;
      _ctx.lineCap     = 'round';
      _ctx.lineJoin    = 'round';
      _ctx.beginPath();
      for (let i = 0; i <= amb.pathIdx && i < amb.path.length; i++) {
        const p = _np(amb.path[i].r, amb.path[i].c);
        i === 0 ? _ctx.moveTo(p.x,p.y) : _ctx.lineTo(p.x,p.y);
      }
      _ctx.stroke();
      _ctx.restore();
    }
  }
}

// ── Trails ──────────────────────────────────────────────────────────
function _drawTrail(amb) {
  if (amb.trail.length < 2) return;
  _ctx.save();
  amb.trail.forEach((pt, i) => {
    const alpha = (i / amb.trail.length) * 0.35;
    _ctx.beginPath();
    _ctx.arc(pt.x, pt.y, 3, 0, Math.PI*2);
    _ctx.fillStyle   = amb.color;
    _ctx.globalAlpha = alpha;
    _ctx.fill();
  });
  _ctx.globalAlpha = 1; _ctx.restore();
}

// ── Signals — larger + more visible on route ─────────────────────────
function _drawSignals(routeNodes) {
  if (!sigMan) return;
  for (let r = 1; r < CONFIG.GRID; r++) {
    for (let c = 1; c < CONFIG.GRID; c++) {
      const s   = sigMan.get(r,c);
      if (!s) continue;
      const p   = _np(r,c);
      const col = sigMan.getColor(r,c);
      const onRoute = routeNodes && routeNodes.has(`${r},${c}`);
      // Size: bigger if on an ambulance route
      const outerR = onRoute ? 10 : 7;
      const innerR = onRoute ? 5  : 3;

      _ctx.save();

      // Override glow
      if (s.override) {
        _ctx.beginPath(); _ctx.arc(p.x,p.y, onRoute ? 18 : 13, 0, Math.PI*2);
        _ctx.fillStyle = 'rgba(110,214,48,0.14)'; _ctx.fill();
        // Extra sharp ring for route signals
        if (onRoute) {
          _ctx.beginPath(); _ctx.arc(p.x,p.y,12,0,Math.PI*2);
          _ctx.strokeStyle = 'rgba(110,214,48,0.5)';
          _ctx.lineWidth   = 1;
          _ctx.stroke();
        }
      }

      // Dark base
      _ctx.beginPath(); _ctx.arc(p.x,p.y,outerR,0,Math.PI*2);
      _ctx.fillStyle = '#f0f2fa'; _ctx.fill();

      // Coloured ring
      _ctx.strokeStyle = col;
      _ctx.lineWidth   = onRoute ? 2 : 1.4;
      _ctx.stroke();

      // Inner fill dot
      _ctx.beginPath(); _ctx.arc(p.x,p.y,innerR,0,Math.PI*2);
      _ctx.fillStyle   = col;
      _ctx.globalAlpha = s.override ? 1 : (onRoute ? 0.9 : 0.55);
      _ctx.fill();
      _ctx.globalAlpha = 1;

      // On-route signals: show state label (G / R / A)
      if (onRoute) {
        const label = s.override ? 'CLR' : (s.state === 'green' ? 'GO' : s.state === 'amber' ? 'AMB' : 'STP');
        _ctx.font         = 'bold 6px IBM Plex Mono, monospace';
        _ctx.textAlign    = 'center';
        _ctx.textBaseline = 'top';
        _ctx.fillStyle    = col;
        _ctx.globalAlpha  = 0.9;
        _ctx.fillText(label, p.x, p.y + outerR + 2);
        _ctx.globalAlpha  = 1;
      }

      _ctx.restore();
    }
  }
}

// ── Source / destination markers ────────────────────────────────────
function _drawMarkers(amb) {
  if (!amb.path.length) return;
  const src   = _np(amb.path[0].r, amb.path[0].c);
  const dst   = _np(amb.path[amb.path.length-1].r, amb.path[amb.path.length-1].c);
  const pulse = 0.55 + 0.45 * Math.sin(tick * 0.055);

  _ctx.save();
  // Origin ring
  _ctx.strokeStyle = amb.color;
  _ctx.lineWidth   = 1.5;
  _ctx.setLineDash([3,3]);
  _ctx.beginPath(); _ctx.arc(src.x,src.y,11,0,Math.PI*2); _ctx.stroke();
  _ctx.setLineDash([]);
  // Origin label
  _ctx.font         = 'bold 7px IBM Plex Mono, monospace';
  _ctx.textAlign    = 'center';
  _ctx.textBaseline = 'bottom';
  _ctx.fillStyle    = amb.color;
  _ctx.fillText(`#${amb.id}`, src.x, src.y - 12);

  // Destination — pulsing cross
  _ctx.globalAlpha = pulse;
  _ctx.beginPath(); _ctx.arc(dst.x,dst.y,13,0,Math.PI*2);
  _ctx.fillStyle   = 'rgba(217,79,78,0.1)'; _ctx.fill();
  _ctx.strokeStyle = '#d94f4e'; _ctx.lineWidth = 1.5; _ctx.stroke();
  _ctx.strokeStyle = '#d94f4e'; _ctx.lineWidth = 2.5;
  _ctx.beginPath();
  _ctx.moveTo(dst.x-6,dst.y); _ctx.lineTo(dst.x+6,dst.y);
  _ctx.moveTo(dst.x,dst.y-6); _ctx.lineTo(dst.x,dst.y+6);
  _ctx.stroke();
  // Destination label
  _ctx.font         = 'bold 7px IBM Plex Mono, monospace';
  _ctx.textAlign    = 'center';
  _ctx.textBaseline = 'bottom';
  _ctx.fillStyle    = '#d94f4e';
  _ctx.fillText(`DEST #${amb.id}`, dst.x, dst.y - 15);
  _ctx.globalAlpha = 1; _ctx.restore();
}

// ── Ambulance vehicle ────────────────────────────────────────────────
function _drawAmb(amb) {
  const { x, y, sirenPhase, waiting, color } = amb;
  const siren = Math.sin(sirenPhase * 3) > 0;
  _ctx.save();

  // Outer glow
  const grd = _ctx.createRadialGradient(x,y,0,x,y,24);
  grd.addColorStop(0, color + '55'); grd.addColorStop(1, color + '00');
  _ctx.beginPath(); _ctx.arc(x,y,24,0,Math.PI*2); _ctx.fillStyle=grd; _ctx.fill();

  // Siren strobe
  if (!waiting) {
    _ctx.beginPath(); _ctx.arc(x,y,17,0,Math.PI*2);
    _ctx.fillStyle = siren ? 'rgba(90,168,245,0.16)' : 'rgba(217,79,78,0.16)';
    _ctx.fill();
  }

  // Body
  _ctx.fillStyle = waiting ? '#b0b8d0' : '#ffffff';
  _rr(x-12, y-8, 24, 16, 3); _ctx.fill();

  // Priority stripe
  _ctx.fillStyle = color;
  _rr(x-12, y-2, 24, 6, 2); _ctx.fill();

  // Cross
  _ctx.fillStyle = '#d94f4e';
  _ctx.fillRect(x-1.5, y-7, 3, 14);
  _ctx.fillRect(x-6,   y-1.5, 12, 3);

  // Unit label below vehicle
  _ctx.fillStyle    = '#444466';
  _ctx.font         = 'bold 7px IBM Plex Mono, monospace';
  _ctx.textAlign    = 'center';
  _ctx.textBaseline = 'top';
  _ctx.fillText(`#${amb.id}`, x, y + 10);

  _ctx.restore();
}

// ── Helpers ──────────────────────────────────────────────────────────
function _np(r, c) {
  return { x: _ox + c * CONFIG.CELL, y: _oy + r * CONFIG.CELL };
}
function _rr(x, y, w, h, r) {
  _ctx.beginPath();
  _ctx.moveTo(x+r,y); _ctx.lineTo(x+w-r,y); _ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  _ctx.lineTo(x+w,y+h-r); _ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  _ctx.lineTo(x+r,y+h); _ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  _ctx.lineTo(x,y+r); _ctx.quadraticCurveTo(x,y,x+r,y); _ctx.closePath();
}
