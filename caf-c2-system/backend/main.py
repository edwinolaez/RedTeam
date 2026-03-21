# ============================================================
# CAF C2 System — FastAPI + WebSocket Backend
#
# Run:  uvicorn main:app --reload --port 8765
#
# WebSocket message formats (JSON):
#   React → Python  (command):
#     { "type":"command", "droneId":"UAV-01", "action":"TAKEOFF",
#       "params":{"altitude":10,"local_x":-40,"local_y":0},
#       "timestamp":"21:39:58Z" }
#
#   Python → React  (telemetry, every 500ms):
#     { "type":"telemetry", "droneId":"UAV-01", "lat":32.9901,
#       "lng":-106.9752, "altitude":9.8, "battery":84.2,
#       "speed":0.3, "heading":47.1, "flightMode":"GUIDED",
#       "armed":true, "timestamp":"21:39:59Z" }
#
#   Python → React  (ack):
#     { "type":"ack", "droneId":"UAV-01", "action":"TAKEOFF",
#       "status":"EXECUTING", "message":"UAV-01 armed and climbing to 10m",
#       "timestamp":"21:39:58Z" }
# ============================================================

import asyncio
import json
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import drone_controller as dc

# pymavlink multicast — same address the hackathon SITL uses
SITL_ADDRESS = "mcast:"


@asynccontextmanager
async def lifespan(app):
    asyncio.create_task(_connect_sitl())
    asyncio.create_task(telemetry_loop())
    yield


async def _connect_sitl():
    """Try pymavlink connection in background thread. Stays in STUB if unreachable."""
    loop = asyncio.get_event_loop()
    connected = await loop.run_in_executor(None, dc.connect, SITL_ADDRESS)
    if connected:
        print("[BACKEND] pymavlink connected — LIVE mode")
    else:
        print("[BACKEND] pymavlink unavailable — STUB mode")


app = FastAPI(title="CAF C2 Backend", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Compound telemetry state (New Mexico, local ENU coords) ──
# Compound center: 32.990°N, 106.975°W
# Positions approximate — drone starts at Landing Pad (-40, 0)
COMPOUND_LAT  =  32.990
COMPOUND_LNG  = -106.975
DEG_PER_METER =  0.000009  # ~1m in degrees at this latitude

def enu_to_latlng(enu_x: float, enu_y: float):
    """Convert compound ENU (x=East, y=North) to lat/lng for map display."""
    lat = COMPOUND_LAT + enu_y * DEG_PER_METER
    lng = COMPOUND_LNG + enu_x * DEG_PER_METER
    return round(lat, 6), round(lng, 6)

# UAV-01 starts at Landing Pad (-40, 0)
_uav01_lat, _uav01_lng = enu_to_latlng(-40, 0)

FLEET_STATE = {
    "UAV-01": {"lat": _uav01_lat, "lng": _uav01_lng, "altitude": 0,
                "battery": 95.0, "speed": 0, "heading": 353,
                "flightMode": "STANDBY", "armed": False,
                "local_x": -40, "local_y": 0},
}

active_connections: list[WebSocket] = []


def zulu_now() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%SZ")


async def broadcast(message: dict):
    data = json.dumps(message)
    for ws in list(active_connections):
        try:
            await ws.send_text(data)
        except Exception:
            active_connections.remove(ws)


async def telemetry_loop():
    """Push UAV-01 telemetry every 500ms."""
    import random
    while True:
        state = FLEET_STATE["UAV-01"]
        if state["flightMode"] not in ("STANDBY", "HOLD", "LOITER"):
            state["battery"] = max(0.0, state["battery"] - 0.01)

        await broadcast({
            "type":       "telemetry",
            "droneId":    "UAV-01",
            "lat":        state["lat"],
            "lng":        state["lng"],
            "altitude":   state["altitude"],
            "battery":    round(state["battery"], 1),
            "speed":      state["speed"],
            "heading":    state["heading"],
            "flightMode": state["flightMode"],
            "armed":      state["armed"],
            "timestamp":  zulu_now(),
        })
        await asyncio.sleep(0.5)


@app.get("/health")
async def health():
    return {
        "status":   "online",
        "datalink": "LIVE" if dc.is_connected() else "SIMULATED",
        "sitl":     SITL_ADDRESS,
        "timestamp": zulu_now(),
    }


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    active_connections.append(ws)
    print(f"[WS] Client connected — {len(active_connections)} active")
    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "command":
                drone_id = msg.get("droneId", "UAV-01")
                action   = msg.get("action", "")
                params   = msg.get("params", {})

                try:
                    result = await dc.dispatch(drone_id, action, params)
                except Exception as e:
                    result = f"{action} FAILED: {e}"
                    print(f"[CMD] {result}")

                # Mirror command to simulated state for map display
                state = FLEET_STATE.get("UAV-01", {})
                if action == "TAKEOFF":
                    state["altitude"]   = params.get("altitude", 10)
                    state["flightMode"] = "GUIDED"
                    state["armed"]      = True
                elif action == "LAND":
                    state["altitude"]   = 0
                    state["flightMode"] = "STANDBY"
                    state["armed"]      = False
                elif action in ("HOLD", "HOVER"):
                    state["flightMode"] = "LOITER"
                elif action == "RTB":
                    state["flightMode"] = "RTL"
                    state["local_x"]    = -40
                    state["local_y"]    = 0
                    lat, lng = enu_to_latlng(-40, 0)
                    state["lat"], state["lng"] = lat, lng
                elif action in ("GOTO", "SCOUT", "MOVE", "DESCEND", "ASCEND"):
                    lx = params.get("local_x", state.get("local_x", -40))
                    ly = params.get("local_y", state.get("local_y", 0))
                    state["local_x"] = lx
                    state["local_y"] = ly
                    lat, lng = enu_to_latlng(lx, ly)
                    state["lat"], state["lng"] = lat, lng
                    state["altitude"]   = params.get("altitude", state["altitude"])
                    state["flightMode"] = "GUIDED"

                await ws.send_text(json.dumps({
                    "type":      "ack",
                    "droneId":   drone_id,
                    "action":    action,
                    "status":    "EXECUTING",
                    "message":   result,
                    "timestamp": zulu_now(),
                }))

    except WebSocketDisconnect:
        active_connections.remove(ws)
        print(f"[WS] Client disconnected — {len(active_connections)} active")
