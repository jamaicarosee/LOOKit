import networkx as nx
from database import supabase

PAGINATION_LIMIT = 1000

class CampusGraphService:
    def __init__(self):
        # Use undirected Graph since walking corridors and stairs are bidirectional
        self.graph = nx.Graph()

    def _fetch_all_rows(self, table_name: str, select_query: str = "*") -> list[dict]:
        """Fetches all rows from a Supabase table with automatic pagination."""
        all_rows = []
        page = 0
        while True:
            res = (
                supabase.table(table_name)
                .select(select_query)
                .range(page * PAGINATION_LIMIT, (page + 1) * PAGINATION_LIMIT - 1)
                .execute()
            )
            batch = res.data or []
            all_rows.extend(batch)
            if len(batch) < PAGINATION_LIMIT:
                break
            page += 1
        return all_rows

    def build_graph(self) -> tuple[int, int]:
        """Fetches all locations (nodes) and path segments (edges) using full pagination."""
        self.graph.clear()

        # 1. Fetch all locations (nodes)
        locations = self._fetch_all_rows(
            "location",
            "locationid, name, type, floorid, x_coordinate, y_coordinate"
        )

        for loc in locations:
            self.graph.add_node(
                loc["locationid"],
                name=loc.get("name") or "Unknown",
                type=loc.get("type") or "corridor",
                floor_id=loc.get("floorid"),
                longitude=float(loc["x_coordinate"]),
                latitude=float(loc["y_coordinate"])
            )

        # 2. Fetch all path segments (edges)
        paths = self._fetch_all_rows(
            "path_segments",
            "start_location_id, end_location_id, distance, is_accessible"
        )

        for path in paths:
            u = path["start_location_id"]
            v = path["end_location_id"]
            dist = float(path["distance"])
            is_acc = path.get("is_accessible", True)

            # In an undirected graph, keep the smallest weight if duplicate entries exist
            if self.graph.has_edge(u, v):
                if dist < self.graph[u][v]["weight"]:
                    self.graph[u][v]["weight"] = dist
                    self.graph[u][v]["is_accessible"] = is_acc
            else:
                self.graph.add_edge(
                    u,
                    v,
                    weight=dist,
                    is_accessible=is_acc
                )

        return self.graph.number_of_nodes(), self.graph.number_of_edges()

    def calculate_route(self, start_id: int, end_id: int, accessible_only: bool = False) -> dict | None:
        """Finds the shortest path and generates a standard GeoJSON LineString."""
        if self.graph.number_of_nodes() == 0:
            self.build_graph()

        # Handle accessibility filtering (e.g. wheelchairs excluding stairs)
        if accessible_only:
            valid_edges = [
                (u, v) for u, v, data in self.graph.edges(data=True)
                if data.get("is_accessible", True)
            ]
            active_graph = self.graph.edge_subgraph(valid_edges)
        else:
            active_graph = self.graph

        if not active_graph.has_node(start_id) or not active_graph.has_node(end_id):
            return None

        # Calculate Dijkstra path within try/except block
        try:
            path_ids = nx.dijkstra_path(
                active_graph,
                source=start_id,
                target=end_id,
                weight="weight"
            )
            total_distance = nx.dijkstra_path_length(
                active_graph,
                source=start_id,
                target=end_id,
                weight="weight"
            )
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None

        waypoints = []
        geojson_coordinates = []

        for node_id in path_ids:
            node_data = self.graph.nodes[node_id]
            coords = [node_data["longitude"], node_data["latitude"]]
            waypoints.append({
                "locationid": node_id,
                "name": node_data.get("name"),
                "type": node_data.get("type"),
                "floor_id": node_data.get("floor_id"),
                "coordinates": coords
            })
            geojson_coordinates.append(coords)

        return {
            "total_distance_meters": round(total_distance, 2),
            "step_count": len(waypoints),
            "waypoints": waypoints,
            "geojson": {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": geojson_coordinates
                },
                "properties": {
                    "start_location_id": start_id,
                    "end_location_id": end_id,
                    "total_distance_meters": round(total_distance, 2),
                    "is_accessible": accessible_only
                }
            }
        }

graph_service = CampusGraphService()