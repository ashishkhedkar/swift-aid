# backend/simulation/signals.py
# SwiftAid — Traffic signal management
#
# Signal states (in order):
#   RED  →  PREPARE  →  GREEN  →  (ambulance passes)  →  RECOVERY  →  RED/GREEN
#
# PREPARE is the small delay before a signal goes green after being pre-empted.
# RECOVERY is the amber cooldown after ambulance clears the intersection.
# This makes the demo look more realistic than instant flips.

import random
from utils.constants import CONFIG


# All possible signal states
STATES = ['red', 'prepare', 'green', 'amber', 'recovery']


class SignalManager:
    """
    Manages all traffic signals on the grid.
    Signals cycle normally unless overridden by the AI for an ambulance.
    """

    def __init__(self, grid_size: int):
        self.G = grid_size
        self.signals:       dict = {}
        self.override_count: int = 0
        self.stops_avoided:  int = 0   # metric: how many red signals were bypassed
        self.reset()

    def reset(self):
        """Reinitialise all signals to random red/green states."""
        self.signals        = {}
        self.override_count = 0
        self.stops_avoided  = 0
        for r in range(1, self.G):
            for c in range(1, self.G):
                self.signals[f'{r},{c}'] = {
                    'state':         'green' if random.random() < 0.5 else 'red',
                    'timer':         random.randint(0, CONFIG['SIGNAL_CYCLE']),
                    'override':      False,
                    'prepare_timer': 0,      # countdown for PREPARE phase
                    'recover_timer': 0,      # countdown for RECOVERY phase
                    'overridden_by': None,   # ambulance id that owns this override
                }

    # ── Per-tick update ──────────────────────────────────────────────
    def tick(self):
        """
        Advance all signals by one tick.
        Overridden signals are skipped — the AI owns them.
        """
        for s in self.signals.values():

            # AI-controlled: handle PREPARE phase
            if s['override']:
                if s['state'] == 'prepare':
                    s['prepare_timer'] -= 1
                    if s['prepare_timer'] <= 0:
                        s['state'] = 'green'   # finally go green
                continue

            # Recovery phase after ambulance passed
            if s['state'] == 'recovery':
                s['recover_timer'] -= 1
                if s['recover_timer'] <= 0:
                    s['state'] = 'green' if random.random() < 0.5 else 'red'
                    s['timer']  = CONFIG['SIGNAL_CYCLE'] + random.randint(0, 20)
                continue

            # Normal cycle: red ↔ green
            s['timer'] -= 1
            if s['timer'] <= 0:
                s['state'] = 'red' if s['state'] == 'green' else 'green'
                s['timer']  = CONFIG['SIGNAL_CYCLE'] + random.randint(0, 30)

    # ── Pre-emption (AI override) ────────────────────────────────────
    def preempt(self, r: int, c: int, amb_id: int) -> bool:
        """
        Pre-empt a signal for an ambulance.
        Goes through PREPARE state first (small delay) then GREEN.
        Returns True if this is a new override.
        """
        k = f'{r},{c}'
        s = self.signals.get(k)
        if not s:
            return False
        if s['override'] and s['overridden_by'] == amb_id:
            return False   # already handling this one

        was_red = (s['state'] == 'red')

        s['override']      = True
        s['overridden_by'] = amb_id
        self.override_count += 1

        # If currently red: go through PREPARE phase first
        if was_red:
            s['state']         = 'prepare'
            s['prepare_timer'] = CONFIG['SIGNAL_PREPARE_TICKS']
            if s.get('state') == 'red':
                self.stops_avoided += 1   # would have stopped here
        else:
            s['state'] = 'green'   # already green, keep it

        return True

    # ── Release (ambulance passed) ───────────────────────────────────
    def release(self, r: int, c: int, amb_id: int):
        """
        Release signal after ambulance clears the intersection.
        Signal enters RECOVERY (amber) phase before resuming normal cycle.
        """
        k = f'{r},{c}'
        s = self.signals.get(k)
        if not s or not s['override'] or s['overridden_by'] != amb_id:
            return
        s['override']      = False
        s['overridden_by'] = None
        s['state']         = 'recovery'
        s['recover_timer'] = CONFIG['SIGNAL_RECOVER']

    # ── Scenario chaos ───────────────────────────────────────────────
    def chaos(self):
        """Randomise signal timers — used by peak/conflict scenarios."""
        for s in self.signals.values():
            if random.random() < 0.45:
                s['state'] = 'red'   # bias toward red for harder demo
                s['timer']  = random.randint(3, 25)

    # ── Queries ──────────────────────────────────────────────────────
    def get_color(self, r: int, c: int) -> str:
        s = self.signals.get(f'{r},{c}')
        if not s: return '#888'
        return {
            'green':    '#1a9e4a',
            'red':      '#d63b3b',
            'prepare':  '#f59e0b',  # yellow — about to go green
            'recovery': '#e8981f',  # amber  — cooling down
        }.get(s['state'], '#888')

    def snapshot(self) -> dict:
        """Return signal states for API response."""
        return {
            k: {'state': s['state'], 'override': s['override']}
            for k, s in self.signals.items()
        }
