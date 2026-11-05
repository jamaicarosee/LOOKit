import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Plus, Minus } from 'lucide-react';
import { fetchCampusData } from '../../navigation/services/dataService';
import { coordsBounds } from '../../navigation/services/geo';
import { MAPBOX_TOKEN, RTU_PASIG_CENTER, COLORS } from '../../navigation/constants';
import RouteSummaryChip from './RouteSummaryChip';
import FloorTabs from './FloorTabs';

const BUFFER = 0.005;
const EMPTY = { type: 'FeatureCollection', features: [] };
const ROOM_FILL = '#EAF0F7';
const FONT = ['Open Sans Bold', 'Arial Unicode MS Bold'];

// --- DOM markers ---

function dot(color, size = 16) {
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);pointer-events:none;`;
  return el;
}

function pin() {
  const el = document.createElement('div');
  el.style.cssText = 'pointer-events:none;';
  el.innerHTML = `<svg width="26" height="34" viewBox="0 0 24 30"><path d="M12 1C6.5 1 2 5.4 2 10.8 2 18 12 29 12 29s10-11 10-18.2C22 5.4 17.5 1 12 1z" fill="${COLORS.navy}" stroke="#fff" stroke-width="2"/><circle cx="12" cy="11" r="4" fill="#fff"/></svg>`;
  return el;
}

function badge(text) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `background:${COLORS.navy};color:#fff;font:800 10px -apple-system,Segoe UI,Roboto,sans-serif;padding:3px 8px;border-radius:9999px;border:1.5px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.35);white-space:nowrap;pointer-events:none;`;
  return el;
}

function guideDot() {
  const el = dot('#2563EB', 16);
  el.animate(
    [{ boxShadow: '0 0 0 0 rgba(37,99,235,.55)' }, { boxShadow: '0 0 0 14px rgba(37,99,235,0)' }],
    { duration: 1200, iterations: Infinity },
  );
  return el;
}

function floorFeatures(data, floor) {
  const fd = data?.floors?.[floor] || {};
  return {
    rooms: fd.rooms || EMPTY,
    paths: fd.paths || EMPTY,
    structures: {
      type: 'FeatureCollection',
      features: (fd.structures || [])
        .filter((s) => s.geometry)
        .map((s) => ({ type: 'Feature', properties: { type: s.type, name: s.name }, geometry: s.geometry })),
    },
  };
}

// "Route" panel: floor-only Mapbox map (floors 1-6, no campus overview layer) with the route, stairs markers and the play-guide dot
export default function RouteMapPanel({ route, status, activeFloor, onFloorChange, guide, focus, hasRequest, mapClassName = 'h-[32dvh] min-h-[180px]' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const dataRef = useRef(null);
  const markersRef = useRef({ start: null, end: null, guide: null, stairs: [] });
  const lastFitRef = useRef('');
  const lastFollowRef = useRef(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(!MAPBOX_TOKEN);

  // --- Map lifecycle ---
  useEffect(() => {
    if (!MAPBOX_TOKEN || mapRef.current || !containerRef.current) return undefined;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    let map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
          sources: {},
          layers: [{ id: 'canvas-background', type: 'background', paint: { 'background-color': '#F8F9F9' } }],
        },
        center: RTU_PASIG_CENTER,
        zoom: 17.5,
        minZoom: 16.5,
        maxBounds: [
          [RTU_PASIG_CENTER[0] - BUFFER, RTU_PASIG_CENTER[1] - BUFFER],
          [RTU_PASIG_CENTER[0] + BUFFER, RTU_PASIG_CENTER[1] + BUFFER],
        ],
        attributionControl: false,
        doubleClickZoom: false,
      });
    } catch {
      setMapError(true);
      return undefined;
    }
    mapRef.current = map;
    const markers = markersRef.current;
    let disposed = false;

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    map.on('load', async () => {
      try {
        const data = await fetchCampusData();
        if (disposed) return;
        dataRef.current = data;
        const f1 = floorFeatures(data, 1);

        map.addSource('rooms', { type: 'geojson', data: f1.rooms });
        map.addSource('floor-paths', { type: 'geojson', data: f1.paths });
        map.addSource('structures', { type: 'geojson', data: f1.structures });
        map.addSource('route-line', { type: 'geojson', data: EMPTY });

        map.addLayer({ id: 'rooms-fill', type: 'fill', source: 'rooms', paint: { 'fill-color': ROOM_FILL, 'fill-opacity': 0.95 } });
        map.addLayer({ id: 'rooms-outline', type: 'line', source: 'rooms', paint: { 'line-color': '#8FA3BA', 'line-width': 0.8 } });
        map.addLayer({
          id: 'structures-fill', type: 'fill', source: 'structures',
          paint: { 'fill-color': ['match', ['get', 'type'], 'ramp', '#A2D9CE', '#C5CBD3'], 'fill-opacity': 0.9 },
        });
        map.addLayer({ id: 'floor-paths-line', type: 'line', source: 'floor-paths', paint: { 'line-color': '#B8C4D2', 'line-width': 1.2, 'line-dasharray': [2, 2] } });
        map.addLayer({
          id: 'rooms-labels', type: 'symbol', source: 'rooms', minzoom: 18.6,
          layout: { 'text-field': ['get', 'label'], 'text-font': FONT, 'text-size': 9 },
          paint: { 'text-color': '#334155', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 },
        });
        map.addLayer({
          id: 'route-casing', type: 'line', source: 'route-line',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#FFFFFF', 'line-width': 9 },
        });
        map.addLayer({
          id: 'route-main', type: 'line', source: 'route-line',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': COLORS.navy, 'line-width': 5 },
        });
        setMapLoaded(true);
      } catch {
        setMapError(true);
      }
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      [markers.start, markers.end, markers.guide, ...markers.stairs].forEach((m) => m && m.remove());
      markers.start = null;
      markers.end = null;
      markers.guide = null;
      markers.stairs = [];
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // --- Active floor: swap rooms / stairs / paths ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const f = floorFeatures(dataRef.current, activeFloor);
    map.getSource('rooms')?.setData(f.rooms);
    map.getSource('floor-paths')?.setData(f.paths);
    map.getSource('structures')?.setData(f.structures);
  }, [activeFloor, mapLoaded]);

  // --- Destination room highlight ---
  const destCode = route?.to?.type === 'room' && route.to.floor === activeFloor ? route.to.code : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.setPaintProperty('rooms-fill', 'fill-color', destCode ? ['case', ['==', ['get', 'code'], destCode], '#F3DE8A', ROOM_FILL] : ROOM_FILL);
  }, [destCode, mapLoaded, activeFloor]);

  // --- Route line, markers and camera for the active floor ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const m = markersRef.current;
    [m.start, m.end, ...m.stairs].forEach((x) => x && x.remove());
    m.start = null;
    m.end = null;
    m.stairs = [];

    const legs = route ? route.legs.filter((l) => l.floor === activeFloor) : [];
    map.getSource('route-line')?.setData({
      type: 'FeatureCollection',
      features: legs.map((l) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.coords } })),
    });
    if (!route) return;

    if (route.start.floor === activeFloor) m.start = new mapboxgl.Marker({ element: dot(COLORS.gold), anchor: 'center' }).setLngLat(route.start.coordinate).addTo(map);
    if (route.end.floor === activeFloor) m.end = new mapboxgl.Marker({ element: pin(), anchor: 'bottom' }).setLngLat(route.end.coordinate).addTo(map);
    const stairs = route.stairMarkers.filter((s) => s.floor === activeFloor);
    stairs.forEach((s) => {
      const text = `${s.toFloor > s.floor ? '▲' : '▼'} Stairs to ${s.toFloor}F`;
      m.stairs.push(new mapboxgl.Marker({ element: badge(text), anchor: 'bottom', offset: [0, -4] }).setLngLat(s.coordinate).addTo(map));
    });

    // Fit once per route + floor
    const key = `${route.distanceMeters}-${route.steps.length}-${activeFloor}-${route.start.coordinate.join()}`;
    if (lastFitRef.current !== key) {
      lastFitRef.current = key;
      const pts = legs.flatMap((l) => l.coords).concat(stairs.map((s) => s.coordinate));
      if (pts.length) {
        const [a, b, c, d] = coordsBounds(pts);
        map.fitBounds([[a, b], [c, d]], { padding: 32, duration: 600, maxZoom: 20 });
      }
    }
  }, [route, activeFloor, mapLoaded]);

  // --- Play-guide marker (follows the camera while playing) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const m = markersRef.current;
    const show = guide?.engaged && guide.position && guide.position.floor === activeFloor;
    if (!show) {
      if (m.guide) {
        m.guide.remove();
        m.guide = null;
      }
      return;
    }
    if (!m.guide) m.guide = new mapboxgl.Marker({ element: guideDot(), anchor: 'center' }).setLngLat(guide.position.coordinate).addTo(map);
    else m.guide.setLngLat(guide.position.coordinate);
    const now = performance.now();
    if (guide.isPlaying && now - lastFollowRef.current > 120) {
      lastFollowRef.current = now;
      map.easeTo({ center: guide.position.coordinate, duration: 120, essential: true });
    }
  }, [guide, activeFloor, mapLoaded]);

  // --- Tapping a step flies to it ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !focus) return;
    map.flyTo({ center: focus.coordinate, zoom: 20, duration: 500, essential: true });
  }, [focus, mapLoaded]);

  const zoom = (dir) => () => (dir > 0 ? mapRef.current?.zoomIn({ duration: 250 }) : mapRef.current?.zoomOut({ duration: 250 }));
  const btn = 'w-8 h-8 rounded-md bg-[#E5EEF7] text-[#0B1E36] flex items-center justify-center shadow-sm active:scale-95 transition hover:bg-[#D5E2EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36]';

  return (
    <section aria-label="Route" className="rounded-xl bg-[#E5EBF5] p-2 pt-2.5">
      <div className="flex items-center gap-2 px-1 pb-2">
        <h3 className="text-sm font-black text-[#0B2545]">Route</h3>
        <div className="flex-1 min-w-0">
          <FloorTabs activeFloor={activeFloor} routeFloors={route?.floors || []} onChange={onFloorChange} />
        </div>
      </div>

      <div className={`relative ${mapClassName} rounded-lg overflow-hidden bg-[#F8F9F9]`}>
        {!mapError && <div ref={containerRef} className="absolute inset-0" />}

        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs font-medium text-[#607289]">
            The map is unavailable (missing Mapbox token or WebGL). Your step-by-step directions still work below.
          </div>
        )}

        {!mapError && (
          <div className="absolute z-20 top-2 right-2 flex flex-col gap-1.5">
            <button type="button" onClick={zoom(1)} aria-label="Zoom in" className={btn}><Plus className="w-4 h-4 stroke-[2.5]" /></button>
            <button type="button" onClick={zoom(-1)} aria-label="Zoom out" className={btn}><Minus className="w-4 h-4 stroke-[2.5]" /></button>
          </div>
        )}

        {route && status === 'success' && <RouteSummaryChip route={route} />}

        {status === 'loading' && (
          <div className="absolute inset-0 z-30 bg-white/70 flex flex-col items-center justify-center gap-2" role="status">
            <span className="w-7 h-7 rounded-full border-[3px] border-[#0B1E36] border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-[#0B1E36]">Finding route…</span>
          </div>
        )}
        {status === 'empty' && (
          <div className="absolute inset-0 z-30 bg-white/85 flex items-center justify-center p-4 text-center text-xs font-semibold text-[#0B2545]">
            No walkable route found between these locations.
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 z-30 bg-white/85 flex items-center justify-center p-4 text-center text-xs font-semibold text-red-700">
            Something went wrong while computing the route.
          </div>
        )}
        {status === 'idle' && !hasRequest && (
          <div className="absolute inset-x-0 bottom-0 z-20 p-2 text-center text-[11px] font-medium text-[#607289] bg-white/80">
            Choose a start and destination, then press Start Navigation.
          </div>
        )}
      </div>
    </section>
  );
}
