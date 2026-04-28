// simulation/city_grid.js — Road network, intersections, congestion model

class CityGrid {
  constructor(gridSize, cellSize) {
    this.G = gridSize;
    this.CELL = cellSize;
    this.edgeWeights = {};
    this.congestionMap = {};
    this.buildGrid();
  }

  buildGrid() {
    const G = this.G;
    for (let r = 0; r <= G; r++) {
      for (let c = 0; c <= G; c++) {
        if (c < G) this._initEdge(r, c, r, c + 1);
        if (r < G) this._initEdge(r, c, r + 1, c);
      }
    }
  }

  _initEdge(r1, c1, r2, c2) {
    const k = this.edgeKey(r1, c1, r2, c2);
    // Base weight 1. Congestion adds 0..4 extra
    const congestion = Math.random() < 0.28 ? 1 + Math.random() * 3.5 : 0;
    this.edgeWeights[k] = 1 + congestion;
    this.congestionMap[k] = congestion;
  }

  edgeKey(r1, c1, r2, c2) {
    return `${Math.min(r1,r2)},${Math.min(c1,c2)}-${Math.max(r1,r2)},${Math.max(c1,c2)}`;
  }

  getWeight(r1, c1, r2, c2) {
    return this.edgeWeights[this.edgeKey(r1, c1, r2, c2)] || 1;
  }

  getCongestion(r1, c1, r2, c2) {
    return this.congestionMap[this.edgeKey(r1, c1, r2, c2)] || 0;
  }

  nodePos(r, c, ox, oy) {
    return { x: ox + c * this.CELL, y: oy + r * this.CELL };
  }

  neighbours(r, c) {
    const G = this.G;
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    return dirs
      .map(([dr, dc]) => [r + dr, c + dc])
      .filter(([nr, nc]) => nr >= 0 && nr <= G && nc >= 0 && nc <= G);
  }

  // Apply time-of-day multiplier to all edge weights
  applyTOD(hour) {
    const mult = TOD_MULTIPLIERS[hour] || 1;
    for (const k in this.congestionMap) {
      const base = this.congestionMap[k];
      this.edgeWeights[k] = 1 + base * mult;
    }
  }

  // Apply scenario congestion
  applyScenario(multiplier) {
    for (const k in this.congestionMap) {
      const base = this.congestionMap[k];
      this.edgeWeights[k] = 1 + base * multiplier;
    }
  }

  // Regenerate with new random congestion
  regenerate(multiplier = 1) {
    this.buildGrid();
    if (multiplier !== 1) this.applyScenario(multiplier);
  }

  // Returns array of {r,c,level} for all congested nodes
  getCongestedEdges(threshold = CONFIG.CONGESTION_THRESHOLD) {
    const results = [];
    for (const [k, w] of Object.entries(this.edgeWeights)) {
      if (w > threshold) {
        const [a, b] = k.split('-');
        const [r1, c1] = a.split(',').map(Number);
        const [r2, c2] = b.split(',').map(Number);
        results.push({ r1, c1, r2, c2, level: w });
      }
    }
    return results;
  }
}
