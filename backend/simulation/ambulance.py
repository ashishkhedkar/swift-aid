# backend/simulation/ambulance.py
# SwiftAid — Ambulance entity (Python-side, used by coordinator + metrics)
#
# The JS frontend has its own Ambulance class for canvas animation.
# This Python class is the authoritative state used by Flask API endpoints,
# the coordinator, and the metrics tracker.

import time
from utils.constants import CONFIG, PRIORITY_LEVEL


class Ambulance:
    """
    Represents one ambulance unit in the simulation.
    Tracks position, path progress, state, and performance metrics.
    """

    _id_counter = 0

    def __init__(self, start: tuple, dest: tuple, priority: str = 'P1'):
        Ambulance._id_counter += 1
        self.id             = Ambulance._id_counter
        self.priority_label = priority
        self.priority       = PRIORITY_LEVEL.get(priority, 1)   # 1 = highest
        self.speed          = CONFIG.get(f'AMB_SPEED_{priority}', CONFIG['AMB_SPEED_P2'])

        self.start_node = start   # (r, c)
        self.dest_node  = dest    # (r, c)
        self.r, self.c  = start

        self.path:     list  = []   # list of (r, c) tuples
        self.path_idx: int   = 0

        self.state   = 'idle'    # idle | moving | waiting | arrived
        self.waiting = False
        self.wait_timer = 0

        # Metrics
        self.sigs_overridden = 0
        self.stops_avoided   = 0
        self.reroutes        = 0
        self.start_time      = None
        self.arrival_time    = None

    def set_path(self, path: list):
        self.path      = path
        self.path_idx  = 0
        self.state     = 'moving'
        self.start_time = time.time()

    def advance(self):
        """Move one step along path. Returns node entered or None."""
        if self.state != 'moving':
            return None
        if self.waiting:
            self.wait_timer -= 1
            if self.wait_timer <= 0:
                self.waiting = False
            return None
        if self.path_idx >= len(self.path) - 1:
            self.state        = 'arrived'
            self.arrival_time = time.time()
            return None

        self.path_idx += 1
        self.r, self.c = self.path[self.path_idx]
        return (self.r, self.c)

    def reroute(self, new_path: list):
        """Replace remaining path with a new one (dynamic reroute)."""
        self.path     = new_path
        self.path_idx = 0
        self.reroutes += 1

    @property
    def remaining_hops(self) -> int:
        return max(0, len(self.path) - 1 - self.path_idx)

    @property
    def elapsed_seconds(self) -> float:
        if not self.start_time:
            return 0.0
        end = self.arrival_time or time.time()
        return round(end - self.start_time, 2)

    def to_dict(self) -> dict:
        """Serialise for API / frontend."""
        return {
            'id':             self.id,
            'priority':       self.priority_label,
            'state':          self.state,
            'r':              self.r,
            'c':              self.c,
            'path_idx':       self.path_idx,
            'remaining_hops': self.remaining_hops,
            'elapsed':        self.elapsed_seconds,
            'sigs_overridden':self.sigs_overridden,
            'reroutes':       self.reroutes,
        }
