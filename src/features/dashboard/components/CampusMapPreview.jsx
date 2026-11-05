import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Plus, Minus, Compass, Box } from 'lucide-react';

const RTU_PASIG_CENTER = [121.09999, 14.57309];
// Slightly shifted north on desktop so the campus sits cleanly below the floating title at start
const DESKTOP_START_CENTER = [121.09999, 14.57315];
const BUFFER = 0.005;

const MOBILE_DEFAULT_ZOOM = 17.5;
const DESKTOP_DEFAULT_ZOOM = 18.15;

// Helper to get responsive camera targets based on viewport mode
function getBuildingAnchors(isDesktop) {
  if (isDesktop) {
    return {
      all: { center: DESKTOP_START_CENTER, zoom: DESKTOP_DEFAULT_ZOOM },
      mae: { center: [121.09981, 14.57337], zoom: 18.75 },
      ced: { center: [121.10037, 14.57334], zoom: 18.8 },
      cas: { center: [121.10058, 14.57323], zoom: 18.8 },
      javier: { center: [121.09995, 14.57282], zoom: 18.55 },
      canteen: { center: [121.10041, 14.57263], zoom: 18.85 },
    };
  }

  return {
    all: { center: RTU_PASIG_CENTER, zoom: MOBILE_DEFAULT_ZOOM },
    mae: { center: [121.09981, 14.57337], zoom: 18.2 },
    ced: { center: [121.10037, 14.57334], zoom: 18.2 },
    cas: { center: [121.10058, 14.57323], zoom: 18.2 },
    javier: { center: [121.09995, 14.57282], zoom: 18.0 },
    canteen: { center: [121.10041, 14.57263], zoom: 18.3 },
  };
}

const FILTER_NAME_MATCHES = {
  mae: ['M.A.E Building'],
  ced: ['CED Building'],
  cas: ['CAS Building'],
  javier: ['Javier Building', 'Gymnasium', 'Garden'],
  canteen: ['Canteen'],
};

// Helper: Calculate polygon center for Gate marker placement
function getFeatureCenter(feature) {
  if (feature.geometry.type === 'Point') {
    return feature.geometry.coordinates;
  }
  const coords =
    feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates[0]
      : feature.geometry.type === 'MultiPolygon'
      ? feature.geometry.coordinates[0][0]
      : feature.geometry.coordinates;

  let sumLon = 0;
  let sumLat = 0;
  let count = 0;

  for (let i = 0; i < coords.length; i++) {
    const pt = coords[i];
    if (Array.isArray(pt) && typeof pt[0] === 'number') {
      sumLon += pt[0];
      sumLat += pt[1];
      count++;
    }
  }
  return count > 0 ? [sumLon / count, sumLat / count] : RTU_PASIG_CENTER;
}

export default function CampusMapPreview({
  activeFilter,
  isDesktop = false,
  onZoomStateChange,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [is3D, setIs3D] = useState(false);

  const initialZoom = isDesktop ? DESKTOP_DEFAULT_ZOOM : MOBILE_DEFAULT_ZOOM;
  const initialCenter = isDesktop ? DESKTOP_START_CENTER : RTU_PASIG_CENTER;

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    mapboxgl.accessToken =
      import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || import.meta.env.VITE_MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
        sources: {},
        layers: [
          {
            id: 'canvas-background',
            type: 'background',
            paint: { 'background-color': '#F8F9F9' },
          },
        ],
      },
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 16.5,
      maxBounds: [
        [RTU_PASIG_CENTER[0] - BUFFER, RTU_PASIG_CENTER[1] - BUFFER],
        [RTU_PASIG_CENTER[0] + BUFFER, RTU_PASIG_CENTER[1] + BUFFER],
      ],
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      doubleClickZoom: false,
    });

    mapRef.current = map;

    // Keep Mapbox WebGL canvas synced with container resizing
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    // Track zoom changes to animate the desktop campus header out/in
    const handleZoomCheck = () => {
      if (!onZoomStateChange) return;
      const currentZoom = map.getZoom();
      // Trigger hide if zoomed in past starting baseline (with small 0.04 tolerance)
      onZoomStateChange(currentZoom > initialZoom + 0.04);
    };

    map.on('zoom', handleZoomCheck);

    map.on('load', async () => {
      try {
        // 1. Register Procedural Direction Arrow Icon (SDF)
        if (!map.hasImage('path-arrow')) {
          const size = 32;
          const cv = document.createElement('canvas');
          cv.width = cv.height = size;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.moveTo(3, 12);
          ctx.lineTo(17, 12);
          ctx.lineTo(17, 5);
          ctx.lineTo(29, 16);
          ctx.lineTo(17, 27);
          ctx.lineTo(17, 20);
          ctx.lineTo(3, 20);
          ctx.closePath();
          ctx.fill();
          map.addImage('path-arrow', ctx.getImageData(0, 0, size, size), { sdf: true });
        }

        // Fetch Macro Buildings & Site Features + Floor 1 Ground Paths
        const [campusRes, siteRes, pathsRes] = await Promise.all([
          fetch('/data/macro/rtu_pasig_campus.geojson'),
          fetch('/data/macro/site_features.geojson'),
          fetch('/data/floor1/paths_f1.geojson'),
        ]);

        const campusData = campusRes.ok ? await campusRes.json() : null;
        const siteData = siteRes.ok ? await siteRes.json() : null;
        const pathsData = pathsRes.ok ? await pathsRes.json() : null;

        // --- SOURCES ---
        if (campusData) {
          map.addSource('rtu-campus-macro', { type: 'geojson', data: campusData });
        }
        if (siteData) {
          map.addSource('rtu-site-features', { type: 'geojson', data: siteData });
        }
        if (pathsData) {
          map.addSource('rtu-campus-paths', { type: 'geojson', data: pathsData });
        }

        // --- LAYERS ---

        // A. Base Campus Footprint
        if (campusData) {
          map.addLayer({
            id: 'rtu-campus-fill',
            type: 'fill',
            source: 'rtu-campus-macro',
            paint: {
              'fill-color': '#F1EEE9',
              'fill-opacity': 0.6,
            },
          });
          map.addLayer({
            id: 'rtu-campus-outline',
            type: 'line',
            source: 'rtu-campus-macro',
            paint: {
              'line-color': '#D6DBDF',
              'line-width': 1.5,
              'line-opacity': 0.9,
            },
          });
        }

        // Site Features (Parking Lots, Courts, Gates)
        if (siteData) {
          map.addLayer({
            id: 'rtu-site-3d',
            type: 'fill-extrusion',
            source: 'rtu-site-features',
            paint: {
              'fill-extrusion-color': ['coalesce', ['get', 'color'], '#BDC3C7'],
              'fill-extrusion-height': ['coalesce', ['get', 'height'], 0.5],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.85,
            },
          });

          map.addLayer({
            id: 'rtu-site-outline',
            type: 'line',
            source: 'rtu-site-features',
            paint: {
              'line-color': '#7F8C8D',
              'line-width': 1.2,
              'line-opacity': 0.8,
            },
          });

          // Parking 1 & Parking 2 Labels
          map.addLayer({
            id: 'rtu-site-parking-labels',
            type: 'symbol',
            source: 'rtu-site-features',
            filter: [
              'any',
              ['==', ['get', 'category'], 'parking'],
              ['in', 'Parking', ['get', 'name']],
            ],
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 11,
              'text-anchor': 'center',
              'text-allow-overlap': true,
            },
            paint: {
              'text-color': '#475569',
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 2.0,
            },
          });

          // Render Gate 1 & Gate 2
          (siteData.features || []).forEach((feature) => {
            const name = feature.properties?.name || '';
            const category = feature.properties?.category || '';

            if (category === 'gate' || name.toLowerCase().includes('gate')) {
              const center = getFeatureCenter(feature);
              const badge = document.createElement('div');
              badge.className = 'gate-badge-pill';
              badge.textContent = name;
              badge.style.cssText = `
                background-color: #E74C3C;
                color: #FFFFFF;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-weight: 800;
                font-size: 10px;
                line-height: 1;
                padding: 3px 8px;
                border-radius: 9999px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.35);
                border: 1.5px solid #FFFFFF;
                letter-spacing: 0.02em;
                white-space: nowrap;
                pointer-events: none;
                user-select: none;
              `;

              const marker = new mapboxgl.Marker({
                element: badge,
                anchor: 'center',
              })
                .setLngLat(center)
                .addTo(map);

              markersRef.current.push(marker);
            }
          });
        }

        

        // 3D Extruded Buildings
        if (campusData) {
          map.addLayer({
            id: 'rtu-campus-buildings',
            type: 'fill-extrusion',
            source: 'rtu-campus-macro',
            paint: {
              'fill-extrusion-color': [
                'match',
                ['get', 'name'],
                'M.A.E Building', '#E67E22',
                'CED Building', '#2980B9',
                'CAS Building', '#27AE60',
                'Javier Building', '#F1C40F',
                'Gymnasium', '#F1C40F',
                'Garden', '#E67E22',
                'Canteen', '#FFFFFF',
                'Basketball Court', '#E5E8E8',
                'Walkway / Overpass', '#A6A6A6',
                '#BDC3C7',
              ],
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.85,
            },
          });

          // Crisp Perimeter Building Strokes
          map.addLayer({
            id: 'rtu-campus-strokes',
            type: 'line',
            source: 'rtu-campus-macro',
            paint: {
              'line-color': '#475569',
              'line-width': 1.2,
              'line-opacity': 0.8,
            },
          });

          // Full Building Typography (Including Walkway / Overpass)
          map.addLayer({
            id: 'rtu-campus-labels',
            type: 'symbol',
            source: 'rtu-campus-macro',
            layout: {
              'text-field': ['get', 'label'],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 10,
              'text-anchor': 'center',
              'text-justify': 'center',
              'text-allow-overlap': true,
            },
            paint: {
              'text-color': '#1E293B',
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 2.0,
              'text-halo-blur': 0.5,
            },
          });
        }

        setMapLoaded(true);
      } catch (err) {
        console.error('Campus macro vector rendering error:', err);
      }
    });

    return () => {
      map.off('zoom', handleZoomCheck);
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [initialCenter, initialZoom, onZoomStateChange]);

  // Sync Dynamic Filter Highlighting & Camera Movements
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getLayer('rtu-campus-buildings')) return;

    const anchors = getBuildingAnchors(isDesktop);
    const targetConfig = anchors[activeFilter] || anchors.all;

    map.flyTo({
      ...targetConfig,
      pitch: is3D ? 55 : 0,
      bearing: is3D ? -15 : 0,
      duration: 600,
      essential: true,
    });

    if (activeFilter === 'all') {
      map.setPaintProperty('rtu-campus-buildings', 'fill-extrusion-opacity', 0.85);
    } else {
      const allowedNames = FILTER_NAME_MATCHES[activeFilter] || [];
      map.setPaintProperty('rtu-campus-buildings', 'fill-extrusion-opacity', [
        'case',
        ['in', ['get', 'name'], ['literal', allowedNames]],
        0.95,
        0.22,
      ]);
    }
  }, [activeFilter, mapLoaded, is3D, isDesktop]);

  // Floating HUD Controls
  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 250 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 250 });
  const handleReset = () => {
    mapRef.current?.flyTo({
      center: initialCenter,
      zoom: initialZoom,
      pitch: is3D ? 55 : 0,
      bearing: is3D ? -15 : 0,
      duration: 500,
    });
  };

  const handleToggle3D = () => {
    const nextMode = !is3D;
    setIs3D(nextMode);
    mapRef.current?.easeTo({
      pitch: nextMode ? 55 : 0,
      bearing: nextMode ? -15 : 0,
      duration: 700,
    });
  };

  const btnSizeClass = isDesktop ? 'w-9 h-9' : 'w-8 h-8';
  const hudPositionClass = isDesktop ? 'top-6 right-8 gap-2' : 'top-3 right-3 gap-1.5';

  return (
    <div className="relative flex-1 w-full h-full bg-[#F8F9F9] overflow-hidden select-none">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating HUD Controls (+ / - / Reset / 2D-3D Toggle) */}
      <div className={`absolute z-30 flex flex-col pointer-events-auto ${hudPositionClass}`}>
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom In"
          className={`${btnSizeClass} rounded-md bg-[#E5EEF7] text-[#0B1E36] flex items-center justify-center shadow-sm active:scale-95 transition hover:bg-[#D5E2EE]`}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom Out"
          className={`${btnSizeClass} rounded-md bg-[#E5EEF7] text-[#0B1E36] flex items-center justify-center shadow-sm active:scale-95 transition hover:bg-[#D5E2EE]`}
        >
          <Minus className="w-4 h-4 stroke-[2.5]" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          aria-label="Center Map"
          className={`${btnSizeClass} rounded-md bg-[#E5EEF7] text-[#0B1E36] flex items-center justify-center shadow-sm active:scale-95 transition hover:bg-[#D5E2EE]`}
        >
          <Compass className="w-4 h-4 stroke-[2.2]" />
        </button>
        <button
          type="button"
          onClick={handleToggle3D}
          aria-label="Toggle 2D/3D Perspective"
          title={is3D ? 'Switch to 2D Top-Down' : 'Switch to 3D Isometric'}
          className={`${btnSizeClass} rounded-md flex items-center justify-center shadow-sm active:scale-95 transition font-black text-xs ${
            is3D
              ? 'bg-[#0B1E36] text-white shadow-md'
              : 'bg-[#E5EEF7] text-[#0B1E36] hover:bg-[#D5E2EE]'
          }`}
        >
          <Box className="w-4 h-4 stroke-[2.2]" />
        </button>
      </div>
    </div>
  );
}