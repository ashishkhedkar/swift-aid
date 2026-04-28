# backend/coordination/coordinator.py
# SwiftAid — Multi-ambulance coordinator
#
# Ties together: CityGrid + SignalManager + DecisionEngine + Ambulances
# This is the single Python object that runs the whole simulation.
# Flask app.py calls coordinator.tick() on each API request.

import random
from simulation.ambulance     import Ambulance
from simulation.city_grid     import CityGrid
from simulation.signals       import SignalManager
from simulation.traffic       import TrafficSimulator
from routing.router           import compute_route, estimate_normal_time, estimate_ai_time
from intelligence.decision_engine import DecisionEngine
from metrics.tracker          import MetricsTracker
from utils.constants          import CONFIG, SCENARIOS


class SimulationCoordinator:
    """
    Master coordinator for the SwiftAid simulation.
    One instance lives in Flask's app context (single-session demo).
    """

    def __init__(self):
        self.grid       = CityGrid(CONFIG['GRID'], CONFIG['CELL'])
        self.signals    = SignalManager(CONFIG['GRID'])
        self.traffic    = TrafficSimulator(CONFIG['GRID'], num_vehicles=16)
        self.engine     = DecisionEngine(self.signals, self.grid)
        self.metrics    = MetricsTracker()
        self.ambulances: list[Ambulance] = []
        self.tick_count = 0
        self.running    = False

    # ── Dispatch ────────────────────────────────────────────────────
    def dispatch(self, units: int, priority: str, algo: str,
                 starts: list = None, ends: list = None) -> list[dict]:
        """
        Spawn `units` ambulances and compute their routes.
        starts / ends are optional [(r,c)] lists; random edge nodes if None.
        Returns list of ambulance dicts for the frontend.
        """
        self.signals.reset()
        self.ambulances = []
        self.running    = True
        Ambulance._id_counter = 0   # reset IDs each dispatch

        if not starts: starts = self._random_edge_nodes(units)
        if not ends:   ends   = self._random_edge_nodes(units, exclude=starts)

        results = []
        for i in range(units):
            sr, sc = starts[i]
            er, ec = ends[i]
            path   = compute_route(self.grid, sr, sc, er, ec, algo)

            amb = Ambulance((sr, sc), (er, ec), priority)
            amb.set_path(path)
            self.ambulances.append(amb)

            norm_t = estimate_normal_time(path, self.grid)
            ai_t   = estimate_ai_time(path, self.grid)
            self.metrics.record_dispatch(amb.id, norm_t, ai_t)

            results.append({
                **amb.to_dict(),
                'path':        [{'r': r, 'c': c} for r, c in path],
                'normal_time': norm_t,
                'ai_time':     ai_t,
                'saved':       round(max(0, norm_t - ai_t), 2),
                'algorithm':   algo,
            })

        return results

    # ── Tick ─────────────────────────────────────────────────────────
    def tick(self) -> dict:
        """
        Advance simulation by one step.
        Called by the /api/tick endpoint (or manually from tests).
        Returns current state snapshot for the frontend.
        """
        if not self.running:
            return self._snapshot()

        self.tick_count += 1
        self.grid.tick()          # dynamic congestion update
        self.signals.tick()       # signal state machine

        # Background traffic
        amb_positions = [(a.r, a.c) for a in self.ambulances]
        self.traffic.tick(self.signals.snapshot(), amb_positions)

        # AI decisions
        action = self.engine.update(self.ambulances)
        if action and 'reroute' in action:
            amb = action['reroute']
            new_path = compute_route(self.grid, amb.r, amb.c,
                                     amb.dest_node[0], amb.dest_node[1], 'congestion')
            if len(new_path) > 1:
                old_sigs = amb.sigs_overridden
                amb.reroute(new_path)
                self.metrics.record_reroute(amb.id)

        # Advance each ambulance
        for amb in self.ambulances:
            node = amb.advance()
            if node:
                self.signals.release(node[0], node[1], amb.id)
            if amb.state == 'arrived' and not self.metrics.is_completed(amb.id):
                self.metrics.record_arrival(amb.id, amb)

        # Check if all done
        if all(a.state == 'arrived' for a in self.ambulances):
            self.running = False

        return self._snapshot()

    # ── Scenario ─────────────────────────────────────────────────────
    def load_scenario(self, name: str) -> dict:
        sc = SCENARIOS.get(name)
        if not sc:
            return {'error': 'Unknown scenario'}
        self.grid.regenerate(sc['congestion_multiplier'])
        if sc.get('signal_chaos'):
            self.signals.chaos()
        else:
            self.signals.reset()
        self.ambulances = []
        self.running    = False
        return {'status': 'ok', 'scenario': sc}

    # ── Reset ─────────────────────────────────────────────────────────
    def reset(self):
        self.grid       = CityGrid(CONFIG['GRID'], CONFIG['CELL'])
        self.signals    = SignalManager(CONFIG['GRID'])
        self.traffic    = TrafficSimulator(CONFIG['GRID'])
        self.engine     = DecisionEngine(self.signals, self.grid)
        self.metrics    = MetricsTracker()
        self.ambulances = []
        self.tick_count = 0
        self.running    = False

    # ── Snapshot ──────────────────────────────────────────────────────
    def _snapshot(self) -> dict:
        return {
            'tick':       self.tick_count,
            'running':    self.running,
            'ambulances': [a.to_dict() for a in self.ambulances],
            'signals':    self.signals.snapshot(),
            'congestion': self.grid.get_congested_edges(),
            'metrics':    self.metrics.summary(),
        }

    # ── Helpers ───────────────────────────────────────────────────────
    def _random_edge_nodes(self, n: int, exclude: list = None) -> list:
        G, out, seen = CONFIG['GRID'], [], set()
        if exclude:
            seen = {tuple(e) for e in exclude}
        pool = (
            [(0, c) for c in range(G + 1)] +
            [(G, c) for c in range(G + 1)] +
            [(r, 0) for r in range(1, G)] +
            [(r, G) for r in range(1, G)]
        )
        pool = [p for p in pool if tuple(p) not in seen]
        for _ in range(n):
            out.append(random.choice(pool))
        return out
