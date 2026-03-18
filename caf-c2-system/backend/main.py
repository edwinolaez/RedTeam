# ============================================================
# CAF C2 System — FastAPI + WebSocket Backend (Step 9)
#
# Run:  uvicorn main:app --reload --port 8765
#
# Two endpoints:
#   GET  /health          — server status
#   WS   /ws              — bidirectional command/telemetry channel
#
# Message formats (JSON):
#   React → Python  (command):
#     { "type":"command", "droneId":"UAV-01", "action":"TAKEOFF",
#       "params":{"altitude":20}, "timestamp":"21:39:58Z" }
#
#   Python → React  (telemetry, every 500ms):
#     { "type":"telemetry", "droneId":"UAV-01", "lat":49.2831,
#       "lng":-123.1205, "altitude":18.4, "battery":84.2,
#       "speed":0.3, "heading":47.1, "flightMode":"HOLD",
#       "armed":true, "timestamp":"21:39:59Z" }
#
#   Python → React  (ack):
#     { "type":"ack", "droneId":"UAV-01", "action":"TAKEOFF",
#       "status":"EXECUTING", "message":"UAV-01 climbing to 20m",
#       "timestamp":"21:39:58Z" }
# ============================================================

import asyncio
import json
from datetime import datetime, timezone

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from drone_controller import dispatch

@asynccontextmanager
async def lifespan(app):
    asyncio.create_task(telemetry_loop())
    yield

app = FastAPI(title="CAF C2 Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory simulated telemetry state ─────────────────────
# Replace with real MAVSDK telemetry in Step 10
FLEET_STATE = {
    "UAV-01": {"lat": 49.2827, "lng": -123.1207, "altitude": 0,   "battery": 87.0, "speed": 0,  "heading": 45,  "flightMode": "HOLD",    "armed": False},
    "UAV-02": {"lat": 49.2950, "lng": -123.1050, "altitude": 150, "battery": 62.0, "speed": 45, "heading": 270, "flightMode": "LOITER",  "armed": True},
    "UGV-01": {"lat": 49.2700, "lng": -123.1350, "altitude": 0,   "battery": 73.0, "speed": 12, "heading": 90,  "flightMode": "PATROL",  "armed": False},
    "UGV-02": {"lat": 49.2650, "lng": -123.1500, "altitude": 0,   "battery": 100.0,"speed": 0,  "heading": 0,   "flightMode": "STANDBY", "armed": False},
    "USV-01": {"lat": 49.3100, "lng": -123.1800, "altitude": 0,   "battery": 55.0, "speed": 8,  "heading": 180, "flightMode": "PATROL",  "armed": False},
    "UUV-01": {"lat": 49.3200, "lng": -123.2000, "altitude": -30, "battery": 91.0, "speed": 0,  "heading": 0,   "flightMode": "STANDBY", "armed": False},
}

active_connections: list[WebSocket] = []


def zulu_now() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%SZ")


async def broadcast(message: dict):
    """Send a message to all connected WebSocket clients."""
    data = json.dumps(message)
    for ws in list(active_connections):
        try:
            await ws.send_text(data)
        except Exception:
            active_connections.remove(ws)


async def telemetry_loop():
    """Push telemetry for all drones every 500ms."""
    import random
    while True:
        for drone_id, state in FLEET_STATE.items():
            # Simulate minor position drift for active units
            if state["flightMode"] not in ("STANDBY", "HOLD"):
                state["lat"]     += (random.random() - 0.5) * 0.0002
                state["lng"]     += (random.random() - 0.5) * 0.0002
                state["battery"] -= 0.01
                state["battery"]  = max(0.0, state["battery"])

            await broadcast({
                "type":       "telemetry",
                "droneId":    drone_id,
                "lat":        round(state["lat"], 5),
                "lng":        round(state["lng"], 5),
                "altitude":   state["altitude"],
                "battery":    round(state["battery"], 1),
                "speed":      state["speed"],
                "heading":    state["heading"],
                "flightMode": state["flightMode"],
                "armed":      state["armed"],
                "timestamp":  zulu_now(),
            })
        await asyncio.sleep(0.5)


# startup handled by lifespan context manager above


@app.get("/health")
async def health():
    return {
        "status":    "online",
        "drones":    list(FLEET_STATE.keys()),
        "datalink":  "SIMULATED",  # becomes "LIVE" when MAVSDK connects
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
                drone_id = msg.get("droneId", "")
                action   = msg.get("action", "")
                params   = msg.get("params", {})

                # Dispatch to MAVSDK (stubbed in Step 9)
                result = await dispatch(drone_id, action, params)

                # Update simulated state
                if drone_id in FLEET_STATE:
                    if action == "TAKEOFF":
                        FLEET_STATE[drone_id]["altitude"]   = params.get("altitude", 20)
                        FLEET_STATE[drone_id]["flightMode"] = "TAKEOFF"
                        FLEET_STATE[drone_id]["armed"]      = True
                    elif action == "LAND":
                        FLEET_STATE[drone_id]["altitude"]   = 0
                        FLEET_STATE[drone_id]["flightMode"] = "STANDBY"
                        FLEET_STATE[drone_id]["armed"]      = False
                    elif action == "HOLD":
                        FLEET_STATE[drone_id]["flightMode"] = "HOLD"
                    elif action == "RTB":
                        FLEET_STATE[drone_id]["flightMode"] = "RTB"

                # Send ack back to React
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
