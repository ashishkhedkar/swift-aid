// routing/router.js — Route selection logic

function computeRoute(grid, sr, sc, er, ec, mode) {
  switch (mode) {
    case 'astar':
      return astar(grid, sr, sc, er, ec);
    case 'congestion': {
      // Congestion-aware: temporarily inflate congested edges then run A*
      const backup = {};
      for (const k in grid.edgeWeights) {
        backup[k] = grid.edgeWeights[k];
        if (grid.congestionMap[k] > CONFIG.CONGESTION_THRESHOLD) {
          grid.edgeWeights[k] *= 3; // penalise heavily
        }
      }
      const path = astar(grid, sr, sc, er, ec);
      Object.assign(grid.edgeWeights, backup); // restore
      return path;
    }
    case 'dijkstra':
    default:
      return dijkstra(grid, sr, sc, er, ec);
  }
}

// Estimate travel time without AI (normal signal delays included)
function estimateNormalTime(path, grid) {
  let base = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const { r: r1, c: c1 } = path[i];
    const { r: r2, c: c2 } = path[i + 1];
    const w = grid.getWeight(r1, c1, r2, c2);
    base += w;
    // Each signal adds ~2.5s of average wait
    if (r2 >= 1 && r2 < grid.G && c2 >= 1 && c2 < grid.G) {
      base += 2.5;
    }
  }
  return base * 1.4; // scale to approximate seconds
}

// Estimate travel time with AI (no signal delays, route already optimised)
function estimateAITime(path, grid) {
  let base = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const { r: r1, c: c1 } = path[i];
    const { r: r2, c: c2 } = path[i + 1];
    base += 1; // all signals cleared = weight 1
  }
  return base * 0.9;
}
