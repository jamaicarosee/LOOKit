import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Plus, Minus } from 'lucide-react';
import { fetchCampusData } from '../../navigation/services/dataService';
import { MAPBOX_TOKEN, RTU_PASIG_CENTER, COLORS } from '../../navigation/constants';

// Floor-plan view (same look as the Directions route map): rooms, stairs/structures and
// paths of one floor, with the chosen location highlighted and marked by a pin. No route.
const BUFFER = 0.005;
const EMPTY = { type: 'FeatureCollection', features: [] };
const ROOM_FILL = '#EAF0F7';
const ROOM_HIGHLIGHT = '#F3DE8A';
const FONT = ['Open Sans Bold', 'Arial Unicode MS Bold'];

function pin() {
  const el = document.createElement('div');
  el.style.cssText = 'pointer-events:none;';
  el.innerHTML = `<svg width="26" height="34" viewBox="0 0 24 30"><path d="M12 1C6.5 1 2 5.4 2 10.8 2 18 12 29 12 29s10-11 10-18.2C22 5.4 17.5 1 12 1z" fill="${COLORS.navy}" stroke="#fff" stroke-width="2"/><circle cx="12" cy="11" r="4" fill="#fff"/></svg>`;
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

// target: a location from the campus data ({ id, type, floor, code, coordinates }) or null
export default function FloorPlanMap({ target, activeFloor }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const dataRef = useRef(null);
  const pinRef = useRef(null);
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
        setMapLoaded(true);
      } catch {
        setMapError(true);
      }
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      pinRef.current?.remove();
      pinRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // --- Active floor: swap rooms / structures / paths ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const f = floorFeatures(dataRef.current, activeFloor);
    map.getSource('rooms')?.setData(f.rooms);
    map.getSource('floor-paths')?.setData(f.paths);
    map.getSource('structures')?.setData(f.structures);
  }, [activeFloor, mapLoaded]);

  // --- Highlight the chosen room (only on its own floor) ---
  const highlightCode = target?.type === 'room' && target.floor === activeFloor ? target.code : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.setPaintProperty(
      'rooms-fill',
      'fill-color',
      highlightCode ? ['case', ['==', ['get', 'code'], highlightCode], ROOM_HIGHLIGHT, ROOM_FILL] : ROOM_FILL,
    );
  }, [highlightCode, mapLoaded, activeFloor]);

  // --- Pin ---
  const pinHere = target?.coordinates && (target.type !== 'room' || target.floor === activeFloor);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    pinRef.current?.remove();
    pinRef.current = null;
    if (pinHere) {
      pinRef.current = new mapboxgl.Marker({ element: pin(), anchor: 'bottom' }).setLngLat(target.coordinates).addTo(map);
    }
  }, [pinHere, target, mapLoaded]);

  // --- Camera: zoom to a newly chosen location ---
  const targetId = target?.id;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !target?.coordinates) return;
    map.flyTo({ center: target.coordinates, zoom: target.type === 'room' ? 20 : 18.5, duration: 600, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, mapLoaded]);

  const zoom = (dir) => () => (dir > 0 ? mapRef.current?.zoomIn({ duration: 250 }) : mapRef.current?.zoomOut({ duration: 250 }));
  const btn = 'w-8 h-8 rounded-md bg-[#E5EEF7] text-[#0B1E36] flex items-center justify-center shadow-sm active:scale-95 transition hover:bg-[#D5E2EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36]';

  return (
    <div className="absolute inset-0 bg-[#F8F9F9]">
      {!mapError && <div ref={containerRef} className="absolute inset-0" />}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs font-medium text-[#607289]">
          The map is unavailable (missing Mapbox token or WebGL).
        </div>
      )}
      {!mapError && (
        <div className="absolute z-20 top-2 right-2 flex flex-col gap-1.5">
          <button type="button" onClick={zoom(1)} aria-label="Zoom in" className={btn}><Plus className="w-4 h-4 stroke-[2.5]" /></button>
          <button type="button" onClick={zoom(-1)} aria-label="Zoom out" className={btn}><Minus className="w-4 h-4 stroke-[2.5]" /></button>
        </div>
      )}
    </div>
  );
}
