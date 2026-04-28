// intelligence/decision_engine.js — Signal priority + conflict resolution logic

class DecisionEngine {
  constructor(signalManager, grid) {
    this.signals = signalManager;
    this.grid = grid;
    this.conflictsResolved = 0;
  }

  // Main per-tick update for a list of ambulances
  update(ambulances) {
    const preemptEnabled = document.getElementById('tog-preempt')?.checked ?? true;
    const rerouteEnabled = document.getElementById('tog-reroute')?.checked ?? true;
    const conflictEnabled = document.getElementById('tog-conflict')?.checked ?? true;

    for (const amb of ambulances) {
      if (amb.state !== 'moving') continue;

      // 1. Signal pre-emption: clear next PREEMPT_LOOKAHEAD signals
      if (preemptEnabled) {
        for (let look = 1; look <= CONFIG.PREEMPT_LOOKAHEAD; look++) {
          const idx = amb.pathIdx + look;
          if (idx >= amb.path.length) break;
          const { r, c } = amb.path[idx];
          if (r >= 1 && r < this.grid.G && c >= 1 && c < this.grid.G) {
            if (this.signals.preempt(r, c, amb.id)) {
              amb.sigsOverridden++;
            }
          }
        }
      }
    }

    // 2. Conflict detection: check if two ambs heading to same intersection
    if (conflictEnabled && ambulances.length > 1) {
      for (let i = 0; i < ambulances.length; i++) {
        for (let j = i + 1; j < ambulances.length; j++) {
          const a = ambulances[i], b = ambulances[j];
          if (a.state !== 'moving' || b.state !== 'moving') continue;
          if (this._pathsConflict(a, b)) {
            this.conflictsResolved++;
            this.signals.resolveConflict(a.r, a.c, a, b);
          }
        }
      }
    }

    // 3. Dynamic reroute: check if current path became heavily congested
    if (rerouteEnabled) {
      for (const amb of ambulances) {
        if (amb.state !== 'moving') continue;
        if (this._shouldReroute(amb)) {
          return { reroute: amb }; // caller handles rerouting
        }
      }
    }

    return null;
  }

  _pathsConflict(a, b) {
    const ahead = CONFIG.PREEMPT_LOOKAHEAD + 1;
    const aNodes = a.path.slice(a.pathIdx, a.pathIdx + ahead).map(n => `${n.r},${n.c}`);
    const bNodes = b.path.slice(b.pathIdx, b.pathIdx + ahead).map(n => `${n.r},${n.c}`);
    return aNodes.some(n => bNodes.includes(n));
  }

  _shouldReroute(amb) {
    // Check next 3 nodes — if avg congestion > threshold, reroute
    const horizon = 3;
    let total = 0, count = 0;
    for (let i = amb.pathIdx; i < Math.min(amb.pathIdx + horizon, amb.path.length - 1); i++) {
      const { r: r1, c: c1 } = amb.path[i];
      const { r: r2, c: c2 } = amb.path[i + 1];
      total += this.grid.getCongestion(r1, c1, r2, c2);
      count++;
    }
    return count > 0 && (total / count) > CONFIG.CONGESTION_THRESHOLD * 1.5;
  }
}
