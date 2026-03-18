// ============================================================
// CAF VOICE-ENABLED C2 SYSTEM
// Step 7 — Tactical Canvas Map + Command Log (COMPLETE)
// ============================================================
//
// WHAT'S NEW IN THIS STEP:
// - HTML5 Canvas tactical map (useRef + useEffect)
// - UxS position markers with domain icons
// - IFF contact markers (FRIEND/FOE/UNKNOWN color coded)
// - Movement heading vectors (direction arrows)
// - Grid coordinate overlay
// - Map legend
// - Selected unit highlight on map
// - Command execution pulse animation on map
// - Full command log with filter tabs
//
// THIS IS THE COMPLETE SYSTEM — all 7 steps integrated
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// DESIGN SYSTEM
// ─────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap');
  :root {
    --bg-void:#000000; --bg-panel:#050a06; --bg-card:#0a110b;
    --bg-highlight:#0d1f0f; --green-primary:#00ff41; --green-dim:#00c032;
    --green-muted:#1a3d1e; --cyan-air:#00d4ff; --amber-land:#f59e0b;
    --purple-sea:#a78bfa; --red-alert:#ef4444; --text-primary:#d1ffd9;
    --text-dim:#4a7a52; --border:#0d2e12;
    --font-mono:'Share Tech Mono',monospace;
    --font-display:'Orbitron',sans-serif;
    --font-ui:'Rajdhani',sans-serif;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:var(--bg-void);color:var(--text-primary);font-family:var(--font-mono);overflow:hidden;}
  body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,65,0.015) 2px,rgba(0,255,65,0.015) 4px);pointer-events:none;z-index:9999;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:var(--bg-panel);}
  ::-webkit-scrollbar-thumb{background:var(--green-muted);border-radius:2px;}
  @keyframes pulse{0%,100%{transform:scale(1);opacity:0.4;}50%{transform:scale(1.8);opacity:0;}}
  @keyframes transmitPulse{0%,100%{box-shadow:0 0 10px var(--red-alert),0 0 20px rgba(239,68,68,0.3);}50%{box-shadow:0 0 20px var(--red-alert),0 0 40px rgba(239,68,68,0.5);}}
  @keyframes parsePulse{0%,100%{opacity:0.4;}50%{opacity:1;}}
  @keyframes wave1{0%,100%{height:4px}50%{height:16px}}
  @keyframes wave2{0%,100%{height:8px}50%{height:20px}}
  @keyframes wave3{0%,100%{height:12px}50%{height:6px}}
  @keyframes wave4{0%,100%{height:6px}50%{height:18px}}
  @keyframes wave5{0%,100%{height:10px}50%{height:4px}}
  @keyframes modalIn{from{opacity:0;transform:scale(0.95);}to{opacity:1;transform:scale(1);}}
  @keyframes alertFlash{0%,100%{border-color:var(--red-alert);}50%{border-color:transparent;}}
  @keyframes mapPulse{0%{transform:scale(0.5);opacity:1;}100%{transform:scale(3);opacity:0;}}
  @keyframes slideIn{from{transform:translateX(100%);opacity:0;}to{transform:translateX(0);opacity:1;}}
  @keyframes briefIn{from{transform:translateY(-20px);opacity:0;}to{transform:translateY(0);opacity:1;}}
  @keyframes batteryFlash{0%,100%{border-color:var(--red-alert);box-shadow:0 0 8px rgba(239,68,68,0.4);}50%{border-color:transparent;box-shadow:none;}}
  .bat-critical{animation:batteryFlash 1.2s ease-in-out infinite!important;}
  .uxs-card{transition:background 0.15s ease,border-color 0.15s ease;cursor:pointer;}
  .uxs-card:hover{background:var(--bg-highlight)!important;}
  .transmit-btn{transition:all 0.15s ease;cursor:pointer;border:none;outline:none;}
  .transmit-btn:hover:not(:disabled){transform:translateY(-1px);}
  .kbd{display:inline-block;padding:1px 5px;background:var(--bg-highlight);border:1px solid var(--border);font-family:var(--font-mono);font-size:9px;color:var(--text-dim);border-radius:2px;}
`;

// ─────────────────────────────────────────────────────────────
// CONSTANTS & DATA
// ─────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  {key:"VOICE",  label:"VOICE",   color:"var(--green-primary)"},
  {key:"PARSE",  label:"PARSE",   color:"var(--cyan-air)"},
  {key:"IFF",    label:"IFF",     color:"var(--amber-land)"},
  {key:"CONFIRM",label:"CONFIRM", color:"#f97316"},
  {key:"EXECUTE",label:"EXECUTE", color:"var(--red-alert)"},
];

const HIGH_RISK_ACTIONS = ["STRIKE","ENGAGE","FIRE","DESTROY","ATTACK","NEUTRALIZE","ELIMINATE","LAUNCH","ARM"];
const clamp = (v,mn,mx) => Math.max(mn,Math.min(mx,v));
const zuluNow = () => new Date().toUTCString().slice(17,25)+"Z";

const INITIAL_UXS = [
  {id:"UAV-01",label:"Raven Alpha", domain:"AIR",     status:"STANDBY",  battery:87, signal:94,altitude:0,  speed:0, heading:45, lat:49.2827,lng:-123.1207,payload:"EO/IR Sensor",   armed:false,mission:"RECON",     tasks:[]},
  {id:"UAV-02",label:"Hawk Bravo",  domain:"AIR",     status:"ACTIVE",   battery:62, signal:88,altitude:150,speed:45,heading:270,lat:49.2950,lng:-123.1050,payload:"Munition x2",    armed:true, mission:"STRIKE",    tasks:["Loiter Grid-7"]},
  {id:"UGV-01",label:"Timber Wolf", domain:"LAND",    status:"EXECUTING",battery:73, signal:79,altitude:0,  speed:12,heading:90, lat:49.2700,lng:-123.1350,payload:"LIDAR + Camera", armed:false,mission:"PATROL",    tasks:["Advance Checkpoint-Delta"]},
  {id:"UGV-02",label:"Iron Badger", domain:"LAND",    status:"STANDBY",  battery:100,signal:91,altitude:0,  speed:0, heading:0,  lat:49.2650,lng:-123.1500,payload:"EOD Suite",      armed:false,mission:"EOD",       tasks:[]},
  {id:"USV-01",label:"Triton One",  domain:"MARITIME",status:"ACTIVE",   battery:55, signal:72,altitude:0,  speed:8, heading:180,lat:49.3100,lng:-123.1800,payload:"Sonar + Radar",  armed:false,mission:"ISR",       tasks:["Patrol Sector-Bravo"]},
  {id:"UUV-01",label:"Deep Ghost",  domain:"MARITIME",status:"STANDBY",  battery:91, signal:43,altitude:-30,speed:0, heading:0,  lat:49.3200,lng:-123.2000,payload:"Acoustic Sensor",armed:false,mission:"SUBSURFACE",tasks:[]},
];

const CONTACTS = [
  {id:"C-001",iff:"FRIEND", label:"Alpha Platoon",    type:"GROUND_UNIT", lat:49.2700,lng:-123.1300},
  {id:"C-002",iff:"FOE",    label:"Hostile Victor-1", type:"VEHICLE",     lat:49.2900,lng:-123.1100},
  {id:"C-003",iff:"UNKNOWN",label:"Contact Unknown-3",type:"DISMOUNT",    lat:49.3100,lng:-123.1200},
  {id:"C-004",iff:"FRIEND", label:"Bravo Section",    type:"GROUND_UNIT", lat:49.2600,lng:-123.1500},
  {id:"C-005",iff:"FOE",    label:"Hostile Papa-7",   type:"EMPLACEMENT", lat:49.3000,lng:-123.0900},
];

const DOMAIN_META = {
  AIR:     {color:"#00d4ff",  hex:"#00d4ff", icon:"✈",label:"AIR"},
  LAND:    {color:"#f59e0b",  hex:"#f59e0b", icon:"⬡",label:"LAND"},
  MARITIME:{color:"#a78bfa",  hex:"#a78bfa", icon:"◈",label:"SEA"},
};
const STATUS_META = {
  STANDBY:  {color:"#6b7280",bg:"#1a1f1a",label:"STANDBY"},
  ACTIVE:   {color:"#00ff41",bg:"#0a1f0c",label:"ACTIVE"},
  EXECUTING:{color:"#f59e0b",bg:"#1f1500",label:"EXECUTING"},
  ALERT:    {color:"#ef4444",bg:"#1f0a0a",label:"ALERT"},
  RTB:      {color:"#a78bfa",bg:"#130f1f",label:"RTB"},
  OFFLINE:  {color:"#374151",bg:"#111111",label:"OFFLINE"},
};
const IFF_META = {
  FRIEND: {color:"#00ff41",bg:"rgba(0,255,65,0.1)",   label:"FRIEND"},
  FOE:    {color:"#ef4444",bg:"rgba(239,68,68,0.1)",  label:"FOE"},
  UNKNOWN:{color:"#f59e0b",bg:"rgba(245,158,11,0.1)", label:"UNKNOWN"},
  NEUTRAL:{color:"#6b7280",bg:"rgba(107,114,128,0.1)",label:"NEUTRAL"},
};

const WAYPOINTS = [
  {id:"WP-A", label:"Waypoint Alpha",   lat:49.2827, lng:-123.1207},
  {id:"WP-B", label:"Waypoint Bravo",   lat:49.2900, lng:-123.1100},
  {id:"WP-C", label:"Waypoint Charlie", lat:49.2750, lng:-123.1300},
  {id:"WP-D", label:"Waypoint Delta",   lat:49.2680, lng:-123.1450},
  {id:"WP-E", label:"Waypoint Echo",    lat:49.3050, lng:-123.1650},
  {id:"WP-F", label:"Waypoint Foxtrot", lat:49.3150, lng:-123.1950},
];

// ─────────────────────────────────────────────────────────────
// IFF ENGINE (from Step 6)
// ─────────────────────────────────────────────────────────────
function runIFFCheck(parsedCommand, uxsList, contacts) {
  const flags=[], warnings=[];
  let requiresConfirm=false;
  const action=(parsedCommand.action||"").toUpperCase();
  const targets=parsedCommand.targets||[];
  const isHighRiskAction=HIGH_RISK_ACTIONS.includes(action);
  if(isHighRiskAction){flags.push({type:"HIGH_RISK_ACTION",severity:"CRITICAL",message:`Action "${action}" is classified as HIGH RISK — weapons/engagement order`});requiresConfirm=true;}
  const targetUnits=uxsList.filter(u=>targets.includes(u.id)||targets.includes("ALL")||targets.includes(u.domain));
  const armedTargets=targetUnits.filter(u=>u.armed);
  if(armedTargets.length>0){flags.push({type:"ARMED_ASSET",severity:"WARNING",message:`Armed UxS tasked: ${armedTargets.map(u=>u.id).join(", ")} — weapons release possible`});requiresConfirm=true;}
  const targetContact=parsedCommand.contact?contacts.find(c=>c.id===parsedCommand.contact||c.label.toLowerCase().includes((parsedCommand.contact||"").toLowerCase())):null;
  if(targetContact){
    if(targetContact.iff==="FRIEND"){flags.push({type:"FRATRICIDE_RISK",severity:"CRITICAL",message:`TARGET IS FRIENDLY — ${targetContact.label} identified as FRIEND. ABORT RECOMMENDED.`});requiresConfirm=true;}
    else if(targetContact.iff==="UNKNOWN"){flags.push({type:"UNKNOWN_TARGET",severity:"WARNING",message:`Target ${targetContact.label} has UNKNOWN IFF status — positive ID not confirmed`});requiresConfirm=true;}
  }
  if(isHighRiskAction){
    const fc=contacts.filter(c=>c.iff==="FRIEND"), uc=contacts.filter(c=>c.iff==="UNKNOWN");
    if(fc.length>0)warnings.push(`${fc.length} FRIENDLY unit(s) in operational picture`);
    if(uc.length>0)warnings.push(`${uc.length} UNKNOWN contact(s) — IFF not confirmed`);
  }
  return{requiresConfirm,flags,warnings,targetContact,targetUnits,isHighRiskAction,armedTargets};
}

// ─────────────────────────────────────────────────────────────
// COMPONENT: TacticalMap  ← NEW IN STEP 7
//
// HTML5 Canvas that draws the full battlefield picture.
// Re-renders every time uxs or contacts change.
//
// What gets drawn:
// 1. Background grid (coordinate reference lines)
// 2. Grid labels (lat/lng coordinates at edges)
// 3. Contact markers (IFF color coded diamonds)
// 4. UxS markers (domain color coded with heading vectors)
// 5. Selected unit ring (highlighted)
// 6. Labels for all markers
// 7. Map legend (bottom left)
//
// Coordinate system:
// We map lat/lng to canvas pixels using a simple linear
// projection. The map bounds are set around our operational area.
//
// Restaurant analogy: The live floor plan.
// Every table (UxS), every customer (contact), every
// section boundary (grid lines) drawn on one board.
// Updates in real time as the floor changes.
// ─────────────────────────────────────────────────────────────
const MAP_BOUNDS = {
  latMin: 49.240, latMax: 49.340,
  lngMin: -123.230, lngMax: -123.060,
};

function TacticalMap({ uxs, contacts, waypoints, selectedId, executedIds, tick, onSelectUnit }) {
  const canvasRef = useRef(null);

  // Convert lat/lng to canvas x/y pixels
  const toCanvas = useCallback((lat, lng, w, h) => {
    const x = ((lng - MAP_BOUNDS.lngMin) / (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin)) * w;
    const y = h - ((lat - MAP_BOUNDS.latMin) / (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin)) * h;
    return { x, y };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    // ── CLEAR ──────────────────────────────────────────────
    ctx.clearRect(0, 0, W, H);

    // ── BACKGROUND ─────────────────────────────────────────
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);

    // ── GRID LINES ─────────────────────────────────────────
    // Draw lat/lng reference grid
    ctx.strokeStyle = "rgba(0,255,65,0.06)";
    ctx.lineWidth = 1;
    const gridSteps = 8;
    for (let i = 0; i <= gridSteps; i++) {
      const x = (i / gridSteps) * W;
      const y = (i / gridSteps) * H;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }

    // ── GRID LABELS ────────────────────────────────────────
    ctx.fillStyle = "rgba(0,255,65,0.25)";
    ctx.font = "9px 'Share Tech Mono'";
    for (let i = 0; i <= gridSteps; i++) {
      const lat = MAP_BOUNDS.latMin + (i/gridSteps)*(MAP_BOUNDS.latMax-MAP_BOUNDS.latMin);
      const lng = MAP_BOUNDS.lngMin + (i/gridSteps)*(MAP_BOUNDS.lngMax-MAP_BOUNDS.lngMin);
      const y = H - (i/gridSteps)*H;
      ctx.fillText(lat.toFixed(3)+"°N", 4, y-2);
      const x = (i/gridSteps)*W;
      ctx.fillText(lng.toFixed(2)+"°", x+2, H-4);
    }

    // ── DRAW HELPER: heading vector ─────────────────────────
    // Draws an arrow showing which direction the unit is moving
    const drawHeadingVector = (cx, cy, heading, len, color) => {
      const rad = (heading - 90) * Math.PI / 180;
      const ex = cx + Math.cos(rad) * len;
      const ey = cy + Math.sin(rad) * len;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      // Arrowhead
      const arrowSize = 5;
      const angle = Math.atan2(ey-cy, ex-cx);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - arrowSize*Math.cos(angle-0.4), ey - arrowSize*Math.sin(angle-0.4));
      ctx.lineTo(ex - arrowSize*Math.cos(angle+0.4), ey - arrowSize*Math.sin(angle+0.4));
      ctx.closePath();
      ctx.fill();
    };

    // ── FOE THREAT PULSE RINGS ──────────────────────────────
    // Expanding rings animate using tick % 20 (200ms × 20 = 4s cycle)
    const phase = (tick % 20) / 20;          // 0→1 over 4 seconds
    const phase2 = ((tick + 10) % 20) / 20;  // offset second ring
    contacts.filter(c=>c.iff==="FOE").forEach(contact=>{
      const {x,y}=toCanvas(contact.lat,contact.lng,W,H);
      [phase,phase2].forEach(p=>{
        const r=14+p*36;
        const alpha=(1-p)*0.5;
        ctx.strokeStyle=`rgba(239,68,68,${alpha})`;
        ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.arc(x,y,r,0,Math.PI*2);
        ctx.stroke();
      });
    });

    // ── DRAW CONTACTS ───────────────────────────────────────
    // Diamond shape with IFF color
    contacts.forEach(contact => {
      const {x,y} = toCanvas(contact.lat, contact.lng, W, H);
      const iff = IFF_META[contact.iff] || IFF_META.NEUTRAL;
      const size = 8;

      // Outer glow
      ctx.shadowColor = iff.color;
      ctx.shadowBlur = 8;

      // Diamond shape
      ctx.fillStyle = iff.color + "33";
      ctx.strokeStyle = iff.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y-size);
      ctx.lineTo(x+size, y);
      ctx.lineTo(x, y+size);
      ctx.lineTo(x-size, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // IFF indicator dot inside diamond
      ctx.fillStyle = iff.color;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI*2);
      ctx.fill();

      // Label
      ctx.fillStyle = iff.color;
      ctx.font = "bold 8px 'Share Tech Mono'";
      ctx.fillText(contact.label.substring(0,12), x+size+3, y+3);
      ctx.fillStyle = iff.color + "99";
      ctx.font = "7px 'Share Tech Mono'";
      ctx.fillText(`[${contact.iff}]`, x+size+3, y+12);
    });

    // ── DRAW UxS UNITS ──────────────────────────────────────
    uxs.forEach(unit => {
      const {x,y} = toCanvas(unit.lat, unit.lng, W, H);
      const domain = DOMAIN_META[unit.domain];
      const isSelected = unit.id === selectedId;
      const isExecuted = (executedIds||[]).includes(unit.id);
      const isMoving = unit.status !== "STANDBY" && unit.status !== "OFFLINE";

      // Heading vector for moving units
      if (isMoving && unit.speed > 0) {
        drawHeadingVector(x, y, unit.heading, 28, domain.hex + "88");
      }

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = domain.hex;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4,4]);
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Execution pulse ring
      if (isExecuted || unit.status === "EXECUTING") {
        ctx.strokeStyle = domain.hex + "66";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI*2);
        ctx.stroke();
      }

      // Unit outer glow
      ctx.shadowColor = domain.hex;
      ctx.shadowBlur = isSelected ? 16 : 8;

      // Unit circle
      const radius = isSelected ? 10 : 8;
      ctx.fillStyle = domain.hex + "33";
      ctx.strokeStyle = domain.hex;
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ARMED indicator — red dot
      if (unit.armed) {
        ctx.fillStyle = "#ef4444";
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(x+7, y-7, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Status indicator ring color
      const statusColor = STATUS_META[unit.status]?.color || "#6b7280";
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, radius+3, 0, Math.PI*2);
      ctx.stroke();

      // Label offset — connector line then text above-right
      const lox = x + radius + 5;
      const loy = y - radius - 8;
      ctx.strokeStyle = domain.hex + "55";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2,2]);
      ctx.beginPath();
      ctx.moveTo(x, y - radius);
      ctx.lineTo(lox, loy + 4);
      ctx.stroke();
      ctx.setLineDash([]);

      // Unit ID
      ctx.fillStyle = domain.hex;
      ctx.font = `bold ${isSelected?10:9}px 'Share Tech Mono'`;
      ctx.fillText(unit.id, lox, loy);

      // Callsign
      ctx.fillStyle = domain.hex + "bb";
      ctx.font = "7px 'Share Tech Mono'";
      ctx.fillText(unit.label, lox, loy - 10);
    });

    // ── MAP LEGEND ──────────────────────────────────────────
    const lx = 10, ly = H - 90;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(lx-4, ly-14, 160, 88);
    ctx.strokeStyle = "rgba(0,255,65,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(lx-4, ly-14, 160, 88);

    ctx.font = "bold 8px 'Orbitron'";
    ctx.fillStyle = "rgba(0,255,65,0.6)";
    ctx.fillText("LEGEND", lx, ly);

    const legendItems = [
      {color:"#00d4ff",  label:"AIR UxS"},
      {color:"#f59e0b",  label:"LAND UxS"},
      {color:"#a78bfa",  label:"MARITIME UxS"},
      {color:"#00ff41",  label:"FRIEND"},
      {color:"#ef4444",  label:"FOE"},
      {color:"#f59e0b",  label:"UNKNOWN"},
    ];
    legendItems.forEach((item, i) => {
      const iy = ly + 10 + i*11;
      ctx.fillStyle = item.color;
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(lx+4, iy, 3, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "8px 'Share Tech Mono'";
      ctx.fillText(item.label, lx+12, iy+3);
    });

    // ── CORNER MARKERS ─────────────────────────────────────
    const corners = [[0,0,1,0,0,1],[W,0,-1,0,0,1],[0,H,1,0,0,-1],[W,H,-1,0,0,-1]];
    corners.forEach(([cx,cy,dx,dy,ex,ey]) => {
      ctx.strokeStyle = "rgba(0,255,65,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx+dx*20, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy+ey*20);
      ctx.stroke();
    });

    // ── DRAW WAYPOINTS ──────────────────────────────────────
    // Render as orange triangles with WP label
    (waypoints || []).forEach(wp => {
      const {x, y} = toCanvas(wp.lat, wp.lng, W, H);
      const WP_COLOR = "#fb923c"; // orange

      // Triangle marker
      const size = 7;
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y + size * 0.6);
      ctx.lineTo(x - size, y + size * 0.6);
      ctx.closePath();
      ctx.fillStyle = `rgba(251,146,60,0.2)`;
      ctx.fill();
      ctx.strokeStyle = WP_COLOR;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Glow dot at center
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = WP_COLOR;
      ctx.fill();

      // Short ID label (WP-A etc)
      ctx.fillStyle = WP_COLOR;
      ctx.font = "bold 9px 'Share Tech Mono'";
      ctx.fillText(wp.id, x + 10, y + 4);
    });

    // ── COORDINATES BAR ────────────────────────────────────
    ctx.fillStyle = "rgba(0,255,65,0.15)";
    ctx.font = "9px 'Share Tech Mono'";
    ctx.fillText("49°17'N · 123°07'W · MGRS: 10U EE 23456 78901", W/2-150, H-6);

  }, [uxs, contacts, waypoints, selectedId, executedIds, tick, toCanvas]);

  // Map click — find nearest UxS within 20px and select it
  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top)  * (canvas.height / rect.height);
    let closest = null, closestDist = 20;
    uxs.forEach(unit => {
      const {x, y} = toCanvas(unit.lat, unit.lng, canvas.width, canvas.height);
      const d = Math.sqrt((cx-x)**2 + (cy-y)**2);
      if (d < closestDist) { closestDist = d; closest = unit; }
    });
    if (closest && onSelectUnit) onSelectUnit(closest.id);
  }, [uxs, toCanvas, onSelectUnit]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bg-void)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"3px", height:"20px", background:"var(--cyan-air)", boxShadow:"0 0 8px var(--cyan-air)" }}/>
          <span style={{ fontFamily:"var(--font-display)", fontSize:"11px", letterSpacing:"3px", color:"var(--cyan-air)", fontWeight:700 }}>⊕ TACTICAL DISPLAY</span>
        </div>
        <div style={{ display:"flex", gap:"12px" }}>
          {[{color:"#00d4ff",label:"AIR"},{color:"#f59e0b",label:"LAND"},{color:"#a78bfa",label:"SEA"}].map(d=>(
            <div key={d.label} style={{ display:"flex", alignItems:"center", gap:"4px" }}>
              <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:d.color, boxShadow:`0 0 4px ${d.color}` }}/>
              <span style={{ fontSize:"9px", color:d.color, letterSpacing:"1px", fontFamily:"var(--font-display)" }}>{d.label}</span>
            </div>
          ))}
          {[{color:"#00ff41",label:"FRIEND"},{color:"#ef4444",label:"FOE"},{color:"#f59e0b",label:"UNK"}].map(d=>(
            <div key={d.label} style={{ display:"flex", alignItems:"center", gap:"4px" }}>
              <div style={{ width:"6px", height:"6px", background:d.color, transform:"rotate(45deg)", boxShadow:`0 0 4px ${d.color}` }}/>
              <span style={{ fontSize:"9px", color:d.color, letterSpacing:"1px" }}>{d.label}</span>
            </div>
          ))}
          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            <div style={{ width:0, height:0, borderLeft:"5px solid transparent", borderRight:"5px solid transparent", borderBottom:"8px solid #fb923c" }}/>
            <span style={{ fontSize:"9px", color:"#fb923c", letterSpacing:"1px" }}>WAYPOINT</span>
          </div>
        </div>
      </div>

      {/* Canvas fills remaining space */}
      <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onClick={handleCanvasClick}
          style={{ width:"100%", height:"100%", display:"block", cursor:"crosshair" }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CONFIRMATION MODAL (from Step 6, unchanged)
// ─────────────────────────────────────────────────────────────
function ConfirmationModal({command,iffResult,onAuthorize,onDeny}){
  if(!command||!iffResult)return null;
  const hasFratricide=iffResult.flags.some(f=>f.type==="FRATRICIDE_RISK");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{width:"100%",maxWidth:"460px",background:"var(--bg-panel)",border:`2px solid ${hasFratricide?"var(--red-alert)":"var(--amber-land)"}`,boxShadow:`0 0 40px ${hasFratricide?"rgba(239,68,68,0.4)":"rgba(245,158,11,0.3)"}`,animation:"modalIn 0.2s ease"}}>
        <div style={{padding:"14px 16px",background:hasFratricide?"rgba(239,68,68,0.15)":"rgba(245,158,11,0.1)",borderBottom:`1px solid ${hasFratricide?"var(--red-alert)":"var(--amber-land)"}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"18px"}}>{hasFratricide?"⚠":"⚡"}</span>
            <div>
              <div style={{fontFamily:"var(--font-display)",fontSize:"12px",letterSpacing:"3px",fontWeight:700,color:hasFratricide?"var(--red-alert)":"var(--amber-land)"}}>{hasFratricide?"FRATRICIDE RISK":"HIGH RISK COMMAND"}</div>
              <div style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"1px",marginTop:"2px"}}>OPERATOR AUTHORIZATION REQUIRED</div>
            </div>
          </div>
          <span style={{fontSize:"9px",padding:"2px 8px",border:`1px solid ${hasFratricide?"var(--red-alert)":"var(--amber-land)"}`,color:hasFratricide?"var(--red-alert)":"var(--amber-land)",fontFamily:"var(--font-display)",letterSpacing:"1px"}}>IFF ALERT</span>
        </div>
        <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border))"}}>
          <div style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"2px",marginBottom:"8px"}}>PENDING COMMAND</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 12px"}}>
            {[{label:"ACTION",value:command.action||"—"},{label:"PRIORITY",value:command.priority||"—"},{label:"TARGETS",value:(command.targets||[]).join(", ")||"—"},{label:"AREA",value:command.area||"—"}].map(f=>(<div key={f.label}><div style={{fontSize:"8px",color:"var(--text-dim)",letterSpacing:"1px"}}>{f.label}</div><div style={{fontSize:"11px",color:"var(--text-primary)",fontFamily:"var(--font-mono)",marginTop:"1px"}}>{f.value}</div></div>))}
          </div>
          {command.message&&<div style={{marginTop:"8px",padding:"6px 8px",background:"var(--bg-void)",borderLeft:"2px solid var(--amber-land)"}}><span style={{fontSize:"10px",color:"var(--text-dim)"}}>{command.message}</span></div>}
        </div>
        <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border))"}}>
          <div style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"2px",marginBottom:"8px"}}>IFF ASSESSMENT</div>
          {iffResult.flags.map((flag,i)=>(<div key={i} style={{display:"flex",gap:"8px",alignItems:"flex-start",padding:"6px 8px",marginBottom:"4px",background:flag.severity==="CRITICAL"?"rgba(239,68,68,0.08)":"rgba(245,158,11,0.08)",border:`1px solid ${flag.severity==="CRITICAL"?"rgba(239,68,68,0.3)":"rgba(245,158,11,0.3)"}`}}><span style={{fontSize:"9px",flexShrink:0,marginTop:"1px",color:flag.severity==="CRITICAL"?"var(--red-alert)":"var(--amber-land)",fontFamily:"var(--font-display)",letterSpacing:"1px"}}>{flag.severity==="CRITICAL"?"⚠ CRIT":"! WARN"}</span><span style={{fontSize:"10px",color:"var(--text-primary)",lineHeight:"1.4"}}>{flag.message}</span></div>))}
          {iffResult.warnings.map((w,i)=>(<div key={i} style={{fontSize:"9px",color:"var(--text-dim)",padding:"2px 0",display:"flex",gap:"6px"}}><span style={{color:"var(--amber-land)"}}>›</span>{w}</div>))}
        </div>
        {iffResult.targetContact&&(
          <div style={{padding:"10px 16px",borderBottom:"1px solid var(--border))"}}>
            <div style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"2px",marginBottom:"6px"}}>TARGET CONTACT</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:IFF_META[iffResult.targetContact.iff]?.bg||"var(--bg-card)",border:`1px solid ${IFF_META[iffResult.targetContact.iff]?.color||"var(--border)"}`}}>
              <div><div style={{fontSize:"11px",color:"var(--text-primary)",fontFamily:"var(--font-ui)",fontWeight:600}}>{iffResult.targetContact.label}</div><div style={{fontSize:"9px",color:"var(--text-dim)",marginTop:"2px"}}>{iffResult.targetContact.id} · {iffResult.targetContact.type}</div></div>
              <div style={{padding:"3px 10px",border:`1px solid ${IFF_META[iffResult.targetContact.iff]?.color||"var(--border)"}`,color:IFF_META[iffResult.targetContact.iff]?.color||"var(--text-dim)",fontFamily:"var(--font-display)",fontSize:"10px",letterSpacing:"2px",fontWeight:700}}>{iffResult.targetContact.iff}</div>
            </div>
          </div>
        )}
        <div style={{padding:"14px 16px",display:"flex",gap:"10px"}}>
          <button onClick={onDeny} style={{flex:1,padding:"12px",background:"rgba(239,68,68,0.1)",border:"1px solid var(--red-alert)",color:"var(--red-alert)",fontFamily:"var(--font-display)",fontSize:"11px",letterSpacing:"3px",fontWeight:700,cursor:"pointer"}}>✕ DENY</button>
          <button onClick={onAuthorize} style={{flex:1,padding:"12px",background:hasFratricide?"rgba(239,68,68,0.15)":"rgba(0,255,65,0.1)",border:`1px solid ${hasFratricide?"var(--red-alert)":"var(--green-primary)"}`,color:hasFratricide?"var(--red-alert)":"var(--green-primary)",fontFamily:"var(--font-display)",fontSize:"11px",letterSpacing:"3px",fontWeight:700,cursor:"pointer"}}>{hasFratricide?"⚠ OVERRIDE":"✓ AUTHORIZE"}</button>
        </div>
        <div style={{padding:"0 16px 12px",textAlign:"center"}}><span style={{fontSize:"8px",color:"var(--text-dim)",letterSpacing:"1px"}}>THIS ACTION WILL BE LOGGED WITH OPERATOR ID AND TIMESTAMP</span></div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ALL PRIOR COMPONENTS (carried forward)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// C — UNIT DETAIL PANEL
// Slide-in overlay on the map when a unit is selected.
// Shows full telemetry: lat/lng, altitude, speed, heading,
// payload, armed status, tasks, mission.
// ─────────────────────────────────────────────────────────────
function UnitDetailPanel({ unit, onClose }) {
  if (!unit) return null;
  const d = DOMAIN_META[unit.domain];
  const sm = STATUS_META[unit.status] || STATUS_META.OFFLINE;
  const rows = [
    { label:"LAT",     value:`${unit.lat.toFixed(4)}°N` },
    { label:"LNG",     value:`${unit.lng.toFixed(4)}°W` },
    { label:"ALT",     value:`${unit.altitude}m` },
    { label:"SPEED",   value:`${Math.round(unit.speed)} km/h` },
    { label:"HDG",     value:`${Math.round(unit.heading)}°` },
    { label:"BATTERY", value:`${Math.round(unit.battery)}%`, alert: unit.battery < 20 },
    { label:"SIGNAL",  value:`${Math.round(unit.signal)}%`,  alert: unit.signal < 30 },
    { label:"PAYLOAD", value: unit.payload },
    { label:"MISSION", value: unit.mission },
    { label:"ARMED",   value: unit.armed ? "YES — WEAPONS HOT" : "NO", alert: unit.armed },
  ];
  return (
    <div style={{
      position:"absolute", top:0, right:0, width:"220px", height:"100%",
      background:"rgba(5,10,6,0.97)", borderLeft:`1px solid ${d.color}`,
      zIndex:10, display:"flex", flexDirection:"column",
      animation:"slideIn 0.2s ease", boxShadow:`-4px 0 20px rgba(0,0,0,0.8)`
    }}>
      {/* Header */}
      <div style={{padding:"10px 12px", borderBottom:`1px solid ${d.color}`, background:`rgba(${d.hex==='#00d4ff'?'0,212,255':d.hex==='#f59e0b'?'245,158,11':'167,139,250'},0.08)`}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
          <div>
            <div style={{fontFamily:"var(--font-display)", fontSize:"13px", fontWeight:700, color:d.color, letterSpacing:"2px"}}>{unit.id}</div>
            <div style={{fontSize:"12px", color:"var(--text-primary)", fontFamily:"var(--font-ui)", fontWeight:600, marginTop:"2px"}}>{unit.label}</div>
          </div>
          <button onClick={onClose} style={{background:"none", border:"none", cursor:"pointer", color:"var(--text-dim)", fontSize:"14px", padding:"0", lineHeight:1}}>✕</button>
        </div>
        <div style={{marginTop:"6px", display:"flex", gap:"6px", alignItems:"center"}}>
          <div style={{padding:"2px 6px", background:sm.bg, border:`1px solid ${sm.color}`, fontSize:"8px", fontFamily:"var(--font-display)", letterSpacing:"1px", color:sm.color}}>{sm.label}</div>
          <div style={{padding:"2px 6px", background:"var(--bg-card)", border:`1px solid ${d.color}`, fontSize:"8px", fontFamily:"var(--font-display)", letterSpacing:"1px", color:d.color}}>{d.label}</div>
        </div>
      </div>
      {/* Telemetry rows */}
      <div style={{flex:1, overflowY:"auto", padding:"8px 12px"}}>
        <div style={{fontSize:"8px", letterSpacing:"2px", color:"var(--text-dim)", marginBottom:"8px", marginTop:"4px"}}>TELEMETRY</div>
        {rows.map(r => (
          <div key={r.label} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", borderBottom:"1px solid var(--border)"}}>
            <span style={{fontSize:"9px", color:"var(--text-dim)", letterSpacing:"1px"}}>{r.label}</span>
            <span style={{fontSize:"10px", color: r.alert ? "#ef4444" : "var(--text-primary)", fontFamily:"var(--font-mono)", letterSpacing:"0.5px"}}>{r.value}</span>
          </div>
        ))}
        {unit.tasks.length > 0 && (
          <div style={{marginTop:"10px"}}>
            <div style={{fontSize:"8px", letterSpacing:"2px", color:"var(--text-dim)", marginBottom:"6px"}}>ACTIVE TASKS</div>
            {unit.tasks.map((t,i) => (
              <div key={i} style={{padding:"4px 8px", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", marginBottom:"4px"}}>
                <span style={{fontSize:"9px", color:"var(--amber-land)", letterSpacing:"0.5px"}}>▶ {t}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{padding:"8px 12px", borderTop:"1px solid var(--border)", fontSize:"8px", color:"var(--text-dim)", letterSpacing:"1px"}}>
        CLICK MAP UNIT TO CLOSE
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// E — MISSION BRIEF PANEL
// Collapsible AO summary panel. Shows OPORD, threat level,
// weather mock, and AO bounds. Toggled via map header button.
// ─────────────────────────────────────────────────────────────
function MissionBriefPanel({ onClose }) {
  const foeCount  = CONTACTS.filter(c => c.iff === "FOE").length;
  const unkCount  = CONTACTS.filter(c => c.iff === "UNKNOWN").length;
  const threat    = foeCount >= 2 ? "HIGH" : foeCount >= 1 ? "MEDIUM" : "LOW";
  const threatColor = threat === "HIGH" ? "#ef4444" : threat === "MEDIUM" ? "#f59e0b" : "#00ff41";
  return (
    <div style={{
      position:"absolute", top:0, left:0, right:0, zIndex:20,
      background:"rgba(5,10,6,0.97)", borderBottom:"1px solid var(--border)",
      animation:"briefIn 0.2s ease", padding:"12px 16px"
    }}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
        <div style={{display:"flex", gap:"32px", flex:1}}>
          {/* Op details */}
          <div>
            <div style={{fontSize:"8px", letterSpacing:"2px", color:"var(--text-dim)", marginBottom:"4px"}}>OPERATION</div>
            <div style={{fontFamily:"var(--font-display)", fontSize:"13px", fontWeight:700, color:"var(--green-primary)", letterSpacing:"2px"}}>CEDAR SHIELD</div>
            <div style={{fontSize:"9px", color:"var(--text-dim)", marginTop:"2px"}}>AO: GRID 49.24–49.34N · 123.06–123.23W</div>
          </div>
          {/* Threat */}
          <div>
            <div style={{fontSize:"8px", letterSpacing:"2px", color:"var(--text-dim)", marginBottom:"4px"}}>THREAT LEVEL</div>
            <div style={{fontFamily:"var(--font-display)", fontSize:"13px", fontWeight:700, color:threatColor, letterSpacing:"2px"}}>{threat}</div>
            <div style={{fontSize:"9px", color:"var(--text-dim)", marginTop:"2px"}}>{foeCount} FOE · {unkCount} UNKNOWN</div>
          </div>
          {/* Weather */}
          <div>
            <div style={{fontSize:"8px", letterSpacing:"2px", color:"var(--text-dim)", marginBottom:"4px"}}>WEATHER</div>
            <div style={{fontFamily:"var(--font-display)", fontSize:"13px", fontWeight:700, color:"var(--cyan-air)", letterSpacing:"2px"}}>OVERCAST</div>
            <div style={{fontSize:"9px", color:"var(--text-dim)", marginTop:"2px"}}>VIS 4km · Wind 12kt NW · Ceiling 800ft</div>
          </div>
          {/* OPORD summary */}
          <div style={{flex:1, maxWidth:"320px"}}>
            <div style={{fontSize:"8px", letterSpacing:"2px", color:"var(--text-dim)", marginBottom:"4px"}}>OPORD SUMMARY</div>
            <div style={{fontSize:"9px", color:"var(--text-primary)", lineHeight:"1.5"}}>
              UxS elements will conduct ISR operations within AO CEDAR SHIELD. UAV assets maintain persistent surveillance. UGV elements advance to designated checkpoints. Positive IFF confirmation required before any engagement.
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{background:"none", border:"none", cursor:"pointer", color:"var(--text-dim)", fontSize:"14px", padding:"0 0 0 16px", flexShrink:0}}>✕</button>
      </div>
    </div>
  );
}

function StatusBadge({status}){const m=STATUS_META[status]||STATUS_META.OFFLINE;return(<div style={{display:"inline-flex",alignItems:"center",gap:"5px",padding:"2px 7px",background:m.bg,border:`1px solid ${m.color}`}}><div style={{width:"5px",height:"5px",borderRadius:"50%",background:m.color,boxShadow:status!=="STANDBY"&&status!=="OFFLINE"?`0 0 6px ${m.color}`:"none"}}/><span style={{fontSize:"9px",fontFamily:"var(--font-display)",letterSpacing:"1px",color:m.color,fontWeight:700}}>{m.label}</span></div>);}
function MeterBar({value,color,label}){const dc=value<20?"#ef4444":value<40?"#f59e0b":color;return(<div style={{display:"flex",alignItems:"center",gap:"6px"}}><span style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"1px",width:"16px",flexShrink:0}}>{label}</span><div style={{flex:1,height:"4px",background:"var(--bg-void)",border:"1px solid var(--border)",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",left:0,top:0,bottom:0,width:`${value}%`,background:dc,boxShadow:value>20?`0 0 4px ${dc}`:"none",transition:"width 0.5s ease"}}/></div><span style={{fontSize:"9px",color:dc,letterSpacing:"1px",width:"28px",textAlign:"right",flexShrink:0}}>{Math.round(value)}%</span></div>);}
function FleetCard({unit,selected,onClick}){const d=DOMAIN_META[unit.domain];const batCrit=unit.battery<20;const sigLow=unit.signal<30;return(<div className={`uxs-card${batCrit?" bat-critical":""}`} onClick={onClick} style={{background:selected?"var(--bg-highlight)":"var(--bg-card)",border:`1px solid ${selected?d.color:batCrit?"var(--red-alert)":sigLow?"var(--amber-land)":"var(--border)"}`,marginBottom:"6px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",left:0,top:0,bottom:0,width:"3px",background:d.color,boxShadow:`0 0 8px ${d.color}`}}/><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 10px 6px 12px"}}><div><div style={{display:"flex",alignItems:"center",gap:"6px"}}><span style={{fontFamily:"var(--font-display)",fontSize:"11px",fontWeight:700,color:d.color,letterSpacing:"1px"}}>{unit.id}</span>{unit.armed&&<span style={{fontSize:"8px",color:"#ef4444",border:"1px solid #ef4444",padding:"0 4px",letterSpacing:"1px"}}>ARMED</span>}</div><div style={{fontSize:"11px",color:"var(--text-primary)",fontFamily:"var(--font-ui)",fontWeight:600,marginTop:"1px"}}>{unit.label}</div></div><StatusBadge status={unit.status}/></div><div style={{padding:"0 10px 6px 12px",display:"flex",flexDirection:"column",gap:"4px"}}><MeterBar value={unit.battery} color="var(--green-primary)" label="BAT"/><MeterBar value={unit.signal} color="var(--cyan-air)" label="SIG"/></div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 10px 7px 12px",borderTop:"1px solid var(--border)"}}><div style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{fontSize:"10px",color:d.color}}>{d.icon}</span><span style={{fontSize:"9px",color:d.color,letterSpacing:"1px",fontFamily:"var(--font-display)"}}>{d.label}</span></div><span style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"1px",maxWidth:"90px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{unit.payload}</span><span style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"1px",fontFamily:"var(--font-display)"}}>{unit.mission}</span></div>{unit.tasks.length>0&&(<div style={{padding:"4px 10px 6px 12px",borderTop:"1px solid var(--border)",background:"rgba(245,158,11,0.05)"}}><span style={{fontSize:"9px",color:"var(--amber-land)",letterSpacing:"1px"}}>▶ {unit.tasks[0]}</span></div>)}</div>);}
function PanelHeader({label,icon,accent="var(--green-primary)",count}){return(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid var(--border)"}}><div style={{display:"flex",alignItems:"center",gap:"10px"}}><div style={{width:"3px",height:"20px",background:accent,boxShadow:`0 0 8px ${accent}`}}/><span style={{fontFamily:"var(--font-display)",fontSize:"11px",letterSpacing:"3px",color:accent,fontWeight:700}}>{icon} {label}</span></div>{count!==undefined&&<span style={{fontSize:"10px",color:"var(--text-dim)",background:"var(--bg-highlight)",padding:"2px 8px",border:"1px solid var(--border)"}}>{count}</span>}</div>);}
function FleetPanel({uxs,selectedId,onSelect}){const ac=uxs.filter(u=>u.status!=="STANDBY"&&u.status!=="OFFLINE").length,ar=uxs.filter(u=>u.armed).length;return(<div style={{display:"flex",flexDirection:"column",height:"100%",background:"var(--bg-panel)",borderRight:"1px solid var(--border)"}}><PanelHeader label="FLEET ROSTER" icon="◈" count={`${uxs.length} UxS`}/><div style={{display:"flex",borderBottom:"1px solid var(--border)"}}>{[{label:"TOTAL",value:uxs.length,color:"var(--text-dim)"},{label:"ACTIVE",value:ac,color:"var(--green-primary)"},{label:"ARMED",value:ar,color:ar>0?"var(--red-alert)":"var(--text-dim)"}].map((s,i)=>(<div key={s.label} style={{flex:1,padding:"8px 0",textAlign:"center",borderRight:i<2?"1px solid var(--border)":"none"}}><div style={{fontFamily:"var(--font-display)",fontSize:"16px",fontWeight:700,color:s.color}}>{s.value}</div><div style={{fontSize:"8px",color:"var(--text-dim)",letterSpacing:"2px",marginTop:"1px"}}>{s.label}</div></div>))}</div><div style={{flex:1,overflowY:"auto",padding:"8px"}}>{uxs.map(unit=>(<FleetCard key={unit.id} unit={unit} selected={selectedId===unit.id} onClick={()=>onSelect(unit.id===selectedId?null:unit.id)}/>))}</div><div style={{padding:"10px 16px",borderTop:"1px solid var(--border)",display:"flex",gap:"16px"}}>{Object.entries(DOMAIN_META).map(([key,d])=>(<div key={key} style={{display:"flex",alignItems:"center",gap:"5px"}}><div style={{width:"7px",height:"7px",borderRadius:"50%",background:d.color}}/><span style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"1px"}}>{d.label}</span></div>))}</div></div>);}
function TopBar({time,missionElapsed,isProcessing,wsStatus}){
  const dlColor=wsStatus==="LIVE"?"var(--green-primary)":"var(--amber-land)";
  return(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",height:"52px",background:"var(--bg-panel)",borderBottom:`1px solid ${isProcessing?"var(--cyan-air)":"var(--green-primary)"}`,boxShadow:`0 0 20px ${isProcessing?"rgba(0,212,255,0.2)":"rgba(0,255,65,0.15)"}`,flexShrink:0,transition:"all 0.3s ease"}}>
    <div style={{display:"flex",alignItems:"center",gap:"16px"}}>
      <div style={{position:"relative",width:"10px",height:"10px"}}><div style={{width:"10px",height:"10px",borderRadius:"50%",background:isProcessing?"var(--cyan-air)":"var(--green-primary)",boxShadow:`0 0 8px ${isProcessing?"var(--cyan-air)":"var(--green-primary)"}`}}/><div style={{position:"absolute",inset:"-4px",borderRadius:"50%",border:`1px solid ${isProcessing?"var(--cyan-air)":"var(--green-primary)"}`,opacity:0.4,animation:"pulse 2s infinite"}}/></div>
      <span style={{fontFamily:"var(--font-display)",fontSize:"14px",fontWeight:700,letterSpacing:"3px",color:isProcessing?"var(--cyan-air)":"var(--green-primary)",transition:"all 0.3s ease"}}>CAF C2 · UxS COMMAND</span>
      <span style={{fontSize:"11px",color:"var(--text-dim)",letterSpacing:"1px"}}>{isProcessing?"AI PARSING COMMAND...":"VOICE-ENABLED CONTROL SYSTEM v1.0"}</span>
    </div>
    <div style={{padding:"4px 20px",border:"1px solid #ef4444",fontSize:"11px",fontWeight:700,letterSpacing:"4px",color:"#ef4444",fontFamily:"var(--font-display)"}}>⚠ UNCLASSIFIED // EXERCISE ONLY ⚠</div>
    <div style={{display:"flex",alignItems:"center",gap:"24px"}}>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:"18px",letterSpacing:"2px",color:"var(--green-primary)",fontWeight:700}}>{time}</div>
        <div style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"2px"}}>ZULU TIME</div>
      </div>
      <div style={{textAlign:"right",borderLeft:"1px solid var(--border)",paddingLeft:"16px"}}>
        <div style={{fontSize:"13px",letterSpacing:"2px",color:"var(--cyan-air)",fontWeight:700,fontFamily:"var(--font-display)"}}>{missionElapsed}</div>
        <div style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"2px"}}>MISSION TIME</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"3px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
          <div style={{width:"6px",height:"6px",borderRadius:"50%",background:dlColor,boxShadow:`0 0 4px ${dlColor}`}}/>
          <span style={{fontSize:"9px",color:dlColor,letterSpacing:"1px",fontWeight:wsStatus==="LIVE"?700:400}}>DATALINK: {wsStatus}</span>
        </div>
        {["IFF","VOICE"].map(sys=>(<div key={sys} style={{display:"flex",alignItems:"center",gap:"6px"}}><div style={{width:"6px",height:"6px",borderRadius:"50%",background:"var(--green-primary)",boxShadow:"0 0 4px var(--green-primary)"}}/><span style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"1px"}}>{sys}</span></div>))}
      </div>
    </div>
  </div>);
}
function VoiceWaveform({active}){if(!active)return null;return(<div style={{display:"flex",alignItems:"center",gap:"3px",height:"24px"}}>{["wave1","wave2","wave3","wave4","wave5","wave3","wave1"].map((a,i)=>(<div key={i} style={{width:"3px",height:"8px",background:"var(--red-alert)",borderRadius:"2px",animation:`${a} ${0.4+i*0.05}s ease-in-out infinite`,boxShadow:"0 0 4px var(--red-alert)"}}/>))}</div>);}
function PipelineVisualizer({activeStage}){return(<div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)"}}><div style={{fontSize:"9px",letterSpacing:"2px",color:"var(--text-dim)",marginBottom:"10px"}}>COMMAND PIPELINE</div><div style={{display:"flex",alignItems:"center",gap:"4px"}}>{PIPELINE_STAGES.map((stage,i)=>{const isActive=stage.key===activeStage,idx=PIPELINE_STAGES.findIndex(s=>s.key===activeStage),isPast=idx>-1&&i<idx;return(<div key={stage.key} style={{display:"flex",alignItems:"center",gap:"4px",flex:1}}><div style={{flex:1,padding:"5px 4px",textAlign:"center",fontSize:"8px",letterSpacing:"1px",fontFamily:"var(--font-display)",fontWeight:isActive?700:400,color:isActive?stage.color:isPast?"var(--green-dim)":"var(--text-dim)",background:"var(--bg-card)",border:`1px solid ${isActive?stage.color:isPast?"var(--green-muted)":"var(--border)"}`,boxShadow:isActive?`0 0 8px ${stage.color}`:"none",transition:"all 0.3s ease",animation:isActive?"parsePulse 1s ease-in-out infinite":"none"}}>{isPast?"✓":stage.label}</div>{i<PIPELINE_STAGES.length-1&&<span style={{fontSize:"8px",color:isPast?"var(--green-dim)":"var(--border)",flexShrink:0}}>→</span>}</div>);})}</div></div>);}
function ParsedCommandCard({command}){if(!command)return null;const rc=command.riskLevel==="HIGH"?"var(--red-alert)":command.riskLevel==="MEDIUM"?"var(--amber-land)":"var(--green-primary)";return(<div style={{margin:"10px 14px 0",padding:"10px",background:"var(--bg-card)",border:`1px solid ${rc}`,boxShadow:`0 0 10px ${rc}33`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}><span style={{fontSize:"9px",fontFamily:"var(--font-display)",letterSpacing:"2px",color:rc,fontWeight:700}}>◈ PARSED COMMAND</span><span style={{fontSize:"9px",padding:"1px 6px",border:`1px solid ${rc}`,color:rc,fontFamily:"var(--font-display)",letterSpacing:"1px"}}>{command.riskLevel||"LOW"} RISK</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 8px",marginBottom:"8px"}}>{[{label:"ACTION",value:command.action||"—"},{label:"PRIORITY",value:command.priority||"—"},{label:"TARGETS",value:(command.targets||[]).join(", ")||"—"},{label:"AREA",value:command.area||"—"}].map(f=>(<div key={f.label}><div style={{fontSize:"8px",color:"var(--text-dim)",letterSpacing:"1px",marginBottom:"1px"}}>{f.label}</div><div style={{fontSize:"10px",color:"var(--text-primary)",fontFamily:"var(--font-mono)",letterSpacing:"0.5px"}}>{f.value}</div></div>))}</div>{command.message&&<div style={{padding:"6px 8px",background:"var(--bg-void)",borderLeft:`2px solid ${rc}`}}><span style={{fontSize:"10px",color:"var(--text-dim)"}}>{command.message}</span></div>}</div>);}
function CommandLogEntry({entry}){const sc=entry.status==="EXECUTED"?"var(--green-primary)":entry.status==="DENIED"?"var(--red-alert)":entry.status==="PENDING"?"var(--amber-land)":entry.status==="PARSED"?"var(--cyan-air)":"var(--text-dim)";return(<div style={{padding:"6px 0",borderBottom:"1px solid var(--border)",display:"flex",gap:"8px",alignItems:"flex-start"}}><span style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"1px",flexShrink:0,paddingTop:"1px"}}>{entry.time}</span><div style={{width:"5px",height:"5px",borderRadius:"50%",background:sc,flexShrink:0,marginTop:"3px",boxShadow:`0 0 4px ${sc}`}}/><span style={{fontSize:"10px",color:"var(--text-primary)",letterSpacing:"0.3px",lineHeight:"1.4",flex:1}}>{entry.message}</span></div>);}

function CommandPanel({isListening,voiceRaw,voiceInterim,pipelineStage,isProcessing,parsedCommand,commandLog,onStartListen,onStopListen,onManualChange,onManualSubmit,onClear,onProcess,manualInput}){
  const logRef=useRef(null);
  useEffect(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},[commandLog]);
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"var(--bg-panel)",borderLeft:"1px solid var(--border)"}}>
      <PanelHeader label="COMMAND INTERFACE" icon="◉" accent="var(--amber-land)"/>
      <div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)"}}>
        <div style={{fontSize:"9px",letterSpacing:"2px",color:"var(--text-dim)",marginBottom:"10px"}}>VOICE INPUT</div>
        <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"10px"}}>
          <button className="transmit-btn" onClick={isListening?onStopListen:onStartListen} style={{width:"80px",height:"36px",background:isListening?"rgba(239,68,68,0.15)":"rgba(0,255,65,0.1)",border:`1px solid ${isListening?"var(--red-alert)":"var(--green-primary)"}`,color:isListening?"var(--red-alert)":"var(--green-primary)",fontFamily:"var(--font-display)",fontSize:"9px",letterSpacing:"2px",fontWeight:700,animation:isListening?"transmitPulse 1.2s ease-in-out infinite":"none",flexShrink:0}}>{isListening?"■ STOP":"● TX"}</button>
          {isListening?<VoiceWaveform active={true}/>:<span style={{fontSize:"9px",color:"var(--text-dim)",letterSpacing:"1px"}}>CLICK TX TO TRANSMIT</span>}
        </div>
        <div style={{minHeight:"52px",padding:"8px 10px",background:"var(--bg-void)",border:`1px solid ${isListening?"var(--red-alert)":voiceRaw?"var(--green-primary)":"var(--border)"}`,transition:"border-color 0.3s ease",position:"relative",marginBottom:"8px"}}>
          {voiceInterim?<span style={{fontSize:"11px",color:"var(--text-dim)",fontFamily:"var(--font-mono)"}}>{voiceInterim}</span>:voiceRaw?<span style={{fontSize:"11px",color:"var(--green-primary)",fontFamily:"var(--font-mono)"}}>{voiceRaw}</span>:<span style={{fontSize:"10px",color:"var(--text-dim)",opacity:0.4,letterSpacing:"1px"}}>AWAITING VOICE INPUT...</span>}
          {voiceRaw&&!isListening&&<button onClick={onClear} style={{position:"absolute",top:"6px",right:"6px",background:"none",border:"none",cursor:"pointer",color:"var(--text-dim)",fontSize:"10px",padding:"2px 4px"}}>✕</button>}
        </div>
        <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}>
          <input type="text" value={manualInput} onChange={e=>onManualChange(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onManualSubmit()} placeholder="or type command..." style={{flex:1,background:"var(--bg-void)",border:"1px solid var(--border)",color:"var(--text-primary)",fontFamily:"var(--font-mono)",fontSize:"11px",padding:"6px 8px",outline:"none"}}/>
          <button onClick={onManualSubmit} disabled={!manualInput.trim()} style={{padding:"6px 10px",background:manualInput.trim()?"rgba(0,255,65,0.1)":"transparent",border:`1px solid ${manualInput.trim()?"var(--green-primary)":"var(--border)"}`,color:manualInput.trim()?"var(--green-primary)":"var(--text-dim)",fontFamily:"var(--font-display)",fontSize:"9px",letterSpacing:"1px",cursor:manualInput.trim()?"pointer":"not-allowed"}}>SEND</button>
        </div>
        <button onClick={onProcess} disabled={!voiceRaw||isProcessing||isListening} style={{width:"100%",padding:"8px",background:voiceRaw&&!isProcessing?"rgba(0,212,255,0.1)":"transparent",border:`1px solid ${voiceRaw&&!isProcessing?"var(--cyan-air)":"var(--border)"}`,color:voiceRaw&&!isProcessing?"var(--cyan-air)":"var(--text-dim)",fontFamily:"var(--font-display)",fontSize:"10px",letterSpacing:"3px",fontWeight:700,cursor:voiceRaw&&!isProcessing?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",animation:isProcessing?"parsePulse 1s ease-in-out infinite":"none"}}>
          {isProcessing?<><span style={{animation:"parsePulse 0.6s ease-in-out infinite"}}>◈</span> AI PARSING...</>:"◈ PROCESS COMMAND"}
        </button>
        <div style={{marginTop:"6px",fontSize:"9px",color:"var(--text-dim)"}}>Try: "UAV-01 recon sector alpha" · "engage hostile victor-1"</div>
      </div>
      <PipelineVisualizer activeStage={pipelineStage}/>
      {parsedCommand&&<ParsedCommandCard command={parsedCommand}/>}
      <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
        <div style={{padding:"10px 14px 6px",fontSize:"9px",letterSpacing:"2px",color:"var(--text-dim)",borderTop:parsedCommand?"1px solid var(--border)":"none",marginTop:parsedCommand?"8px":0}}>COMMAND LOG</div>
        <div ref={logRef} style={{flex:1,overflowY:"auto",padding:"0 14px 8px"}}>
          {commandLog.length===0?<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60px",opacity:0.2}}><span style={{fontSize:"10px",color:"var(--text-dim)",letterSpacing:"2px"}}>NO COMMANDS ISSUED</span></div>:commandLog.map((e,i)=><CommandLogEntry key={i} entry={e}/>)}
        </div>
      </div>
      <div style={{padding:"8px 14px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
          <span className="kbd">V</span><span style={{fontSize:"8px",color:"var(--text-dim)"}}>voice</span>
          <span className="kbd">↵</span><span style={{fontSize:"8px",color:"var(--text-dim)"}}>send</span>
          <span className="kbd">ESC</span><span style={{fontSize:"8px",color:"var(--text-dim)"}}>cancel</span>
        </div>
        <span style={{fontSize:"9px",color:isListening?"var(--red-alert)":isProcessing?"var(--cyan-air)":"var(--text-dim)",letterSpacing:"1px"}}>{isListening?"● TRANSMITTING":isProcessing?"◈ PARSING":"SESSION ACTIVE"}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT COMPONENT: App — COMPLETE SYSTEM
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [time,setTime]                  = useState(()=>new Date().toUTCString().slice(17,25)+"Z");
  const [uxs,setUxs]                    = useState(INITIAL_UXS);
  const [selectedUxs,setSelectedUxs]    = useState(null);
  const [isListening,setIsListening]    = useState(false);
  const [voiceRaw,setVoiceRaw]          = useState("");
  const [voiceInterim,setVoiceInterim]  = useState("");
  const [pipelineStage,setPipelineStage]= useState(null);
  const [manualInput,setManualInput]    = useState("");
  const [isProcessing,setIsProcessing]  = useState(false);
  const [parsedCommand,setParsedCommand]= useState(null);
  const [commandLog,setCommandLog]      = useState([]);
  const [pendingConfirm,setPendingConfirm] = useState(null);
  const [executedIds,setExecutedIds]    = useState([]);
  const [wsStatus,setWsStatus]          = useState("SIMULATED");  // G
  const [showBrief,setShowBrief]        = useState(false);        // E
  const [tick,setTick]                  = useState(0);            // animation tick
  const [missionElapsed,setMissionElapsed] = useState("T+00:00:00");

  const telemetryRef    = useRef(null);
  const clockRef        = useRef(null);
  const recognitionRef  = useRef(null);
  const alertedRef      = useRef(new Set());                      // D
  const missionStartRef = useRef(Date.now());
  const wsRef           = useRef(null);

  const addLog = useCallback((message,status="INFO")=>{
    setCommandLog(prev=>[...prev,{time:zuluNow(),message,status}]);
  },[]);

  useEffect(()=>{
    clockRef.current=setInterval(()=>{
      setTime(new Date().toUTCString().slice(17,25)+"Z");
      const s=Math.floor((Date.now()-missionStartRef.current)/1000);
      const h=Math.floor(s/3600).toString().padStart(2,"0");
      const m=Math.floor((s%3600)/60).toString().padStart(2,"0");
      const sec=(s%60).toString().padStart(2,"0");
      setMissionElapsed(`T+${h}:${m}:${sec}`);
      setTick(t=>t+1);
    },200);
    return()=>clearInterval(clockRef.current);
  },[]);

  useEffect(()=>{
    telemetryRef.current=setInterval(()=>{
      setUxs(prev=>prev.map(unit=>{
        if(unit.status==="OFFLINE")return unit;
        const isMoving=unit.status!=="STANDBY";
        const drift=()=>(Math.random()-0.5)*0.0004;
        return{...unit,
          battery:clamp(unit.battery-(unit.status==="EXECUTING"?0.08:0.02),0,100),
          signal: clamp(unit.signal+(Math.random()-0.5)*3,15,100),
          lat:    isMoving?unit.lat+drift():unit.lat,
          lng:    isMoving?unit.lng+drift():unit.lng,
          speed:  clamp(unit.speed+(unit.status==="EXECUTING"?(Math.random()-0.5)*2:0),0,120),
          heading:((unit.heading+(isMoving?(Math.random()-0.5)*3:0))+360)%360,
        };
      }));
    },1500);
    return()=>clearInterval(telemetryRef.current);
  },[]);

  // D — Battery / Signal alerts
  useEffect(()=>{
    uxs.forEach(unit=>{
      const batKey=`${unit.id}-bat`, sigKey=`${unit.id}-sig`;
      if(unit.battery<20&&!alertedRef.current.has(batKey)){
        alertedRef.current.add(batKey);
        addLog(`ALERT: ${unit.id} BATTERY CRITICAL — ${Math.round(unit.battery)}%`,"PENDING");
      }
      if(unit.signal<30&&!alertedRef.current.has(sigKey)){
        alertedRef.current.add(sigKey);
        addLog(`ALERT: ${unit.id} SIGNAL LOW — ${Math.round(unit.signal)}%`,"PENDING");
      }
      if(unit.battery>=25) alertedRef.current.delete(batKey);  // 5% hysteresis
      if(unit.signal>=35)  alertedRef.current.delete(sigKey);  // 5% hysteresis
    });
  },[uxs,addLog]);

  // Step 10 — WebSocket connection to Python backend
  useEffect(()=>{
    const WS_URL = "ws://127.0.0.1:8765/ws";
    let reconnectTimer = null;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus("LIVE");
        addLog("DATALINK: Backend WebSocket connected — LIVE telemetry active","EXECUTED");
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "telemetry") {
          setUxs(prev => prev.map(unit =>
            unit.id === msg.droneId
              ? { ...unit,
                  lat:      msg.lat,
                  lng:      msg.lng,
                  altitude: msg.altitude,
                  battery:  msg.battery,
                  speed:    msg.speed,
                  heading:  msg.heading,
                  armed:    msg.armed,
                  status:   msg.flightMode === "STANDBY" ? "STANDBY"
                          : msg.flightMode === "HOLD"    ? "ACTIVE"
                          : "EXECUTING",
                }
              : unit
          ));
        } else if (msg.type === "ack") {
          addLog(`ACK [${msg.droneId}]: ${msg.message}`,"EXECUTED");
        }
      };

      ws.onerror = () => {
        setWsStatus("SIMULATED");
      };

      ws.onclose = () => {
        setWsStatus("SIMULATED");
        addLog("DATALINK: Backend disconnected — reverting to SIMULATED","PENDING");
        reconnectTimer = setTimeout(connect, 4000);
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  },[addLog]);

  const startListening=useCallback(()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Use Chrome or Edge for voice.");return;}
    const rec=new SR();
    rec.continuous=false;rec.interimResults=true;rec.lang="en-US";
    rec.onstart=()=>{setIsListening(true);setVoiceRaw("");setVoiceInterim("");setPipelineStage("VOICE");};
    rec.onresult=(e)=>{
      let interim="",final="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal)final+=e.results[i][0].transcript;
        else interim+=e.results[i][0].transcript;
      }
      setVoiceInterim(interim);
      if(final){setVoiceRaw(final.trim());setVoiceInterim("");}
    };
    rec.onerror=()=>{setIsListening(false);setPipelineStage(null);};
    rec.onend=()=>{setIsListening(false);setVoiceInterim("");};
    recognitionRef.current=rec;
    rec.start();
  },[]);

  const stopListening=useCallback(()=>{recognitionRef.current?.stop();setIsListening(false);},[]);
  const clearTranscript=useCallback(()=>{setVoiceRaw("");setVoiceInterim("");setPipelineStage(null);setManualInput("");setParsedCommand(null);},[]);
  const handleManualSubmit=useCallback(()=>{
    if(!manualInput.trim())return;
    setVoiceRaw(manualInput.trim());
    setManualInput("");
    setPipelineStage("VOICE");
  },[manualInput]);

  const executeCommand=useCallback((command)=>{
    const targets=command.targets||[];
    const newIds=[];
    setUxs(prev=>prev.map(unit=>{
      const isTarget=targets.includes(unit.id)||targets.includes("ALL")||targets.includes(unit.domain);
      if(!isTarget)return unit;
      newIds.push(unit.id);
      const action=command.action;
      const newStatus=
        action==="RTB"?"RTB":
        action==="HOLD"?"ACTIVE":
        action==="LAND"?"STANDBY":
        "EXECUTING";
      const taskStr=command.area?`${action} — ${command.area}`:action;
      // Handle altitude changes for air units
      const altUpdate=
        action==="TAKEOFF"?{altitude:20,status:"ACTIVE"}:
        action==="LAND"?{altitude:0,status:"STANDBY"}:
        {};
      return{...unit,status:newStatus,...altUpdate,tasks:[taskStr]};
    }));
    // Flash executed units on map
    setExecutedIds(newIds);
    setTimeout(()=>setExecutedIds([]),3000);
    setPipelineStage("EXECUTE");
    addLog(`EXECUTED: ${command.action} → [${(command.targets||[]).join(",")}]`,"EXECUTED");

    // Forward to backend if WebSocket is live
    if(wsRef.current?.readyState===WebSocket.OPEN){
      newIds.forEach(droneId=>{
        wsRef.current.send(JSON.stringify({
          type:"command",
          droneId,
          action:command.action,
          params:command.area?{area:command.area}:{},
          timestamp:zuluNow(),
        }));
      });
    }
    setTimeout(()=>{setPipelineStage(null);setParsedCommand(null);},3000);
  },[addLog]);

  const handleIFF=useCallback((command)=>{
    const iffResult=runIFFCheck(command,INITIAL_UXS,CONTACTS);
    if(iffResult.requiresConfirm){
      setPipelineStage("CONFIRM");
      setPendingConfirm({command,iffResult});
      addLog(`IFF ALERT: ${iffResult.flags.map(f=>f.type).join(", ")} — awaiting authorization`,"PENDING");
    }else{
      addLog("IFF: CLEAR — auto-executing low-risk command","INFO");
      executeCommand(command);
    }
  },[addLog,executeCommand]);

  const handleAuthorize=useCallback(()=>{
    if(!pendingConfirm)return;
    addLog(`AUTHORIZED — executing ${pendingConfirm.command.action}`,"EXECUTED");
    const cmd=pendingConfirm.command;
    setPendingConfirm(null);
    executeCommand(cmd);
  },[pendingConfirm,addLog,executeCommand]);

  const handleDeny=useCallback(()=>{
    if(!pendingConfirm)return;
    addLog(`DENIED by operator — ${pendingConfirm.command.action} aborted`,"DENIED");
    setPendingConfirm(null);
    setPipelineStage(null);
    setParsedCommand(null);
  },[pendingConfirm,addLog]);

  const parseCommand=useCallback(async(text)=>{
    if(!text||!text.trim())return;
    setPipelineStage("PARSE");
    setIsProcessing(true);
    setParsedCommand(null);
    addLog(`VOICE: "${text}"`,"INFO");
    const fleetSummary=INITIAL_UXS.map(u=>`${u.id} (${u.label}, ${u.domain}, status:${u.status}, armed:${u.armed})`).join("; ");
    const contactSummary=CONTACTS.map(c=>`${c.id}:${c.label}[${c.iff}]`).join(", ");
    const waypointSummary=WAYPOINTS.map(w=>`${w.id} (${w.label})`).join(", ");
    const systemPrompt=`You are a military C2 AI for CAF Uncrewed Systems operations.
Parse battlefield voice commands into structured JSON operational tasks.
Available UxS fleet: ${fleetSummary}
Known battlefield contacts: ${contactSummary}
Named waypoints: ${waypointSummary}
Respond with ONLY a valid JSON object. No explanation, no markdown, no backticks.
Use this exact schema:
{"targets":["array of UxS IDs, or ALL, or domain like AIR/LAND/MARITIME"],"action":"RECON|MOVE|HOLD|RTB|STRIKE|ENGAGE|PATROL|LOITER|SCAN|ARM|DISARM|STATUS|TAKEOFF|LAND|GOTO|SCOUT","area":"location, sector, or waypoint ID (e.g. WP-A) or null","contact":"contact ID or label if targeting a specific contact or null","priority":"IMMEDIATE|URGENT|ROUTINE","riskLevel":"HIGH|MEDIUM|LOW","message":"one sentence plain English summary of the command"}
TAKEOFF = launch an AIR unit from ground. LAND = bring an AIR unit down. GOTO = navigate to a named waypoint or area. SCOUT = advance recon of an area or contact.
HIGH risk = any action involving weapons, engagement, strike, fire, destroy, neutralize.
MEDIUM risk = GOTO into unknown/contested areas, SCOUT near FOE contacts.
LOW risk = TAKEOFF, LAND, RECON, PATROL, HOLD, RTB, STATUS, SCOUT in clear areas.`;
    try{
      const response=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:400,system:systemPrompt,messages:[{role:"user",content:text}]}),
      });
      if(!response.ok){const eb=await response.json();throw new Error(`API error: ${response.status} — ${JSON.stringify(eb)}`);}
      const data=await response.json();
      const rawText=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
      const clean=rawText.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      setParsedCommand(parsed);
      addLog(`PARSED: ${parsed.action} → [${(parsed.targets||[]).join(",")}] — ${parsed.riskLevel} RISK`,"PARSED");
      handleIFF(parsed);
    }catch(err){
      console.error("Parse error:",err);
      addLog(`PARSE FAILED: ${err.message}`,"DENIED");
      setPipelineStage("VOICE");
    }finally{
      setIsProcessing(false);
    }
  },[addLog,handleIFF]);

  // F — Keyboard shortcuts (after parseCommand so deps are defined)
  useEffect(()=>{
    const handler=(e)=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
      if(e.key==="v"||e.key==="V"){if(!isListening) startListening();}
      if(e.key==="Escape"){
        stopListening();
        if(pendingConfirm) handleDeny();
        else clearTranscript();
      }
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[isListening,startListening,stopListening,pendingConfirm,handleDeny,clearTranscript]);

  useEffect(()=>{
    const handler=(e)=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
      if(e.key==="Enter"&&voiceRaw&&!isProcessing&&!isListening) parseCommand(voiceRaw);
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[voiceRaw,isProcessing,isListening,parseCommand]);

  const selectedUnit = uxs.find(u => u.id === selectedUxs) || null;

  return(
    <>
      <style>{STYLES}</style>
      <div style={{width:"100vw",height:"100vh",display:"flex",flexDirection:"column",background:"var(--bg-void)",overflow:"hidden"}}>
        <TopBar time={time} missionElapsed={missionElapsed} isProcessing={isProcessing} wsStatus={wsStatus}/>
        <div style={{flex:1,display:"grid",gridTemplateColumns:"280px 1fr 320px",overflow:"hidden"}}>
          <FleetPanel uxs={uxs} selectedId={selectedUxs} onSelect={setSelectedUxs}/>

          {/* Tactical map column — position:relative so overlays work */}
          <div style={{position:"relative",overflow:"hidden"}}>
            <TacticalMap
              uxs={uxs}
              contacts={CONTACTS}
              waypoints={WAYPOINTS}
              selectedId={selectedUxs}
              executedIds={executedIds}
              tick={tick}
              onSelectUnit={setSelectedUxs}
            />
            {/* E — Mission Brief toggle button in map area */}
            <button
              onClick={()=>setShowBrief(v=>!v)}
              style={{position:"absolute",top:"12px",left:"50%",transform:"translateX(-50%)",
                background:showBrief?"rgba(0,212,255,0.15)":"rgba(0,255,65,0.08)",
                border:`1px solid ${showBrief?"var(--cyan-air)":"var(--border)"}`,
                color:showBrief?"var(--cyan-air)":"var(--text-dim)",
                fontFamily:"var(--font-display)",fontSize:"8px",letterSpacing:"2px",
                padding:"4px 12px",cursor:"pointer",zIndex:5}}
            >
              {showBrief?"▲ CLOSE BRIEF":"▼ MISSION BRIEF"}
            </button>
            {/* E — Mission Brief Panel overlay */}
            {showBrief&&<MissionBriefPanel onClose={()=>setShowBrief(false)}/>}
            {/* C — Unit Detail Panel overlay */}
            {selectedUnit&&(
              <UnitDetailPanel
                unit={selectedUnit}
                onClose={()=>setSelectedUxs(null)}
              />
            )}
          </div>

          <CommandPanel
            isListening={isListening} voiceRaw={voiceRaw} voiceInterim={voiceInterim}
            pipelineStage={pipelineStage} isProcessing={isProcessing}
            parsedCommand={parsedCommand} commandLog={commandLog} manualInput={manualInput}
            onStartListen={startListening} onStopListen={stopListening}
            onManualChange={setManualInput} onManualSubmit={handleManualSubmit}
            onClear={clearTranscript} onProcess={()=>parseCommand(voiceRaw)}
          />
        </div>
      </div>
      {pendingConfirm&&(
        <ConfirmationModal
          command={pendingConfirm.command}
          iffResult={pendingConfirm.iffResult}
          onAuthorize={handleAuthorize}
          onDeny={handleDeny}
        />
      )}
    </>
  );
}