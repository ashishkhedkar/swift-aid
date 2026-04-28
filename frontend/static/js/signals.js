// simulation/signals.js — Traffic signal logic and override system

class SignalManager {
  constructor(gridSize) {
    this.G = gridSize;
    this.signals = {};
    this.overrideCount = 0;
    this.init();
  }

  init() {
    for (let r = 1; r < this.G; r++) {
      for (let c = 1; c < this.G; c++) {
        this.signals[`${r},${c}`] = {
          state: Math.random() < 0.5 ? 'green' : 'red',
          timer: Math.floor(Math.random() * CONFIG.SIGNAL_CYCLE),
          override: false,
          recovering: false,
          recoverTimer: 0,
          overriddenBy: null, // ambulance id
        };
      }
    }
    this.overrideCount = 0;
  }

  reset() { this.init(); }

  key(r, c) { return `${r},${c}`; }

  get(r, c) { return this.signals[this.key(r, c)]; }

  // Called every tick — advances timers and cycles normal signals
  tick(aiEnabled) {
    for (const k in this.signals) {
      const s = this.signals[k];
      if (s.override) continue;

      if (s.recovering) {
        s.recoverTimer--;
        if (s.recoverTimer <= 0) {
          s.recovering = false;
          s.state = Math.random() < 0.5 ? 'green' : 'red';
          s.timer = CONFIG.SIGNAL_CYCLE;
        }
        continue;
      }

      s.timer--;
      if (s.timer <= 0) {
        s.state = s.state === 'green' ? 'red' : 'green';
        s.timer = CONFIG.SIGNAL_CYCLE + Math.floor(Math.random() * 30);
      }
    }
  }

  // Pre-empt a signal (turn green for ambulance)
  preempt(r, c, ambId) {
    const s = this.get(r, c);
    if (!s) return false;
    if (s.override && s.overriddenBy === ambId) return false; // already done
    s.override = true;
    s.state = 'green';
    s.overriddenBy = ambId;
    this.overrideCount++;
    return true;
  }

  // Release a signal after ambulance passes
  release(r, c, ambId) {
    const s = this.get(r, c);
    if (!s || !s.override || s.overriddenBy !== ambId) return;
    s.override = false;
    s.recovering = true;
    s.state = 'amber';
    s.recoverTimer = CONFIG.SIGNAL_RECOVER;
    s.overriddenBy = null;
  }

  // Resolve conflict: two ambulances at same intersection
  resolveConflict(r, c, ambA, ambB) {
    // Higher priority wins; tie-break by id
    const winner = ambA.priority <= ambB.priority ? ambA : ambB;
    const loser  = winner === ambA ? ambB : ambA;
    this.preempt(r, c, winner.id);
    // Loser must wait — signal it red briefly
    loser.waiting = true;
    loser.waitTimer = 30;
    return winner;
  }

  getColor(r, c) {
    const s = this.get(r, c);
    if (!s) return null;
    if (s.state === 'green') return '#7adf3a';
    if (s.state === 'amber') return '#EF9F27';
    return '#E24B4A';
  }

  // Inject chaos (scramble some signals)
  chaos() {
    for (const k in this.signals) {
      if (Math.random() < 0.4) {
        this.signals[k].state = Math.random() < 0.5 ? 'green' : 'red';
        this.signals[k].timer = Math.floor(Math.random() * 30);
      }
    }
  }
}
