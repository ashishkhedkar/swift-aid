// utils/constants.js — Config values for the simulation

const CONFIG = {
  GRID: 6,
  CELL: 88,
  ROAD_WIDTH: 20,
  AMB_SPEED_BASE: 3.0,
  AMB_SPEED_P1: 3.8,
  AMB_SPEED_P2: 3.0,
  AMB_SPEED_P3: 2.2,
  SIGNAL_CYCLE: 80,       // ticks before a signal changes
  SIGNAL_RECOVER: 45,     // ticks before recovering signal normalises
  PREEMPT_LOOKAHEAD: 2,   // nodes ahead to pre-clear
  CONGESTION_THRESHOLD: 2.5,
  // Simulated real-world impact (per-second basis)
  CARDIAC_SURVIVAL_PER_MIN: 10, // % survival increase per minute saved
};

// Time-of-day congestion multipliers (hour → multiplier)
const TOD_MULTIPLIERS = {
  0: 0.3, 1: 0.2, 2: 0.2, 3: 0.2, 4: 0.3, 5: 0.5,
  6: 0.9, 7: 1.5, 8: 2.0, 9: 1.8, 10: 1.4, 11: 1.3,
  12: 1.5, 13: 1.4, 14: 1.2, 15: 1.3, 16: 1.8, 17: 2.2,
  18: 2.0, 19: 1.6, 20: 1.2, 21: 0.9, 22: 0.6, 23: 0.4
};

// Priority colors
const PRIORITY_COLORS = {
  P1: '#E24B4A',
  P2: '#EF9F27',
  P3: '#378ADD'
};

// Scenario presets
const SCENARIOS = {
  peak: {
    name: 'Peak Hour',
    congestionMultiplier: 2.2,
    signalChaos: true,
    units: 1,
    priority: 'P1',
    description: 'Max congestion, critical case'
  },
  night: {
    name: 'Night Run',
    congestionMultiplier: 0.3,
    signalChaos: false,
    units: 1,
    priority: 'P3',
    description: 'Low traffic, fast corridor'
  },
  multi: {
    name: 'Multi-Unit',
    congestionMultiplier: 1.4,
    signalChaos: false,
    units: 3,
    priority: 'P2',
    description: 'Coordinated multi-ambulance dispatch'
  },
  conflict: {
    name: 'Conflict Zone',
    congestionMultiplier: 1.8,
    signalChaos: true,
    units: 2,
    priority: 'P1',
    description: 'Two units on crossing paths — AI resolves conflicts'
  }
};
