# backend/simulation/city_grid.py
# SwiftAid — Road network, intersections, and dynamic congestion model
#
# Key idea: congestion is NOT static. It changes every N ticks based on
# time-of-day weights + small random drift. This makes each demo run feel
# different and lets the reroute logic actually trigger mid-run.

import random
from datetime import datetime
from utils.constants import CONFIG, TOD_MULTIPLIERS


class CityGrid:
    """
    Represents the city road network as a grid graph.
    Nodes = intersections, edges = road segments with congestion weights.
    """

    def __init__(self, grid_size: int, cell_size: int):
        self.G    = grid_size
        self.CELL = cell_size
        self.edge_weights:   dict[str, float] = {}  # current traversal cost
        self.congestion_map: dict[str, float] = {}  # base congestion 0..4
        self.tick_count = 0
        self._build()

    # ── Build grid ──────────────────────────────────────────────────
    def _build(self):
        """Initialise all edges with random base congestion."""
        for r in range(self.G + 1):
            for c in range(self.G + 1):
                if c < self.G: self._init_edge(r, c, r, c + 1)
                if r < self.G: self._init_edge(r, c, r + 1, c)

    def _init_edge(self, r1, c1, r2, c2):
        k    = self.edge_key(r1, c1, r2, c2)
        # ~28% of edges start with meaningful congestion
        cong = (1.0 + random.random() * 3.5) if random.random() < 0.28 else 0.0
        self.edge_weights[k]   = 1.0 + cong
        self.congestion_map[k] = cong

    # ── Dynamic congestion tick ──────────────────────────────────────
    def tick(self):
        """
        Called every simulation tick.
        Every CONGESTION_UPDATE_TICKS ticks, nudge weights slightly
        so congestion feels live during a demo.
        """
        self.tick_count += 1
        if self.tick_count % CONFIG['CONGESTION_UPDATE_TICKS'] != 0:
            return

        hour = datetime.now().hour
        tod  = TOD_MULTIPLIERS.get(hour, 1.0)

        for k in self.congestion_map:
            base = self.congestion_map[k]
            # Small random drift ±0.3 so routes change over time
            drift = random.uniform(-0.3, 0.3)
            new_base = max(0.0, min(4.5, base + drift))
            self.congestion_map[k] = new_base
            self.edge_weights[k]   = 1.0 + new_base * tod

    # ── Key helpers ─────────────────────────────────────────────────
    @staticmethod
    def edge_key(r1, c1, r2, c2) -> str:
        return f"{min(r1,r2)},{min(c1,c2)}-{max(r1,r2)},{max(c1,c2)}"

    def get_weight(self, r1, c1, r2, c2) -> float:
        return self.edge_weights.get(self.edge_key(r1, c1, r2, c2), 1.0)

    def get_congestion(self, r1, c1, r2, c2) -> float:
        return self.congestion_map.get(self.edge_key(r1, c1, r2, c2), 0.0)

    def neighbours(self, r, c) -> list:
        return [
            (r + dr, c + dc)
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]
            if 0 <= r + dr <= self.G and 0 <= c + dc <= self.G
        ]

    # ── Scenario / TOD application ───────────────────────────────────
    def apply_tod(self, hour: int):
        """Apply time-of-day multiplier to all edges."""
        mult = TOD_MULTIPLIERS.get(hour, 1.0)
        for k, base in self.congestion_map.items():
            self.edge_weights[k] = 1.0 + base * mult

    def regenerate(self, multiplier: float = 1.0):
        """Rebuild grid with a scenario congestion multiplier."""
        self._build()
        if multiplier != 1.0:
            for k in self.congestion_map:
                self.edge_weights[k] = 1.0 + self.congestion_map[k] * multiplier

    # ── Query helpers ────────────────────────────────────────────────
    def get_congested_edges(self, threshold: float = None) -> list:
        """Return all edges whose weight exceeds threshold — used by renderer."""
        t = threshold if threshold is not None else CONFIG['CONGESTION_THRESHOLD']
        result = []
        for k, w in self.edge_weights.items():
            if w > t:
                a, b   = k.split('-')
                r1, c1 = map(int, a.split(','))
                r2, c2 = map(int, b.split(','))
                result.append({'r1': r1, 'c1': c1, 'r2': r2, 'c2': c2, 'level': round(w, 2)})
        return result

    def average_congestion_ahead(self, path: list, idx: int, horizon: int = 3) -> float:
        """Average congestion on the next `horizon` edges from current position."""
        total, count = 0.0, 0
        for i in range(idx, min(idx + horizon, len(path) - 1)):
            r1, c1 = path[i]
            r2, c2 = path[i + 1]
            total += self.get_congestion(r1, c1, r2, c2)
            count += 1
        return (total / count) if count > 0 else 0.0
