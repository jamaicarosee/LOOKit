"""
Offline checks for services/ai_search_service.py (no Supabase, no Gemini, no network needed).

Run from the backend folder:   python scripts/verify_ai_search.py

Covers: keyword fallback, hallucination guardrail, every fallback reason, caching, rate limiters.
The FastAPI route itself is checked manually (see the steps in the feature notes).
"""
import asyncio
import dataclasses
import os
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Stub the Supabase-backed modules so importing the service needs no credentials.
fake_db = types.ModuleType("database")
fake_db.supabase = object()
sys.modules["database"] = fake_db
os.environ.pop("GEMINI_API_KEY", None)

from services import ai_search_service as ai  # noqa: E402
from services.graph_service import campus_graph_service  # noqa: E402


def room(cid, name, building, floor, category="office", code=None):
    return {"id": cid, "name": name, "fullName": name, "type": "room", "building": building,
            "floor": floor, "category": category, "code": code or cid, "keywords": ai._norm(f"{name} {category}")}


campus_graph_service.locations = [
    room("F2-JAV-REG@F2", "Registrar's Office", "Javier Building", 2),
    room("F1-JAV-REG@F1", "Registrar Annex", "Javier Building", 1),
    room("MAE-ICSLAB1@F3", "Computer Laboratory 1", "M.A.E Building", 3, "laboratory"),
    room("MAE-ICSOFFICE@F2", "ICS Office", "M.A.E Building", 2),
    room("F2-JAV-GSU@F2", "General Services Unit", "Javier Building", 2, "office", "F2-JAV-GSU"),
    room("F2-JAV-RMS@F2", "Records Management Section", "Javier Building", 2),
    {"id": "building:Javier Building", "name": "Javier", "fullName": "Javier Building", "type": "building",
     "building": "Javier Building", "floor": None, "keywords": "javier building"},
    {"id": "gate:Gate 1", "name": "Gate 1", "fullName": "Gate 1", "type": "gate", "building": None,
     "floor": 1, "keywords": "gate 1 gate entrance exit"},
    {"id": "stairs:1", "name": "Stairs", "type": "stairs"},  # must be ignored
]
campus_graph_service._loaded = True
campus_graph_service.reload_graph = lambda: {}

fake_staff_router = types.ModuleType("routers.staff")
fake_staff_router.get_all_staff = lambda: {"staff": [
    {"id": 7, "name": "Instr. Emerson B. Juales", "position": "Head", "office": "General Services Unit",
     "secondaryOffice": "", "secondaryPosition": "", "groups": ["offices"], "section": "offices",
     "office_location_id": 5, "officeLocationId": 5, "room_code": "F2-JAV-GSU", "email": "secret@rtu.edu.ph"},
]}
sys.modules["routers.staff"] = fake_staff_router

failures = 0


def check(label, ok, extra=""):
    global failures
    failures += 0 if ok else 1
    print(("PASS " if ok else "FAIL ") + label + (f"  [{extra}]" if extra and not ok else ""))


def ids(result):
    return [m["id"] for m in result["matches"]]


async def main():
    # --- catalog ---
    cat = ai.build_catalog(include_staff=True)
    check("catalog skips non-searchable types", "stairs:1" not in cat.by_id)
    check("staff ids are namespaced", "staff:7" in cat.by_id)
    check("guest catalog has no staff", "staff:7" not in ai.build_catalog(False).by_id)
    check("staff email never reaches the record", "email" not in cat.by_id["staff:7"].raw)
    check("staff gets building/floor from their room", cat.by_id["staff:7"].floor == 2)

    # --- keyword fallback (no API key -> ai_not_configured) ---
    r = await ai.search("where is the registrar on the 2nd floor", include_staff=True)
    check("no key -> fallback_used", r["fallback_used"] and r["fallback_reason"] == "ai_not_configured")
    check("floor hint ranks floor 2 registrar first", ids(r)[:1] == ["F2-JAV-REG@F2"], ids(r))
    r = await ai.search("computer lab or IT office", include_staff=False)
    check("'A or B' query returns both", {"MAE-ICSLAB1@F3", "MAE-ICSOFFICE@F2"} <= set(ids(r)), ids(r))
    r = await ai.search("who handles campus facilities", include_staff=True)
    check("pure keyword fallback finds nothing invented", all(i in cat.by_id for i in ids(r)))
    r = await ai.search("xqzv nonsense", include_staff=True)
    check("gibberish -> empty matches, no crash", r["matches"] == [] and r["fallback_used"])

    # --- AI path (Gemini call replaced by a fake) ---
    ai.SETTINGS = dataclasses.replace(ai.SETTINGS, api_key="test-key")
    ai._global_minute.limit = 0  # disable global guard for these cases
    ai._global_day.limit = 0

    async def good(query, entries, limit):
        return [{"id": "F2-JAV-GSU@F2", "reason": "General services handles facilities.", "confidence": 0.9},
                {"id": "staff:7", "reason": "Heads that unit.", "confidence": 0.7}]
    ai._ask_gemini = good
    r = await ai.search("who handles campus facilities", include_staff=True)
    check("AI success -> fallback_used false", not r["fallback_used"] and ids(r) == ["F2-JAV-GSU@F2", "staff:7"], ids(r))
    check("category + item hydrated from catalog", r["matches"][1]["category"] == "staff" and r["matches"][1]["item"]["name"].startswith("Instr."))

    async def mixed(query, entries, limit):
        return [{"id": "F9-FAKE-ROOM", "reason": "invented", "confidence": 0.99},
                {"id": "F2-JAV-REG@F2", "reason": "x" * 400, "confidence": 7},
                {"id": "F2-JAV-REG@F2", "reason": "dup", "confidence": 0.5}]
    ai._ask_gemini = mixed
    r = await ai.search("registrar mixed", include_staff=False)
    check("unknown ids dropped, duplicates removed", ids(r) == ["F2-JAV-REG@F2"], ids(r))
    check("confidence clamped, reason capped",
          r["matches"][0]["confidence"] == 1.0 and len(r["matches"][0]["reason"]) <= ai.MAX_REASON_CHARS)

    async def all_fake(query, entries, limit):
        return [{"id": "NOPE-1", "reason": "r", "confidence": 0.9}]
    ai._ask_gemini = all_fake
    r = await ai.search("registrar all fake", include_staff=False)
    check("model returning only fake ids -> keyword fallback", r["fallback_used"] and r["fallback_reason"] == "invalid_ai_output")
    check("...and still gives real results", ids(r)[:1] == ["F2-JAV-REG@F2"] or "F1-JAV-REG@F1" in ids(r), ids(r))

    async def empty(query, entries, limit):
        return []
    ai._ask_gemini = empty
    r = await ai.search("registrar empty answer", include_staff=False)
    check("valid empty AI answer is respected", r["matches"] == [] and not r["fallback_used"])

    for reason in ("rate_limited", "timeout", "ai_error", "invalid_ai_output"):
        async def boom(query, entries, limit, _r=reason):
            raise ai.AIUnavailable(_r, 30 if _r == "rate_limited" else None)
        ai._ask_gemini = boom
        r = await ai.search(f"registrar {reason}", include_staff=False)
        check(f"AI failure '{reason}' -> clean fallback",
              r["fallback_used"] and r["fallback_reason"] == reason and r["message"] and len(r["matches"]) > 0)

    async def crash(query, entries, limit):
        raise RuntimeError("unexpected")
    ai._ask_gemini = crash
    r = await ai.search("registrar crash", include_staff=False)
    check("unexpected exception -> ai_error fallback, no raise", r["fallback_used"] and r["fallback_reason"] == "ai_error")

    # --- cache: identical query must not call the AI twice ---
    calls = {"n": 0}

    async def counted(query, entries, limit):
        calls["n"] += 1
        return [{"id": "F2-JAV-REG@F2", "reason": "ok", "confidence": 0.8}]
    ai._ask_gemini = counted
    await ai.search("Where is the REGISTRAR?", include_staff=False)
    await ai.search("where is the registrar", include_staff=False)
    check("repeat query served from cache", calls["n"] == 1, calls)

    # --- gates ---
    ai._global_minute = ai.SlidingWindowLimiter(2, 60)
    ai._ask_gemini = counted
    outs = [await ai.search(f"registrar gate {i}", include_staff=False) for i in range(3)]
    check("global per-minute guard -> quota_guard fallback",
          [o["fallback_reason"] for o in outs] == [None, None, "quota_guard"], [o["fallback_reason"] for o in outs])
    ai._global_minute = ai.SlidingWindowLimiter(0, 60)
    ai._cooldown_until = ai.time.monotonic() + 30
    r = await ai.search("registrar cooldown", include_staff=False)
    check("cooldown after Gemini 429 skips the AI", r["fallback_reason"] == "ai_cooldown")
    ai._cooldown_until = 0.0

    # --- client limiter ---
    lim = ai.SlidingWindowLimiter(3, 60)
    res = [lim.hit("ip:1")[0] for _ in range(4)] + [lim.hit("ip:2")[0]]
    check("client limiter blocks the 4th hit, other clients unaffected", res == [True, True, True, False, True], res)
    check("retry_after is positive", lim.hit("ip:1")[1] >= 1)

    # --- input helpers ---
    check("clean_query trims/collapses", ai.clean_query("  hello \n\t world\x00 ") == "hello world")
    check("emails and phone numbers redacted for the prompt",
          "@" not in ai.redact_for_prompt("mail me a@b.com or 0917 123 4567 about registrar"))
    print(f"\n{'ALL CHECKS PASSED' if not failures else str(failures) + ' CHECK(S) FAILED'}")
    sys.exit(1 if failures else 0)


asyncio.run(main())
