# backend/metrics/tracker.py
# SwiftAid — Metrics tracker
#
# Tracks all demo-relevant numbers in one place:
#   - Time saved per unit
#   - Signals cleared
#   - Stops avoided
#   - Reroutes triggered
#   - Cardiac survival impact estimate
#
# Keep it simple and clear — these numbers go directly onto the UI.

from utils.constants import CONFIG


class MetricsTracker:
    """
    Collects performance data across the session.
    Each dispatch reuses the same tracker (cumulative session stats).
    """

    def __init__(self):
        self._dispatches: dict = {}   # amb_id → dispatch record
        self._completed:  set  = set()
        self.total_saved        = 0.0
        self.total_sigs_cleared = 0
        self.total_stops_avoided = 0
        self.total_reroutes     = 0
        self.missions_completed = 0

    # ── Record events ────────────────────────────────────────────────
    def record_dispatch(self, amb_id: int, normal_time: float, ai_time: float):
        self._dispatches[amb_id] = {
            'normal_time': normal_time,
            'ai_time':     ai_time,
            'saved':       round(max(0, normal_time - ai_time), 2),
        }

    def record_arrival(self, amb_id: int, amb):
        """Call when an ambulance reaches its destination."""
        if amb_id in self._completed:
            return
        self._completed.add(amb_id)
        d = self._dispatches.get(amb_id, {})
        saved = d.get('saved', 0.0)

        self.total_saved          += saved
        self.total_sigs_cleared   += amb.sigs_overridden
        self.missions_completed   += 1

    def record_reroute(self, amb_id: int):
        self.total_reroutes += 1

    def is_completed(self, amb_id: int) -> bool:
        return amb_id in self._completed

    # ── Summary ──────────────────────────────────────────────────────
    def summary(self) -> dict:
        """
        Returns the numbers shown on the right panel of the UI.
        All values are ready to display — no further formatting needed.
        """
        avg = (
            round(self.total_saved / self.missions_completed, 1)
            if self.missions_completed > 0 else 0.0
        )
        # Clinical impact: each minute saved → +10% cardiac survival
        survival_boost = round((self.total_saved / 60) * CONFIG['CARDIAC_SURVIVAL_PER_MIN'], 1)

        return {
            'missions_completed':  self.missions_completed,
            'total_saved_sec':     round(self.total_saved, 1),
            'total_sigs_cleared':  self.total_sigs_cleared,
            'total_reroutes':      self.total_reroutes,
            'avg_saved_per_run':   avg,
            'cardiac_boost_pct':   survival_boost,
        }

    def reset(self):
        self.__init__()
