# SwiftAid — Emergency Traffic Response System
### Google Solution Challenge 2026 · Hack2Skill

> AI-driven signal pre-emption and dynamic routing to reduce ambulance response time in Indian cities.

#### 📄 Project Report

[View Report](https://drive.google.com/file/d/1xqg2MUbilBjn68oBpy_wTIv-QbVc-ewQ/view?usp=drive_link)
---


## The Problem

Urban ambulances in India lose **8–15 minutes per trip** waiting at traffic signals.  
In cardiac arrest, every minute of delay reduces survival odds by ~10%.  
SwiftAid demonstrates how AI-assisted signal control can halve that delay.

---

## Project Structure

```
swiftaid/
│
├── frontend/
│   ├── templates/
│   │   └── index.html              # Main UI (served by Flask)
│   └── static/
│       ├── css/
│       │   └── main.css            # Dark tactical design system
│       └── js/
│           ├── constants.js        # Shared config + scenario presets
│           ├── city_grid.js        # Road network + congestion model
│           ├── signals.js          # Signal lifecycle (cycle/override/recover)
│           ├── ambulance.js        # Ambulance entity + movement
│           ├── dijkstra.js         # Dijkstra shortest-path
│           ├── astar.js            # A* with Manhattan heuristic
│           ├── router.js           # Route selection + time estimation
│           ├── decision_engine.js  # AI: pre-emption + conflict resolution
│           ├── gis_layer.js        # Leaflet GIS map — real Pune GPS data
│           ├── renderer.js         # Canvas renderer for grid mode
│           └── app.js              # Main controller + simulation loop
│
├── backend/
│   ├── app.py                      # Flask server + REST API
│   ├── simulation/
│   │   ├── city_grid.py            # Road network (Python mirror)
│   │   └── signals.py              # Signal management (Python mirror)
│   ├── routing/
│   │   └── router.py               # Dijkstra + A* + congestion-aware
│   ├── intelligence/
│   │   └── decision_engine.py      # AI logic (Python mirror)
│   └── utils/
│       └── constants.py            # Config, hospitals, scenarios
│
├── data/
│   └── sample_city.json            # Pune grid topology + hospital GPS
├── results/
│   └── logs.csv                    # (auto-generated session logs)
├── requirements.txt
└── README.md
```

---

## Run — Two Ways

### Option 1: Direct (no install)
```bash
open frontend/templates/index.html
# or: python3 -m http.server 8080  then  http://localhost:8080/frontend/templates/
```

### Option 2: Flask backend (full API)
```bash
pip install -r requirements.txt
cd backend
python app.py
# Visit http://localhost:5000
```

---

## Features

| Feature | Detail |
|---|---|
| **Dual map mode** | Toggle between live Leaflet/OSM GIS map and abstract grid sim |
| **Real Pune GPS** | 5 hospital markers with actual coordinates, 4 congestion zones |
| **Dijkstra + A*** | Both algorithms selectable; congestion-aware variant available |
| **Signal pre-emption** | Clears 2 intersections ahead in real time, amber recovery after |
| **Multi-unit dispatch** | Up to 3 units with priority-based conflict resolution |
| **4 scenario presets** | Peak Hour / Night / Multi-Unit / Conflict Zone |
| **Before/After panel** | Live comparison with clinical survival impact stat |
| **Flask REST API** | `/api/route`, `/api/signals`, `/api/congestion`, `/api/scenario` |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET  | `/api/city`          | City topology + hospitals |
| GET  | `/api/hospitals`     | Hospital GPS list |
| POST | `/api/route`         | Compute route `{sr,sc,er,ec,algorithm}` |
| GET  | `/api/signals`       | Current signal states snapshot |
| GET  | `/api/congestion`    | Congested edge list |
| POST | `/api/reset`         | Reset simulation state |

---

## SDG Alignment

- **SDG 3** — Good Health and Well-Being
- **SDG 11** — Sustainable Cities and Communities

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend UI | HTML5, CSS3, Vanilla JS |
| GIS / Map | Leaflet.js + OpenStreetMap |
| Canvas Sim | HTML5 Canvas |
| Routing | Dijkstra + A* (JS + Python) |
| Backend API | Python / Flask |
| Fonts | IBM Plex Mono, Inter |

---

*SwiftAid — Google Solution Challenge 2026*
