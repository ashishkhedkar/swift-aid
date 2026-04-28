// routing/astar.js — A* with Manhattan heuristic

function astar(grid, sr, sc, er, ec) {
  const G = grid.G;
  const h = (r, c) => Math.abs(r - er) + Math.abs(c - ec);

  const gScore = {};
  const fScore = {};
  const prev = {};

  for (let r = 0; r <= G; r++)
    for (let c = 0; c <= G; c++) {
      gScore[`${r},${c}`] = Infinity;
      fScore[`${r},${c}`] = Infinity;
    }

  gScore[`${sr},${sc}`] = 0;
  fScore[`${sr},${sc}`] = h(sr, sc);

  const open = new Set([`${sr},${sc}`]);
  const closed = new Set();

  while (open.size > 0) {
    // Pick node in open with lowest fScore
    let cur = null;
    let best = Infinity;
    for (const k of open) {
      if (fScore[k] < best) { best = fScore[k]; cur = k; }
    }

    const [r, c] = cur.split(',').map(Number);
    if (r === er && c === ec) break;

    open.delete(cur);
    closed.add(cur);

    for (const [nr, nc] of grid.neighbours(r, c)) {
      const nk = `${nr},${nc}`;
      if (closed.has(nk)) continue;
      const tentG = gScore[cur] + grid.getWeight(r, c, nr, nc);
      if (tentG < gScore[nk]) {
        prev[nk] = cur;
        gScore[nk] = tentG;
        fScore[nk] = tentG + h(nr, nc);
        open.add(nk);
      }
    }
  }

  // Reconstruct
  const pts = [];
  let cur = `${er},${ec}`;
  while (prev[cur]) {
    const [r, c] = cur.split(',').map(Number);
    pts.unshift({ r, c });
    cur = prev[cur];
  }
  pts.unshift({ r: sr, c: sc });
  return pts;
}
