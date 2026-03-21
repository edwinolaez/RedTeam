# ============================================================
# CAF C2 System — Drone Controller (pymavlink)
#
# Uses pymavlink multicast connection (mcast:) — same protocol
# the hackathon SITL uses. No TCP/UDP config needed.
#
# Stub mode: if pymavlink isn't installed or SITL isn't running,
# all handlers return STUB strings so the server keeps running.
# ============================================================

import asyncio
import math

try:
    from pymavlink import mavutil as _mavutil
    _PYMAVLINK_AVAILABLE = True
except ImportError:
    _PYMAVLINK_AVAILABLE = False
    print("[DRONE] pymavlink not installed — running in STUB mode")

_mav = None  # single MAVLink connection shared across all calls


# ── ENU → NED conversion ─────────────────────────────────────
# Compound uses ENU (x=East, y=North). pymavlink uses NED.
def enu_to_ned(enu_x: float, enu_y: float, altitude: float):
    return enu_y, enu_x, -altitude   # north, east, down


# ── Connection ────────────────────────────────────────────────

def connect(address: str = "mcast:") -> bool:
    """Connect via pymavlink. Returns True if successful."""
    global _mav
    if not _PYMAVLINK_AVAILABLE:
        return False
    try:
        _mav = _mavutil.mavlink_connection(address)
        _mav.wait_heartbeat(timeout=10)
        print(f"[DRONE] Connected via {address} — heartbeat received")
        # Request all telemetry streams at 4 Hz
        _mav.mav.request_data_stream_send(
            _mav.target_system, _mav.target_component,
            _mavutil.mavlink.MAV_DATA_STREAM_ALL, 4, 1)
        return True
    except Exception as e:
        print(f"[DRONE] Connection failed: {e} — STUB mode")
        _mav = None
        return False


def is_connected() -> bool:
    return _mav is not None


# ── Command handlers ──────────────────────────────────────────

async def cmd_takeoff(altitude: float = 10.0) -> str:
    if not is_connected():
        return f"TAKEOFF to {altitude}m — STUB"
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _do_takeoff, altitude)


def _do_takeoff(altitude: float) -> str:
    try:
        _mav.set_mode(_mav.mode_mapping()["GUIDED"])
        _mav.arducopter_arm()
        _mav.motors_armed_wait()
        _mav.mav.command_long_send(
            _mav.target_system, _mav.target_component,
            _mavutil.mavlink.MAV_CMD_NAV_TAKEOFF,
            0, 0, 0, 0, 0, 0, 0, altitude)
        return f"TAKEOFF to {altitude}m — LIVE"
    except Exception as e:
        return f"TAKEOFF FAILED: {e}"


async def cmd_land() -> str:
    if not is_connected():
        return "LAND — STUB"
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _do_land)


def _do_land() -> str:
    try:
        _mav.set_mode(_mav.mode_mapping()["LAND"])
        return "LAND — LIVE"
    except Exception as e:
        return f"LAND FAILED: {e}"


async def cmd_goto(enu_x: float, enu_y: float, altitude: float = 10.0) -> str:
    if not is_connected():
        return f"GOTO ENU({enu_x:.1f},{enu_y:.1f}) alt={altitude}m — STUB"
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _do_goto, enu_x, enu_y, altitude)


def _do_goto(enu_x: float, enu_y: float, altitude: float) -> str:
    try:
        north, east, down = enu_to_ned(enu_x, enu_y, altitude)
        _mav.mav.set_position_target_local_ned_send(
            0,
            _mav.target_system, _mav.target_component,
            _mavutil.mavlink.MAV_FRAME_LOCAL_NED,
            0b0000111111111000,   # position-only
            north, east, down,
            0, 0, 0, 0, 0, 0, 0, 0)
        return f"GOTO ENU({enu_x:.1f},{enu_y:.1f}) alt={altitude}m — LIVE"
    except Exception as e:
        return f"GOTO FAILED: {e}"


async def cmd_rtb() -> str:
    if not is_connected():
        return "RTB — STUB"
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _do_rtb)


def _do_rtb() -> str:
    try:
        _mav.set_mode(_mav.mode_mapping()["RTL"])
        return "RTB — LIVE"
    except Exception as e:
        return f"RTB FAILED: {e}"


async def cmd_hold() -> str:
    if not is_connected():
        return "HOLD — STUB"
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _do_hold)


def _do_hold() -> str:
    try:
        _mav.set_mode(_mav.mode_mapping()["LOITER"])
        return "HOLD/HOVER — LIVE"
    except Exception as e:
        return f"HOLD FAILED: {e}"


async def cmd_report() -> str:
    if not is_connected():
        return "REPORT — STUB (no telemetry)"
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _do_report)


def _do_report() -> str:
    try:
        msg = _mav.recv_match(type="LOCAL_POSITION_NED", blocking=True, timeout=3)
        if msg:
            # Convert NED back to ENU for display
            enu_x = msg.y   # east
            enu_y = msg.x   # north
            alt = -msg.z    # up
            return f"POSITION: ENU({enu_x:.1f},{enu_y:.1f}) alt={alt:.1f}m — LIVE"
        return "REPORT: no position data"
    except Exception as e:
        return f"REPORT FAILED: {e}"


# ── Dispatch ─────────────────────────────────────────────────

async def dispatch(drone_id: str, action: str, params: dict) -> str:
    action = action.upper()
    if action == "TAKEOFF":
        return await cmd_takeoff(params.get("altitude", 10.0))
    elif action == "LAND":
        return await cmd_land()
    elif action in ("GOTO", "MOVE", "SCOUT"):
        return await cmd_goto(
            params.get("local_x", 0),
            params.get("local_y", 0),
            params.get("altitude", 10.0))
    elif action == "RTB":
        return await cmd_rtb()
    elif action in ("HOLD", "HOVER"):
        return await cmd_hold()
    elif action == "REPORT":
        return await cmd_report()
    elif action in ("DESCEND", "ASCEND"):
        # Move to same XY, new altitude
        return await cmd_goto(
            params.get("local_x", 0),
            params.get("local_y", 0),
            params.get("altitude", 10.0))
    else:
        return f"{action} — no handler (STUB)"
