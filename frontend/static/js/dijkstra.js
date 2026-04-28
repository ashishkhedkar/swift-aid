// routing/dijkstra.js — Shortest path via Dijkstra

function dijkstra(grid, sr, sc, er, ec) {
  const G = grid.G;
  const dist = {};
  const prev = {};

  for (let r = 0; r <= G; r++)
    for (let c = 0; c <= G; c++)
      dist[`${r},${c}`] = Infinity;

  dist[`${sr},${sc}`] = 0;
  const pq = [{ r: sr, c: sc, d: 0 }];

  while (pq.length) {
    pq.sort((a, b) => a.d - b.d);
    const { r, c, d } = pq.shift();
    if (r === er && c === ec) break;
    if (d > dist[`${r},${c}`]) continue;

    for (const [nr, nc] of grid.neighbours(r, c)) {
      const w = grid.getWeight(r, c, nr, nc);
      const nd = d + w;
      if (nd < dist[`${nr},${nc}`]) {
        dist[`${nr},${nc}`] = nd;
        prev[`${nr},${nc}`] = `${r},${c}`;
        pq.push({ r: nr, c: nc, d: nd });
      }
    }
  }

  return _reconstructPath(prev, sr, sc, er, ec);
}

function _reconstructPath(prev, sr, sc, er, ec) {
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
