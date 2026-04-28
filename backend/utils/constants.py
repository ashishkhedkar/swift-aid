# backend/utils/constants.py
# SwiftAid — all configuration in one place

CONFIG = {
    'GRID':                     6,
    'CELL':                     88,
    'ROAD_WIDTH':               20,
    'AMB_SPEED_P1':             3.8,
    'AMB_SPEED_P2':             3.0,
    'AMB_SPEED_P3':             2.2,
    'SIGNAL_CYCLE':             80,
    'SIGNAL_PREPARE_TICKS':     8,     # RED → PREPARE delay before going GREEN
    'SIGNAL_RECOVER':           45,
    'PREEMPT_LOOKAHEAD':        2,
    'CONGESTION_THRESHOLD':     2.5,
    'REROUTE_THRESHOLD':        3.8,   # triggers dynamic reroute
    'CONGESTION_UPDATE_TICKS':  120,   # ticks between dynamic congestion updates
    'CARDIAC_SURVIVAL_PER_MIN': 10,
}

TOD_MULTIPLIERS = {
    0: 0.3,  1: 0.2,  2: 0.2,  3: 0.2,  4: 0.3,  5: 0.5,
    6: 0.9,  7: 1.5,  8: 2.0,  9: 1.8, 10: 1.4, 11: 1.3,
   12: 1.5, 13: 1.4, 14: 1.2, 15: 1.3, 16: 1.8, 17: 2.2,
   18: 2.0, 19: 1.6, 20: 1.2, 21: 0.9, 22: 0.6, 23: 0.4,
}

PRIORITY_LEVEL  = { 'P1': 1, 'P2': 2, 'P3': 3 }
PRIORITY_COLORS = { 'P1': '#d63b3b', 'P2': '#d97706', 'P3': '#2563cc' }

HOSPITALS = [
    {'id': 'H1', 'name': 'Ruby Hall Clinic',         'lat': 18.5314, 'lng': 73.8808, 'beds': 450},
    {'id': 'H2', 'name': 'KEM Hospital',              'lat': 18.5293, 'lng': 73.8719, 'beds': 800},
    {'id': 'H3', 'name': 'Jehangir Hospital',         'lat': 18.5204, 'lng': 73.8810, 'beds': 350},
    {'id': 'H4', 'name': 'Sassoon General Hospital',  'lat': 18.5182, 'lng': 73.8715, 'beds': 1400},
    {'id': 'H5', 'name': 'Deenanath Mangeshkar',      'lat': 18.5079, 'lng': 73.8217, 'beds': 600},
]

SCENARIOS = {
    'peak':    {'name': 'Peak Hour',    'congestion_multiplier': 2.2, 'signal_chaos': True,  'units': 1, 'priority': 'P1', 'description': 'Max congestion, critical dispatch'},
    'night':   {'name': 'Night Run',    'congestion_multiplier': 0.3, 'signal_chaos': False, 'units': 1, 'priority': 'P3', 'description': 'Low traffic, fast corridor'},
    'multi':   {'name': 'Multi-Unit',   'congestion_multiplier': 1.4, 'signal_chaos': False, 'units': 3, 'priority': 'P2', 'description': 'Coordinated three-unit dispatch'},
    'conflict':{'name': 'Conflict Zone','congestion_multiplier': 1.8, 'signal_chaos': True,  'units': 2, 'priority': 'P1', 'description': 'Two units on crossing paths — AI resolves'},
}
