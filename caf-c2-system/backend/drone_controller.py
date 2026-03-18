# ============================================================
# CAF C2 System — Drone Controller (Step 9 — STUB MODE)
# MAVSDK is commented out until hackathon event (Step 10).
# All handlers return stub strings so the server runs now.
# At Step 10: pip install mavsdk, uncomment MAVSDK lines.
# ============================================================

import asyncio

# TODO Step 10: from mavsdk import System
# TODO Step 10: _drones: dict[str, System] = {}
_drones: dict = {}


async def connect_drone(drone_id: str, udp_port: int) -> str:
    print(f"[STUB] connect_drone {drone_id} port {udp_port}")
    return drone_id


def get_drone(drone_id: str):
    return _drones.get(drone_id)


# ── Command handlers (all stubbed) ───────────────────────────

async def cmd_takeoff(drone_id: str, altitude: float = 20.0) -> str:
    # TODO Step 10: drone = get_drone(drone_id); await drone.action.arm(); await drone.action.takeoff()
    return f"{drone_id} TAKEOFF to {altitude}m — STUB"


async def cmd_land(drone_id: str) -> str:
    # TODO Step 10: await get_drone(drone_id).action.land()
    return f"{drone_id} LAND — STUB"


async def cmd_goto(drone_id: str, lat: float, lng: float, alt: float = 50.0) -> str:
    # TODO Step 10: await get_drone(drone_id).action.goto_location(lat, lng, alt, 0)
    return f"{drone_id} GOTO {lat:.4f},{lng:.4f} alt={alt}m — STUB"


async def cmd_rtb(drone_id: str) -> str:
    # TODO Step 10: await get_drone(drone_id).action.return_to_launch()
    return f"{drone_id} RTB — STUB"


async def cmd_hold(drone_id: str) -> str:
    # TODO Step 10: await get_drone(drone_id).action.hold()
    return f"{drone_id} HOLD — STUB"


# ── Dispatch ─────────────────────────────────────────────────

async def dispatch(drone_id: str, action: str, params: dict) -> str:
    action = action.upper()
    if action == "TAKEOFF":
        return await cmd_takeoff(drone_id, params.get("altitude", 20.0))
    elif action == "LAND":
        return await cmd_land(drone_id)
    elif action in ("GOTO", "MOVE"):
        return await cmd_goto(drone_id, params.get("lat", 0), params.get("lng", 0), params.get("altitude", 50.0))
    elif action == "RTB":
        return await cmd_rtb(drone_id)
    elif action == "HOLD":
        return await cmd_hold(drone_id)
    else:
        return f"{drone_id} {action} — no handler yet (STUB)"
