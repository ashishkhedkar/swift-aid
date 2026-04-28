// static/js/gis_layer.js
// Real GIS map using Leaflet + OpenStreetMap, centred on Pune, MH

const PUNE_CENTER = [18.5204, 73.8567];
const PUNE_ZOOM   = 14;

// Real Pune hospital coordinates (GPS)
const HOSPITALS = [
  { id: 'H1', name: 'Ruby Hall Clinic',      lat: 18.5314, lng: 73.8808, beds: 450 },
  { id: 'H2', name: 'KEM Hospital',           lat: 18.5293, lng: 73.8719, beds: 800 },
  { id: 'H3', name: 'Jehangir Hospital',       lat: 18.5204, lng: 73.8810, beds: 350 },
  { id: 'H4', name: 'Sassoon General Hospital',lat: 18.5182, lng: 73.8715, beds: 1400 },
  { id: 'H5', name: 'Deenanath Mangeshkar',    lat: 18.5079, lng: 73.8217, beds: 600 },
];

// Approximate high-congestion zones in Pune (polygon bounds)
const CONGESTION_ZONES = [
  { name: 'FC Road',     bounds: [[18.528, 73.839], [18.532, 73.846]] },
  { name: 'JM Road',     bounds: [[18.521, 73.840], [18.526, 73.848]] },
  { name: 'Swargate',    bounds: [[18.500, 73.858], [18.506, 73.866]] },
  { name: 'Shivajinagar',bounds: [[18.528, 73.843], [18.534, 73.852]] },
];

let gisMap = null;
let routeLayer    = null;
let heatLayer     = null;
let hospLayer     = null;
let ambMarkers    = {};
let layerVisible  = { heat: true, hosp: true, route: true };

function initGISMap() {
  if (gisMap) return;

  gisMap = L.map('gis-map', {
    center: PUNE_CENTER,
    zoom: PUNE_ZOOM,
    zoomControl: false,
    attributionControl: false,
  });

  // OSM tile layer (dark-filtered via CSS)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(gisMap);

  // Custom zoom (bottom-right)
  L.control.zoom({ position: 'bottomright' }).addTo(gisMap);

  // Attribution (minimal)
  L.control.attribution({ position: 'bottomright', prefix: '' })
    .addAttribution('OSM contributors').addTo(gisMap);

  // Hospital markers
  hospLayer = L.layerGroup();
  HOSPITALS.forEach(h => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:10px;height:10px;background:#d94f4e;border-radius:50%;
        border:2px solid rgba(217,79,78,.5);
        box-shadow:0 0 8px rgba(217,79,78,.7);
      "></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });
    const m = L.marker([h.lat, h.lng], { icon })
      .bindPopup(`<b>${h.name}</b><br>${h.beds} beds`);
    hospLayer.addLayer(m);
  });
  hospLayer.addTo(gisMap);

  // Congestion rectangles
  heatLayer = L.layerGroup();
  CONGESTION_ZONES.forEach(z => {
    const rect = L.rectangle(z.bounds, {
      color: '#d94f4e',
      weight: 0,
      fillColor: '#d94f4e',
      fillOpacity: 0.15,
    }).bindTooltip(z.name, { className: 'cong-tip', permanent: false });
    heatLayer.addLayer(rect);
  });
  heatLayer.addTo(gisMap);

  // Coordinate tracking
  gisMap.on('mousemove', e => {
    document.getElementById('coords-lat').textContent = e.latlng.lat.toFixed(4);
    document.getElementById('coords-lng').textContent = e.latlng.lng.toFixed(4);
  });

  routeLayer = L.layerGroup().addTo(gisMap);
}

function drawGISRoute(waypoints, color) {
  if (!gisMap || !layerVisible.route) return;
  routeLayer.clearLayers();
  if (waypoints.length < 2) return;

  // Draw polyline
  const line = L.polyline(waypoints, {
    color: color || '#5aa8f5',
    weight: 4,
    opacity: 0.75,
    dashArray: '8,5',
    lineCap: 'round',
  });
  routeLayer.addLayer(line);

  // Start/end markers
  const startIcon = L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;background:#6ed630;border-radius:50%;border:2px solid rgba(110,214,48,.5);box-shadow:0 0 8px rgba(110,214,48,.6)"></div>`,
    iconSize:[12,12], iconAnchor:[6,6]
  });
  const endIcon = L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;background:#d94f4e;border-radius:50%;border:2px solid rgba(217,79,78,.5);box-shadow:0 0 8px rgba(217,79,78,.6)"></div>`,
    iconSize:[12,12], iconAnchor:[6,6]
  });
  routeLayer.addLayer(L.marker(waypoints[0], { icon: startIcon }));
  routeLayer.addLayer(L.marker(waypoints[waypoints.length-1], { icon: endIcon }));
}

function updateAmbulanceMarker(id, lat, lng, priority) {
  const colors = { P1: '#d94f4e', P2: '#e8981f', P3: '#5aa8f5' };
  const col = colors[priority] || '#d94f4e';
  const html = `<div style="
    width:16px;height:16px;background:#f0f0ff;border-radius:3px;
    display:flex;align-items:center;justify-content:center;
    border:1.5px solid ${col};
    box-shadow:0 0 12px ${col}88;
    font-family:monospace;font-size:8px;font-weight:700;color:${col}
  ">${id}</div>`;
  const icon = L.divIcon({ className:'', html, iconSize:[16,16], iconAnchor:[8,8] });
  if (ambMarkers[id]) {
    ambMarkers[id].setLatLng([lat, lng]);
  } else {
    ambMarkers[id] = L.marker([lat, lng], { icon, zIndexOffset: 1000 });
    if (gisMap) ambMarkers[id].addTo(gisMap);
  }
}

function removeAmbulanceMarker(id) {
  if (ambMarkers[id] && gisMap) {
    gisMap.removeLayer(ambMarkers[id]);
    delete ambMarkers[id];
  }
}

function clearGISRoute() {
  if (routeLayer) routeLayer.clearLayers();
  for (const id in ambMarkers) removeAmbulanceMarker(id);
}

function toggleLayer(name, checkbox) {
  layerVisible[name] = checkbox.checked;
  if (!gisMap) return;
  if (name === 'heat') {
    checkbox.checked ? gisMap.addLayer(heatLayer)  : gisMap.removeLayer(heatLayer);
  } else if (name === 'hosp') {
    checkbox.checked ? gisMap.addLayer(hospLayer)  : gisMap.removeLayer(hospLayer);
  } else if (name === 'route') {
    checkbox.checked ? gisMap.addLayer(routeLayer) : gisMap.removeLayer(routeLayer);
  }
}

// Generate a simulated GPS path between two random Pune waypoints
function generatePuneRoute(startNode, endNode) {
  // Map grid nodes → approximate Pune lat/lng offsets around centre
  const G = CONFIG.GRID;
  const latSpan = 0.028, lngSpan = 0.038;
  function nodeToLatLng(r, c) {
    return [
      PUNE_CENTER[0] + (r / G - 0.5) * latSpan,
      PUNE_CENTER[1] + (c / G - 0.5) * lngSpan,
    ];
  }
  return nodeToLatLng;
}

function nodeToLatLng(r, c) {
  const G = CONFIG.GRID;
  const latSpan = 0.028, lngSpan = 0.038;
  return [
    PUNE_CENTER[0] + (r / G - 0.5) * latSpan,
    PUNE_CENTER[1] + (c / G - 0.5) * lngSpan,
  ];
}

function panToRoute(path) {
  if (!gisMap || !path || path.length < 2) return;
  const bounds = L.latLngBounds(path.map(pt => nodeToLatLng(pt.r, pt.c)));
  gisMap.fitBounds(bounds, { padding: [40, 40] });
}
