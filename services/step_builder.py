"""
Pure turn-by-turn step and multi-floor leg builder for LOOKit.
1-to-1 port of src/features/navigation/services/stepBuilder.js
"""

import re
import math
from typing import Any, Callable, Dict, List, Optional
from services.geo_utils import bearing, compass_name, turn_angle, line_length, haversine

WALKING_SPEED_MPS = 1.25
RAMP_SPEED_MPS = 0.9
STAIRS_SECONDS_PER_FLOOR = 22.0
STAIRS_LENGTH_M = 12.0

STRAIGHT_DEG = 25.0
SLIGHT_DEG = 60.0
SHARP_DEG = 125.0


def edge_cost(edge: Dict[str, Any], mode: Optional[Dict[str, Any]] = None) -> float:
    """Travel time in seconds of one edge, or inf when mode forbids it."""
    mode = mode or {}
    kind = edge.get("kind", "walk")
    is_stairs = kind in ("stairs", "entrance-stairs")
    if is_stairs and mode.get("avoidStairs"):
        return float("inf")
    length = float(edge.get("len", 0.0))
    if kind == "stairs":
        return STAIRS_SECONDS_PER_FLOOR
    if kind == "entrance-stairs":
        return length / WALKING_SPEED_MPS + 6.0
    if kind == "ramp":
        return length / RAMP_SPEED_MPS
    return length / WALKING_SPEED_MPS


def _floor_label(n: int) -> str:
    return f"Floor {n}"


def _clean_name(name: Optional[str]) -> str:
    cleaned = re.sub(r"\s*\([^)]*\)\s*", " ", name or "")
    return re.sub(r"\s+", " ", cleaned).strip()


def _turn_word(delta: float) -> Dict[str, str]:
    side = "right" if delta > 0 else "left"
    a = abs(delta)
    if a >= 160.0:
        return {"type": "u-turn", "text": "Make a U-turn"}
    if a >= SHARP_DEG:
        return {"type": f"sharp-{side}", "text": f"Turn sharply {side}"}
    if a >= SLIGHT_DEG:
        return {"type": side, "text": f"Turn {side}"}
    return {"type": f"slight-{side}", "text": f"Bear {side}"}


def _orient(edge: Dict[str, Any], forward: bool) -> Dict[str, Any]:
    name = _clean_name(edge.get("name"))
    if edge.get("kind") == "stairs":
        if forward:
            return {
                **edge,
                "name": name,
                "floorFrom": edge["floor"],
                "floorTo": edge["floorTo"],
                "coords": list(edge["coords"]),
                "coordTo": edge["coordsTo"][0],
            }
        return {
            **edge,
            "name": name,
            "floorFrom": edge["floorTo"],
            "floorTo": edge["floor"],
            "coords": list(edge["coordsTo"]),
            "coordTo": edge["coords"][0],
        }

    coords = list(edge["coords"]) if forward else list(reversed(edge["coords"]))
    return {
        **edge,
        "name": name,
        "up": forward,
        "floorFrom": edge["floor"],
        "floorTo": edge["floor"],
        "coords": coords,
    }


def _heading_at(coords: List[List[float]], at_end: bool) -> Optional[float]:
    indices = list(reversed(range(len(coords)))) if at_end else list(range(len(coords)))
    for i in indices:
        a = coords[i - 1] if (at_end and i - 1 >= 0) else (coords[i] if not at_end else None)
        b = coords[i] if at_end else (coords[i + 1] if i + 1 < len(coords) else None)
        if a and b and (a[0] != b[0] or a[1] != b[1]):
            return bearing(a, b)
    return None


def _stitch(pieces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for i, p in enumerate(pieces):
        prev = pieces[i - 1] if i > 0 else None
        if (
            prev
            and prev.get("kind") != "stairs"
            and p.get("kind") != "stairs"
            and prev.get("floorFrom") == p.get("floorFrom")
        ):
            a = prev["coords"][-1]
            b = p["coords"][0]
            gap = haversine(a, b)
            if 0.5 < gap <= 25.0:
                out.append(
                    {
                        **p,
                        "kind": "walk" if p.get("kind") in ("door", "landing") else p.get("kind"),
                        "spur": bool(p.get("spur")),
                        "coords": [a, b],
                        "len": gap,
                        "cost": gap / WALKING_SPEED_MPS,
                    }
                )
        out.append(p)
    return out


def _merge_neighbours(pieces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for p in pieces:
        last = out[-1] if out else None
        mergeable = (
            last is not None
            and p.get("kind") in ("walk", "ramp", "entrance-stairs")
            and last.get("kind") == p.get("kind")
            and last.get("floorFrom") == p.get("floorFrom")
            and last.get("up") == p.get("up")
            and last.get("name") == p.get("name")
        )
        if mergeable and last is not None:
            last["coords"] = [*last["coords"], *p["coords"][1:]]
            last["len"] += p["len"]
            last["cost"] += p["cost"]
        else:
            out.append({**p, "coords": list(p["coords"])})

    fused: List[Dict[str, Any]] = []
    for p in out:
        last = fused[-1] if fused else None
        is_end = lambda x: x.get("kind") in ("door", "landing")
        if last is not None and ((last.get("spur") and is_end(p)) or (is_end(last) and p.get("spur"))):
            door = last if is_end(last) else p
            last["coords"] = [*last["coords"], *p["coords"][1:]]
            last["len"] += p["len"]
            last["cost"] += p["cost"]
            last["kind"] = door["kind"]
            last["spur"] = False
            last["name"] = door["name"]
        else:
            fused.append(p)
    return fused


def build_route_result(path: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Turns shortestPath output { steps: [{ edge, forward }] } into the full RouteResult
    contract expected by the React frontend.
    """
    mode = ctx.get("mode") or {}
    raw = [
        {**_orient(s["edge"], s["forward"]), "cost": edge_cost(s["edge"], mode)}
        for s in path.get("steps", [])
    ]
    pieces = _merge_neighbours(_stitch(raw))

    steps: List[Dict[str, Any]] = []
    seq = 0

    def add_step(step_data: Dict[str, Any]):
        nonlocal seq
        steps.append(
            {
                "id": f"step-{seq}",
                "distanceMeters": 0,
                "bearing": None,
                **step_data,
            }
        )
        seq += 1

    start_coord = pieces[0]["coords"][0] if pieces else ctx.get("startCoord")
    start_floor = ctx.get("startFloor") or (pieces[0]["floorFrom"] if pieces else 1)

    add_step(
        {
            "type": "start",
            "instruction": f"Start at {ctx['fromLabel']}",
            "floor": start_floor,
            "coordinate": start_coord,
            "coords": [start_coord],
        }
    )

    heading: Optional[float] = None
    last_zone = ctx.get("startZone", "outdoor")
    after_vertical = False
    building_at: Optional[Callable] = ctx.get("buildingAt")
    inside_building: Optional[Callable] = ctx.get("insideBuilding")

    i = 0
    while i < len(pieces):
        p = pieces[i]
        is_last = i == len(pieces) - 1

        # Vertical stairs (merge consecutive floor transitions in the same direction)
        if p.get("kind") == "stairs":
            to_floor = p["floorTo"]
            j = i
            base_sign = 1 if (to_floor - p["floorFrom"]) > 0 else -1
            while j + 1 < len(pieces) and pieces[j + 1].get("kind") == "stairs":
                nxt = pieces[j + 1]
                nxt_sign = 1 if (nxt["floorTo"] - nxt["floorFrom"]) > 0 else -1
                if nxt_sign != base_sign:
                    break
                j += 1
                to_floor = pieces[j]["floorTo"]

            up = to_floor > p["floorFrom"]
            n_floors = abs(to_floor - p["floorFrom"])
            stair_suffix = f" ({p['stairName']})" if (p.get("stairName") and n_floors == 1) else ""
            floors_text = f"{n_floors} floors " if n_floors > 1 else ""

            add_step(
                {
                    "type": "stairs-up" if up else "stairs-down",
                    "instruction": f"Take the stairs {'up' if up else 'down'} {floors_text}to {_floor_label(to_floor)}{stair_suffix}",
                    "floor": p["floorFrom"],
                    "floorTo": to_floor,
                    "coordinate": p["coords"][0],
                    "coords": [p["coords"][0]],
                    "coordTo": pieces[j]["coordTo"],
                    "edgeName": p["name"],
                }
            )
            i = j + 1
            heading = None
            after_vertical = True
            last_zone = "indoor"
            continue

        dist = int(round(line_length(p["coords"])))
        h0 = _heading_at(p["coords"], False)
        h1 = _heading_at(p["coords"], True)
        inner = p["coords"][0] if p.get("up") is False else p["coords"][-1]
        mid_coord = p["coords"][len(p["coords"]) // 2]

        building = (
            p.get("building")
            or (building_at(inner) if building_at else None)
            or (building_at(mid_coord) if building_at else None)
            or "the building"
        )

        # Entrance stairs and ramps
        if p.get("kind") in ("entrance-stairs", "ramp"):
            is_ramp = p.get("kind") == "ramp"
            a_in = inside_building(p["coords"][0]) if inside_building else False
            z_in = inside_building(p["coords"][-1]) if inside_building else False
            direction = "in" if (not a_in and z_in) else ("out" if (a_in and not z_in) else None)

            if direction is None and dist < 3:
                heading = h1
                i += 1
                continue

            if is_ramp:
                if direction == "in":
                    instr = f"Take the PWD ramp up into {building}"
                elif direction == "out":
                    instr = f"Take the PWD ramp down and out of {building}"
                else:
                    instr = "Take the PWD ramp"
            else:
                if direction == "in":
                    instr = f"Climb the entrance stairs into {building}"
                elif direction == "out":
                    instr = f"Go down the entrance stairs out of {building}"
                else:
                    instr = "Take the entrance stairs"

            add_step(
                {
                    "type": "ramp" if is_ramp else ("stairs-down" if direction == "out" else "stairs-up"),
                    "instruction": instr,
                    "distanceMeters": dist,
                    "bearing": h0,
                    "floor": p["floorFrom"],
                    "coordinate": p["coords"][0],
                    "coords": p["coords"],
                    "edgeName": p["name"],
                }
            )
            heading = h1
            if direction == "out":
                last_zone = "outdoor"
            elif direction == "in":
                last_zone = "indoor"
            after_vertical = False
            i += 1
            continue

        # Transition from outdoor to indoor
        if last_zone == "outdoor" and p.get("zone") == "indoor":
            add_step(
                {
                    "type": "enter",
                    "instruction": f"Enter {building}",
                    "floor": p["floorFrom"],
                    "coordinate": p["coords"][0],
                    "coords": [p["coords"][0]],
                }
            )
            last_zone = "indoor"

        if p.get("zone") != "entrance":
            last_zone = p.get("zone", last_zone)

        is_door = p.get("kind") == "door"
        is_landing = p.get("kind") == "landing"
        is_first = len(steps) == 1
        step_type = "straight"

        if heading is None or h0 is None:
            dir_str = "" if h0 is None else f" {compass_name(h0)}"
            if after_vertical:
                lead = f"Leave the stairs and head{dir_str}"
            elif is_door and is_first:
                lead = f"Leave {p['name']} and head{dir_str}"
            else:
                lead = f"Head{dir_str}"
            step_type = "start-walk"
        else:
            delta = turn_angle(heading, h0)
            if abs(delta) < STRAIGHT_DEG:
                prev = steps[-1] if steps else None
                if (
                    prev
                    and prev.get("edgeName") == p["name"]
                    and prev.get("floor") == p["floorFrom"]
                    and prev.get("type") != "start"
                ):
                    prev["distanceMeters"] += dist
                    prev["coords"] = [*prev["coords"], *p["coords"][1:]]
                    heading = h1
                    i += 1
                    continue
                lead = "Continue straight"
            else:
                tw = _turn_word(delta)
                lead = tw["text"]
                step_type = tw["type"]

        # Fold sub-3m snapping slivers into previous step
        prev_step = steps[-1] if steps else None
        if (
            dist < 3
            and not is_door
            and not p.get("spur")
            and not is_landing
            and prev_step
            and prev_step.get("type") not in ("start", "stairs-up", "stairs-down", "arrive")
            and prev_step.get("floor") == p["floorFrom"]
            and not is_last
        ):
            prev_step["distanceMeters"] += dist
            prev_step["coords"] = [*prev_step["coords"], *p["coords"][1:]]
            heading = h1
            i += 1
            continue

        spur_label = (p["name"].split(" — ")[1] if " — " in p["name"] else p["name"]) if p.get("spur") else ""
        if p.get("spur") and (i + 1 < len(pieces) and pieces[i + 1].get("kind") == "stairs"):
            instruction = f"{lead} to the staircase"
        elif p.get("spur"):
            instruction = lead if after_vertical else f"{lead} toward {spur_label}"
        elif is_door:
            instruction = lead if (is_first and step_type == "start-walk") else f"{lead} to {p['name']}"
        elif is_landing:
            instruction = lead if after_vertical else f"{lead} to {p['name']}"
        else:
            instruction = f"{lead} along {p['name']}"

        add_step(
            {
                "type": "straight" if step_type == "start-walk" else step_type,
                "instruction": re.sub(r"\s+", " ", instruction).strip(),
                "distanceMeters": dist,
                "bearing": h0,
                "floor": p["floorFrom"],
                "coordinate": p["coords"][0],
                "coords": p["coords"],
                "edgeName": p["name"],
            }
        )
        heading = h1
        after_vertical = False
        i += 1

    end_coord = pieces[-1]["coords"][-1] if pieces else start_coord
    end_floor = ctx.get("endFloor") or (pieces[-1]["floorTo"] if pieces else 1)

    add_step(
        {
            "type": "arrive",
            "instruction": ctx.get("arriveText") or f"You have arrived at {ctx['toLabel']}",
            "floor": end_floor,
            "coordinate": end_coord,
            "coords": [end_coord],
        }
    )

    legs: List[Dict[str, Any]] = []
    stair_markers: List[Dict[str, Any]] = []
    for p in pieces:
        if p.get("kind") == "stairs":
            stair_markers.append(
                {
                    "floor": p["floorFrom"],
                    "toFloor": p["floorTo"],
                    "coordinate": p["coords"][0],
                    "name": p.get("stairName") or p["name"],
                }
            )
            stair_markers.append(
                {
                    "floor": p["floorTo"],
                    "toFloor": p["floorFrom"],
                    "coordinate": p["coordTo"],
                    "name": p.get("stairName") or p["name"],
                }
            )
            continue
        last_leg = legs[-1] if legs else None
        if last_leg and last_leg["floor"] == p["floorFrom"]:
            last_leg["coords"] = [*last_leg["coords"], *p["coords"][1:]]
        else:
            legs.append({"floor": p["floorFrom"], "coords": list(p["coords"])})

    floors: List[int] = []
    for s in steps:
        for f_val in (s.get("floor"), s.get("floorTo")):
            if f_val and f_val not in floors:
                floors.append(f_val)

    total_dist = int(
        round(
            sum(
                0.0 if p.get("kind") == "stairs" else line_length(p["coords"])
                for p in pieces
            )
        )
    )
    total_dur = int(round(sum(p.get("cost", 0.0) for p in pieces)))

    return {
        "distanceMeters": total_dist,
        "durationSeconds": total_dur,
        "coordinates": [c for leg in legs for c in leg["coords"]],
        "legs": legs,
        "floors": floors,
        "stairMarkers": stair_markers,
        "steps": steps,
        "start": {"coordinate": start_coord, "floor": steps[0]["floor"]},
        "end": {"coordinate": end_coord, "floor": steps[-1]["floor"]},
    }