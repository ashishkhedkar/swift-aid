# backend/simulation/traffic.py
# SwiftAid — Background traffic simulation
#
# Simulates normal vehicles that:
#   - Move around the grid randomly
#   - Stop at red signals
#   - Pull over when an ambulance is nearby (within 1.5 nodes)
#
# This module is optional for the demo — it adds realism to congestion
# numbers and gives the metrics tracker something to measure delay against.

import random
from dataclasses import dataclass, field


@dataclass
class Vehicle:
    id:        int
    r:         float
    c:         float
    dest_r:    int
    dest_c:    int
    speed:     float = 0.6
    stopped:   bool  = False
    stop_reason: str = ''   # 'signal' | 'ambulance' | ''


class TrafficSimulator:
    """
    Lightweight background traffic.
    Not shown on canvas individually — contributes to edge congestion levels.
    """

    def __init__(self, grid_size: int = 6, num_vehicles: int = 18):
        self.G        = grid_size
        self.vehicles: list[Vehicle] = []
        self.tick_count = 0
        self._spawn(num_vehicles)

    def _spawn(self, n: int):
        for i in range(n):
            self.vehicles.append(Vehicle(
                id     = i,
                r      = random.uniform(0, self.G),
                c      = random.uniform(0, self.G),
                dest_r = random.randint(0, self.G),
                dest_c = random.randint(0, self.G),
                speed  = 0.4 + random.random() * 0.5,
            ))

    def tick(self, signal_states: dict, ambulance_positions: list[tuple]):
        """
        Advance traffic by one tick.
        signal_states: { 'r,c': {'state': 'red'|'green'|..., ...} }
        ambulance_positions: [(r, c), ...]
        """
        self.tick_count += 1
        for v in self.vehicles:

            # 1. Pull over if ambulance is close
            near = any(
                abs(v.r - ar) + abs(v.c - ac) < 1.5
                for ar, ac in ambulance_positions
            )
            if near:
                v.stopped     = True
                v.stop_reason = 'ambulance'
                continue

            # 2. Stop at red signal at nearest intersection
            nr = round(v.r); nc = round(v.c)
            sig = signal_states.get(f'{nr},{nc}', {})
            if sig.get('state') == 'red':
                v.stopped     = True
                v.stop_reason = 'signal'
                continue

            # 3. Move toward destination
            v.stopped     = False
            v.stop_reason = ''
            dr = v.dest_r - v.r
            dc = v.dest_c - v.c
            dist = (dr**2 + dc**2) ** 0.5
            if dist < 0.15:
                # Pick new random destination
                v.dest_r = random.randint(0, self.G)
                v.dest_c = random.randint(0, self.G)
            else:
                v.r += (dr / dist) * v.speed * 0.08
                v.c += (dc / dist) * v.speed * 0.08

    def density_near(self, r: int, c: int, radius: float = 1.0) -> int:
        """Count vehicles near a node — used as a congestion proxy."""
        return sum(
            1 for v in self.vehicles
            if abs(v.r - r) <= radius and abs(v.c - c) <= radius
        )

    def stopped_count(self) -> int:
        return sum(1 for v in self.vehicles if v.stopped)
