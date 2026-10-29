# Search + Directions update

New files only, nothing existing was edited.

- `src/features/navigation/`: constants, `NavigationFlow.jsx`, services (geo, graph, stepBuilder, routing, location, data)
- `src/features/search/`: Search screen, From/To form, **Emergency / PWD toggles**
- `src/features/directions/`: Directions screen, floor-aware Route map, **Play guide**, Step-by-step, **Directory**
- `navigation-preview.html` + `src/preview/navigation-main.jsx`: dev preview (`npm run dev` -> `/navigation-preview.html`)

Wire-up in `App.jsx` (when ready):

    <NavigationFlow onBackToMap={() => setScreen('dashboard')} onNavSelect={handleNav} />

Data-driven decisions (check these against your campus data):

- Floors are joined by stairs matched by position between consecutive floors (28 links found). Entrance stairs and PWD ramps on floor 1 are separate edges.
- PWD = no stairs. No elevators exist in the data, so PWD routes to floors 2-6 fall back to stairs with a visible warning.
- Emergency = nearest of Gate 1 / Gate 2 (`To` is disabled and automatic), stairs allowed.
- Gates, parking and building entrances are found by geometry (nearest ground nodes to their polygon), so the data needs no named junctions. Duplicate lines (macro vs floor 1) are merged.
- Floor-1 paths are walkable both ways except the exit roads, ring west and entrance walkway (kept one-way); macro one-way flags are respected.
- A few gaps in the drawn paths are bridged (connector walkways to ramps, 8.6 m).
- `VITE_MAPBOX_TOKEN` (or `VITE_MAPBOX_ACCESS_TOKEN`) is read for the map.

## Updating the map data

Replace the files in `public/data/` (same names), then run `npm run check:routes`. It rebuilds the routing graph and lists unreachable rooms and suspicious detours. Routes are computed at runtime from the GeoJSON, so no code change is needed. The route map shows floors 1-6 only (no campus overview layer).
