# backend/app.py
# SwiftAid — Flask server
# Serves the frontend and exposes REST API for routing, simulation, and metrics.
#
# Run:  python app.py
# URL:  http://localhost:5000

import os
import sys
import json

# Make sure backend/ packages resolve correctly
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, render_template, jsonify, request
from coordination.coordinator import SimulationCoordinator
from utils.constants import CONFIG, HOSPITALS, SCENARIOS

app = Flask(
    __name__,
    template_folder=os.path.join('..', 'frontend', 'templates'),
    static_folder   =os.path.join('..', 'frontend', 'static'),
    static_url_path ='/static',
)

# ── Single shared coordinator (demo session) ───────────────────────
coord = SimulationCoordinator()


# ═══════════════════════════════════════════════════════════════════
# FRONTEND
# ═══════════════════════════════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html')


# ═══════════════════════════════════════════════════════════════════
# CITY / STATIC DATA
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/city')
def api_city():
    """Return city topology + hospital data from JSON file."""
    path = os.path.join(os.path.dirname(__file__), '..', 'data', 'sample_city.json')
    with open(path) as f:
        return jsonify(json.load(f))


@app.route('/api/hospitals')
def api_hospitals():
    """Return list of hospitals with GPS coordinates."""
    return jsonify(HOSPITALS)


@app.route('/api/config')
def api_config():
    """Expose CONFIG so frontend can read thresholds/speeds if needed."""
    return jsonify(CONFIG)


# ═══════════════════════════════════════════════════════════════════
# DISPATCH
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/dispatch', methods=['POST'])
def api_dispatch():
    """
    Dispatch one or more ambulances.

    POST body (JSON):
      {
        "units":     1,          // number of ambulances (1–3)
        "priority":  "P1",       // P1 | P2 | P3
        "algorithm": "astar",    // dijkstra | astar | congestion
        "starts":    [[0,1]],    // optional [[r,c], ...]
        "ends":      [[6,5]]     // optional [[r,c], ...]
      }

    Returns: list of dispatched ambulance records + route + time estimates
    """
    body      = request.get_json(force=True)
    units     = int(body.get('units',     1))
    priority  = body.get('priority',  'P1')
    algo      = body.get('algorithm', 'astar')
    starts    = body.get('starts',    None)
    ends      = body.get('ends',      None)

    result = coord.dispatch(units, priority, algo, starts, ends)
    return jsonify({'status': 'dispatched', 'ambulances': result})


# ═══════════════════════════════════════════════════════════════════
# SIMULATION TICK
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/tick', methods=['POST'])
def api_tick():
    """
    Advance the simulation by one step.
    Returns full state snapshot: ambulances, signals, congestion, metrics.
    Called repeatedly by the frontend loop (or for backend-only testing).
    """
    snapshot = coord.tick()
    return jsonify(snapshot)


@app.route('/api/state')
def api_state():
    """Return current simulation state without advancing a tick."""
    return jsonify(coord._snapshot())


# ═══════════════════════════════════════════════════════════════════
# ROUTING (standalone — no dispatch needed)
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/route', methods=['POST'])
def api_route():
    """
    Compute a route between two grid nodes.

    POST body:
      { "sr": 0, "sc": 1, "er": 6, "ec": 5, "algorithm": "astar" }

    Returns: path, normal_time, ai_time, saved, nodes
    """
    from routing.router import compute_route, estimate_normal_time, estimate_ai_time

    body = request.get_json(force=True)
    sr, sc = int(body['sr']), int(body['sc'])
    er, ec = int(body['er']), int(body['ec'])
    algo   = body.get('algorithm', 'astar')

    path   = compute_route(coord.grid, sr, sc, er, ec, algo)
    norm_t = estimate_normal_time(path, coord.grid)
    ai_t   = estimate_ai_time(path, coord.grid)

    return jsonify({
        'path':        [{'r': r, 'c': c} for r, c in path],
        'normal_time': norm_t,
        'ai_time':     ai_t,
        'saved':       round(max(0, norm_t - ai_t), 2),
        'nodes':       len(path),
        'algorithm':   algo,
    })


# ═══════════════════════════════════════════════════════════════════
# SIGNALS
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/signals')
def api_signals():
    """Current state of all traffic signals."""
    return jsonify(coord.signals.snapshot())


# ═══════════════════════════════════════════════════════════════════
# CONGESTION
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/congestion')
def api_congestion():
    """List of congested edges above threshold."""
    return jsonify(coord.grid.get_congested_edges())


# ═══════════════════════════════════════════════════════════════════
# SCENARIOS
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/scenario/<name>')
def api_scenario(name):
    """Load a named scenario preset (peak, night, multi, conflict)."""
    result = coord.load_scenario(name)
    return jsonify(result), (404 if 'error' in result else 200)


# ═══════════════════════════════════════════════════════════════════
# METRICS
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/metrics')
def api_metrics():
    """Session metrics: time saved, signals cleared, survival impact."""
    return jsonify(coord.metrics.summary())


# ═══════════════════════════════════════════════════════════════════
# RESET
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/reset', methods=['POST'])
def api_reset():
    """Reset entire simulation state."""
    coord.reset()
    return jsonify({'status': 'reset'})


# ═══════════════════════════════════════════════════════════════════
# RUN
# ═══════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print()
    print('  SwiftAid — Emergency Traffic Response System')
    print('  Google Solution Challenge 2026')
    print('  http://localhost:5000')
    print()
    app.run(debug=True, port=5000, use_reloader=False)
