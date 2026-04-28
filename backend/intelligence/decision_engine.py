# backend/intelligence/decision_engine.py
# SwiftAid — AI decision engine
#
# Responsibilities:
#   1. Signal pre-emption  — clear N intersections ahead for each ambulance
#   2. Conflict resolution — when two units head for the same node,
#                            higher priority wins, lower waits briefly
#   3. Predictive reroute  — if upcoming congestion exceeds threshold,
#                            flag the ambulance for rerouting
#
# No ML here — pure rule-based logic that is easy to explain to judges.

from utils.constants import CONFIG


class DecisionEngine:
    """
    Central AI coordinator called every simulation tick.
    Works with SignalManager and CityGrid to make decisions.
    """

    def __init__(self, signal_manager, grid):
        self.signals            = signal_manager
        self.grid               = grid
        self.conflicts_resolved = 0

    def update(self, ambulances: list) -> dict | None:
        """
        Main update method — call once per tick.

        Returns:
            {'reroute': <Ambulance>}  if a unit needs rerouting
            None                      otherwise
        """
        # Step 1: pre-empt signals for each moving ambulance
        for amb in ambulances:
            if amb.state == 'moving':
                self._preempt_ahead(amb)

        # Step 2: resolve conflicts between units
        if len(ambulances) > 1:
            self._resolve_conflicts(ambulances)

        # Step 3: check if any unit needs rerouting due to congestion
        for amb in ambulances:
            if amb.state == 'moving' and self._should_reroute(amb):
                return {'reroute': amb}

        return None

    # ── Signal pre-emption ───────────────────────────────────────────
    def _preempt_ahead(self, amb):
        """
        Pre-clear the next PREEMPT_LOOKAHEAD intersections.
        Skips edge nodes (row 0, row G, col 0, col G) — those have no signals.
        """
        lookahead = CONFIG['PREEMPT_LOOKAHEAD']
        for look in range(1, lookahead + 1):
            ni = amb.path_idx + look
            if ni >= len(amb.path):
                break
            r, c = amb.path[ni]
            if 1 <= r < self.grid.G and 1 <= c < self.grid.G:
                new_override = self.signals.preempt(r, c, amb.id)
                if new_override:
                    amb.sigs_overridden += 1

    # ── Conflict resolution ──────────────────────────────────────────
    def _resolve_conflicts(self, ambulances: list):
        """
        Compare every pair of ambulances.
        If their upcoming paths overlap, higher priority unit gets signal
        clearance; lower priority unit waits briefly.
        Simple pairwise check — fine for ≤3 units.
        """
        ahead = CONFIG['PREEMPT_LOOKAHEAD'] + 1
        for i in range(len(ambulances)):
            for j in range(i + 1, len(ambulances)):
                a = ambulances[i]
                b = ambulances[j]
                if a.state != 'moving' or b.state != 'moving':
                    continue

                # Upcoming nodes for each unit
                a_ahead = set(tuple(a.path[k]) for k in range(a.path_idx, min(a.path_idx + ahead, len(a.path))))
                b_ahead = set(tuple(b.path[k]) for k in range(b.path_idx, min(b.path_idx + ahead, len(b.path))))

                if a_ahead & b_ahead:   # paths overlap
                    winner = a if a.priority <= b.priority else b
                    loser  = b if winner is a else a
                    # Give winner's next intersection green
                    if winner.path_idx < len(winner.path):
                        r, c = winner.path[winner.path_idx]
                        self.signals.preempt(r, c, winner.id)
                    # Loser waits
                    loser.waiting    = True
                    loser.wait_timer = 30
                    self.conflicts_resolved += 1

    # ── Predictive reroute check ─────────────────────────────────────
    def _should_reroute(self, amb) -> bool:
        """
        Look ahead 3 edges. If average congestion exceeds REROUTE_THRESHOLD,
        signal that this ambulance needs a new path.
        This simulates lightweight prediction without any ML model.
        """
        avg = self.grid.average_congestion_ahead(amb.path, amb.path_idx, horizon=3)
        return avg > CONFIG['REROUTE_THRESHOLD']
