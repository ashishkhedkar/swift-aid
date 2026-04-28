// simulation/ambulance.js — Ambulance movement and state

let _ambIdCounter = 0;

class Ambulance {
  constructor(startR, startC, endR, endC, priority, ox, oy) {
    this.id = ++_ambIdCounter;
    this.priority = { P1: 1, P2: 2, P3: 3 }[priority] || 1;
    this.priorityLabel = priority || 'P1';
    this.color = PRIORITY_COLORS[priority] || '#E24B4A';

    this.r = startR; this.c = startC;
    this.destR = endR; this.destC = endC;

    const startPos = { x: ox + startC * CONFIG.CELL, y: oy + startR * CONFIG.CELL };
    this.x = startPos.x;
    this.y = startPos.y;

    this.path = [];
    this.pathIdx = 0;
    this.speed = CONFIG[`AMB_SPEED_${priority}`] || CONFIG.AMB_SPEED_BASE;

    this.state = 'idle'; // idle | moving | waiting | arrived
    this.waiting = false;
    this.waitTimer = 0;

    this.sigsOverridden = 0;
    this.distanceTravelled = 0;
    this.startTime = Date.now();
    this.arrivalTime = null;

    this.trail = []; // last N positions for trail effect
    this.sirenPhase = 0; // for siren light animation

    this.ox = ox; this.oy = oy;
  }

  setPath(path) {
    this.path = path;
    this.pathIdx = 0;
    this.state = 'moving';
  }

  // Returns {nodeEntered, nodeLeft} for signal logic
  tick(dt, grid) {
    this.sirenPhase += 0.12;
    if (this.waiting) {
      this.waitTimer -= 1;
      if (this.waitTimer <= 0) this.waiting = false;
      return { nodeEntered: null, nodeLeft: null };
    }
    if (this.state !== 'moving' || this.pathIdx >= this.path.length - 1) {
      if (this.pathIdx >= this.path.length - 1 && this.state === 'moving') {
        this.state = 'arrived';
        this.arrivalTime = Date.now();
      }
      return { nodeEntered: null, nodeLeft: null };
    }

    const target = this.path[this.pathIdx + 1];
    const tp = { x: this.ox + target.c * CONFIG.CELL, y: this.oy + target.r * CONFIG.CELL };
    const dx = tp.x - this.x, dy = tp.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = this.speed * dt;

    // Store trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 12) this.trail.shift();

    let nodeEntered = null, nodeLeft = null;

    if (dist <= step + 0.5) {
      const prevNode = this.path[this.pathIdx];
      this.x = tp.x; this.y = tp.y;
      this.r = target.r; this.c = target.c;
      nodeLeft = prevNode;
      this.pathIdx++;
      nodeEntered = target;
      this.distanceTravelled += dist;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }

    return { nodeEntered, nodeLeft };
  }

  get remainingHops() {
    return Math.max(0, this.path.length - 1 - this.pathIdx);
  }

  get elapsedSeconds() {
    const end = this.arrivalTime || Date.now();
    return (end - this.startTime) / 1000;
  }

  get currentSpeed() {
    return this.waiting ? 0 : Math.round(this.speed * 18); // approx km/h display
  }
}
