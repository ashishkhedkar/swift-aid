# backend/routing/router.py
# SwiftAid — Routing algorithms: Dijkstra, A*, Congestion-Aware A*
#
# All three are available and selectable from the UI.
# Congestion-aware mode penalises heavy edges so the path avoids jams.

import heapq
from utils.constants import CONFIG


# ── Dijkstra ──────────────────────────────────────────────────────────
def dijkstra(grid, sr, sc, er, ec) -> list:
    """
    Classic Dijkstra shortest-path.
    Explores nodes in order of cumulative edge weight.
    Good for correctness; slightly slower than A* on large grids.
    """
    G    = grid.G
    dist = {(r, c): float('inf') for r in range(G + 1) for c in range(G + 1)}
    prev = {}
    dist[(sr, sc)] = 0
    pq = [(0, sr, sc)]

    while pq:
        d, r, c = heapq.heappop(pq)
        if (r, c) == (er, ec):
            break
        if d > dist[(r, c)]:
            continue
        for nr, nc in grid.neighbours(r, c):
            nd = d + grid.get_weight(r, c, nr, nc)
            if nd < dist[(nr, nc)]:
                dist[(nr, nc)] = nd
                prev[(nr, nc)] = (r, c)
                heapq.heappush(pq, (nd, nr, nc))

    return _reconstruct(prev, sr, sc, er, ec)


# ── A* ────────────────────────────────────────────────────────────────
def astar(grid, sr, sc, er, ec) -> list:
    """
    A* with Manhattan distance heuristic.
    Faster than Dijkstra because it biases toward the destination.
    Heuristic: |r - er| + |c - ec|  (admissible on a grid)
    """
    def h(r, c):
        return abs(r - er) + abs(c - ec)

    G  = grid.G
    g  = {(r, c): float('inf') for r in range(G + 1) for c in range(G + 1)}
    g[(sr, sc)] = 0
    prev  = {}
    open_ = [(h(sr, sc), sr, sc)]

    while open_:
        f, r, c = heapq.heappop(open_)
        if (r, c) == (er, ec):
            break
        if g[(r, c)] + h(r, c) < f:
            continue   # stale entry
        for nr, nc in grid.neighbours(r, c):
            ng = g[(r, c)] + grid.get_weight(r, c, nr, nc)
            if ng < g[(nr, nc)]:
                g[(nr, nc)]    = ng
                prev[(nr, nc)] = (r, c)
                heapq.heappush(open_, (ng + h(nr, nc), nr, nc))

    return _reconstruct(prev, sr, sc, er, ec)


# ── Congestion-aware A* ───────────────────────────────────────────────
def congestion_astar(grid, sr, sc, er, ec) -> list:
    """
    A* with a congestion penalty.
    Edges above the congestion threshold are multiplied by 3x —
    so the path naturally avoids traffic jams even if the detour is longer.
    Weights are restored after pathfinding so the grid is not mutated.
    """
    # Save original weights
    backup = dict(grid.edge_weights)

    # Penalise congested edges
    for k in grid.edge_weights:
        if grid.congestion_map.get(k, 0) > CONFIG['CONGESTION_THRESHOLD']:
            grid.edge_weights[k] *= 3.0

    path = astar(grid, sr, sc, er, ec)

    # Restore
    grid.edge_weights = backup
    return path


# ── Router entry point ────────────────────────────────────────────────
def compute_route(grid, sr, sc, er, ec, mode: str = 'astar') -> list:
    """Select algorithm based on UI choice and run it."""
    if mode == 'dijkstra':
        return dijkstra(grid, sr, sc, er, ec)
    elif mode == 'congestion':
        return congestion_astar(grid, sr, sc, er, ec)
    else:
        return astar(grid, sr, sc, er, ec)   # default


# ── Time estimates ────────────────────────────────────────────────────
def estimate_normal_time(path: list, grid) -> float:
    """
    Simulated travel time WITHOUT AI.
    Includes average red-signal wait at each interior intersection.
    """
    t = 0.0
    for i in range(len(path) - 1):
        r1, c1 = path[i]
        r2, c2 = path[i + 1]
        t += grid.get_weight(r1, c1, r2, c2)
        # Each interior intersection adds ~2.5s average red wait
        if 1 <= r2 < grid.G and 1 <= c2 < grid.G:
            t += 2.5
    return round(t * 1.4, 2)   # scale to approximate seconds


def estimate_ai_time(path: list, grid) -> float:
    """
    Simulated travel time WITH AI pre-emption.
    Signals are pre-cleared so no waiting — just edge traversal.
    """
    return round(len(path) * 0.88, 2)


# ── Path reconstruction ───────────────────────────────────────────────
def _reconstruct(prev: dict, sr, sc, er, ec) -> list:
    pts, cur = [], (er, ec)
    while cur in prev:
        pts.append(cur)
        cur = prev[cur]
    pts.append((sr, sc))
    pts.reverse()
    return pts
