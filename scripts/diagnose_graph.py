import os
import sys
from pathlib import Path

# Add backend root to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(override=True)

import networkx as nx
from services.graph_service import graph_service
from database import supabase

# 1. Populate the in-memory graph from Supabase
print("=== BUILDING GRAPH FROM SUPABASE ===")
nodes_count, edges_count = graph_service.build_graph()
g = graph_service.graph

print(f"Graph loaded: {nodes_count} nodes, {edges_count} edges")
print(f"Is directed? {g.is_directed()}")

# 2. Check the specific transit nodes
res1 = supabase.table("location").select("locationid, code").eq("code", "TRANSIT-F1-STAIRS-MAE-WEST").execute()
res6 = supabase.table("location").select("locationid, code").eq("code", "TRANSIT-F6-STAIRS-F6-MAE-WEST").execute()

if not res1.data or not res6.data:
    print("Could not find test nodes in location table.")
    sys.exit(1)

id1 = res1.data[0]["locationid"]
id6 = res6.data[0]["locationid"]

print(f"\nStart Node: {res1.data[0]['code']} (ID: {id1}) -> In graph: {g.has_node(id1)}")
if g.has_node(id1):
    print(f"  Start Node Neighbors ({g.degree(id1)}): {list(g.neighbors(id1))}")

print(f"\nEnd Node:   {res6.data[0]['code']} (ID: {id6}) -> In graph: {g.has_node(id6)}")
if g.has_node(id6):
    print(f"  End Node Neighbors ({g.degree(id6)}): {list(g.neighbors(id6))}")

ug = g.to_undirected() if g.is_directed() else g

# 3. Check connectivity between Floors 1 through 6 for MAE West
print("\n=== TRACING MAE WEST VERTICAL CHAIN (F1 -> F6) ===")
mae_west_codes = [
    "TRANSIT-F1-STAIRS-MAE-WEST",
    "TRANSIT-F2-STAIRS-F2-MAE-WEST",
    "TRANSIT-F3-STAIRS-F3-MAE-WEST",
    "TRANSIT-F4-STAIRS-F4-MAE-WEST",
    "TRANSIT-F5-STAIRS-F5-MAE-WEST",
    "TRANSIT-F6-STAIRS-F6-MAE-WEST",
]

chain_ids = []
for code in mae_west_codes:
    row = supabase.table("location").select("locationid, code").eq("code", code).execute()
    if row.data:
        cid = row.data[0]["locationid"]
        chain_ids.append((code, cid))
        deg = g.degree(cid) if g.has_node(cid) else 0
        print(f"  {code} (ID {cid}): {deg} edges")
    else:
        print(f"  {code}: NOT FOUND IN DB")

for i in range(len(chain_ids) - 1):
    c1, id_a = chain_ids[i]
    c2, id_b = chain_ids[i + 1]
    has_edge = g.has_edge(id_a, id_b)
    print(f"  Edge {c1.split('-')[1]} <-> {c2.split('-')[1]}: {'CONNECTED' if has_edge else 'BROKEN / MISSING'}")

print(f"\nFull Path ID {id1} -> ID {id6}? {nx.has_path(g, id1, id6)}")