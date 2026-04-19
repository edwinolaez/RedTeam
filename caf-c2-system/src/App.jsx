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
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

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
const INVALID_ACTIONS = ["SELF-DESTRUCT","SELF_DESTRUCT","KAMIKAZE","LAUNCH MISSILE","FIRE MISSILE","DROP BOMB","SHOOT","FIRE WEAPONS","KILL","TURN OFF ENGINES"];
const NO_GO_ZONES = [
  {name:"Fuel Depot",   keywords:["fuel depot","fuel_depot","FUEL_DEPOT"], rule:"NO ENTRY AT ANY ALTITUDE", msg:"Command rejected — Fuel Depot is a no-go zone. No flight within 10m radius at any altitude."},
  {name:"Comms Tower",  keywords:["comms tower","comms_tower","COMMS_TOWER"], rule:"SAFE ONLY ABOVE 25m AGL", msg:"Command rejected — Comms Tower no-fly zone. Must be above 25m AGL to operate within 8m radius.", minAlt:25},
];
const clamp = (v,mn,mx) => Math.max(mn,Math.min(mx,v));
const zuluNow = () => new Date().toUTCString().slice(17,25)+"Z";

// Compound center: 32.990°N, 106.975°W | DEG_PER_M ≈ 0.000009
const INITIAL_UXS = [
  {id:"UAV-01",label:"Raven Alpha", domain:"AIR", status:"STANDBY", battery:95, signal:98, altitude:0, speed:0, heading:353, lat:32.990000, lng:-106.975360, payload:"EO/IR Sensor", armed:false, mission:"RECON", tasks:[]},
  {id:"UAV-02",label:"Raven Bravo", domain:"AIR", status:"STANDBY", battery:88, signal:94, altitude:0, speed:0, heading:45,  lat:32.990333, lng:-106.974900, payload:"SAR Radar",    armed:false, mission:"PATROL", tasks:[]},
];

const CONTACTS = [
  {id:"C-001",iff:"FRIEND", label:"Alpha Squad",      type:"GROUND_UNIT", lat:32.990225,lng:-106.975180},
  {id:"C-002",iff:"FOE",    label:"Hostile Victor-1", type:"VEHICLE",     lat:32.990333,lng:-106.974600},
  {id:"C-003",iff:"UNKNOWN",label:"Contact Unknown",  type:"DISMOUNT",    lat:32.990090,lng:-106.974900},
  {id:"C-004",iff:"FRIEND", label:"Bravo Team",       type:"GROUND_UNIT", lat:32.990090,lng:-106.974820},
  {id:"C-005",iff:"FOE",    label:"Hostile Papa-7",   type:"EMPLACEMENT", lat:32.989820,lng:-106.974658},
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
  {id:"LANDING_PAD",  label:"Landing Pad",       lat:32.990000, lng:-106.975360, enu_x:-40, enu_y:  0},
  {id:"WEST_GATE",    label:"West Gate",          lat:32.990000, lng:-106.975540, enu_x:-60, enu_y:  0},
  {id:"NW_TOWER",     label:"NW Watch Tower",     lat:32.990333, lng:-106.975513, enu_x:-57, enu_y: 37},
  {id:"NE_TOWER",     label:"NE Watch Tower",     lat:32.990333, lng:-106.974487, enu_x: 57, enu_y: 37},
  {id:"SW_TOWER",     label:"SW Watch Tower",     lat:32.989667, lng:-106.975513, enu_x:-57, enu_y:-37},
  {id:"SE_TOWER",     label:"SE Watch Tower",     lat:32.989667, lng:-106.974487, enu_x: 57, enu_y:-37},
  {id:"CMD_BUILDING", label:"Command Building",   lat:32.990090, lng:-106.974820, enu_x: 20, enu_y: 10},
  {id:"ROOFTOP",      label:"Rooftop Structure",  lat:32.990126, lng:-106.974775, enu_x: 25, enu_y: 14},
  {id:"BARRACKS_1",   label:"Barracks 1",         lat:32.990225, lng:-106.975180, enu_x:-20, enu_y: 25},
  {id:"BARRACKS_2",   label:"Barracks 2",         lat:32.989775, lng:-106.975180, enu_x:-20, enu_y:-25},
  {id:"MOTOR_POOL",   label:"Motor Pool",         lat:32.989820, lng:-106.974658, enu_x: 38, enu_y:-20},
  {id:"CONTAINERS",   label:"Shipping Containers",lat:32.989865, lng:-106.975000, enu_x:  0, enu_y:-15},
  {id:"COMMS_TOWER",  label:"Comms Tower ⚠",     lat:32.990270, lng:-106.974640, enu_x: 40, enu_y: 30},
  {id:"FUEL_DEPOT",   label:"Fuel Depot ⛔",      lat:32.989712, lng:-106.975243, enu_x:-27, enu_y:-32},
  {id:"RUBBLE",       label:"Rubble Area",        lat:32.990180, lng:-106.975045, enu_x: -5, enu_y: 20},
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
  // No-go zone check
  const areaLower=(parsedCommand.area||"").toLowerCase();
  for(const zone of NO_GO_ZONES){
    const hit=zone.keywords.some(k=>areaLower.includes(k.toLowerCase()));
    if(hit){
      const alt=parsedCommand.altitude||0;
      if(!zone.minAlt||alt<zone.minAlt){
        flags.push({type:"NO_GO_ZONE",severity:"CRITICAL",message:zone.msg});
        requiresConfirm=false;  // hard reject — no confirmation allowed
        return{requiresConfirm,flags,warnings,targetContact,targetUnits,isHighRiskAction,armedTargets,hardReject:true,rejectMsg:zone.msg};
      }
    }
  }
  // Invalid action check
  const actionRaw=(parsedCommand.action||"").toUpperCase();
  const isInvalid=INVALID_ACTIONS.some(inv=>actionRaw.includes(inv)||areaLower.includes(inv.toLowerCase()));
  if(isInvalid){
    const msg=`Command rejected — "${parsedCommand.action}" is not a valid drone operation.`;
    flags.push({type:"INVALID_ACTION",severity:"CRITICAL",message:msg});
    return{requiresConfirm,flags,warnings,targetContact,targetUnits,isHighRiskAction,armedTargets,hardReject:true,rejectMsg:msg};
  }
  return{requiresConfirm,flags,warnings,targetContact,targetUnits,isHighRiskAction,armedTargets,hardReject:false};
}

// ─────────────────────────────────────────────────────────────
// COMPONENT: TacticalMap — 3D Three.js Rendering
// ─────────────────────────────────────────────────────────────
const ENU_CENTER = { lat: 32.990000, lng: -106.975360 };
const DEG_PER_M  = 0.000009;
function toENU(lat, lng) {
  return [
    (lng - ENU_CENTER.lng) / DEG_PER_M,
    0,
    -((lat - ENU_CENTER.lat) / DEG_PER_M),
  ];
}

const STRUCTURES_3D = [
  { id:"CMD",    pos:[20,  0,-10], size:[15,8,15],  color:"#0d1f0d", emissive:"#164716" },
  { id:"BAR1",   pos:[-20, 0,-25], size:[20,5,10],  color:"#0a1a0a", emissive:"#112411" },
  { id:"BAR2",   pos:[-20, 0, 25], size:[20,5,10],  color:"#0a1a0a", emissive:"#112411" },
  { id:"MPOOL",  pos:[38,  0, 20], size:[18,3,15],  color:"#131208", emissive:"#1f1c0a" },
  { id:"CONT1",  pos:[-3,  0, 15], size:[ 7,4, 3],  color:"#0a1212", emissive:"#0e1e1e" },
  { id:"CONT2",  pos:[ 5,  0, 15], size:[ 7,4, 3],  color:"#0a1212", emissive:"#0e1e1e" },
  { id:"ROOF",   pos:[25,  0,-14], size:[ 6,5, 6],  color:"#0d1a0d", emissive:"#152515" },
  { id:"RUBBLE", pos:[-3,  0, 20], size:[ 4,2, 3],  color:"#0e1208", emissive:"#121508" },
];
const TOWER_POSITIONS_3D = [[-57,-37],[57,-37],[-57,37],[57,37]];

function Building3D({ pos, size, color, emissive }) {
  const [w,h,d] = size;
  return (
    <mesh position={[pos[0], h/2, pos[2]]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.3} roughness={0.85} metalness={0.1} />
    </mesh>
  );
}

function WatchTower3D({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0,5,0]} castShadow>
        <boxGeometry args={[2,10,2]} />
        <meshStandardMaterial color="#0d2010" emissive="#00ff41" emissiveIntensity={0.08} roughness={0.9} />
      </mesh>
      <mesh position={[0,10.5,0]} castShadow>
        <boxGeometry args={[4,1,4]} />
        <meshStandardMaterial color="#0d2010" emissive="#00ff41" emissiveIntensity={0.12} roughness={0.9} />
      </mesh>
      <mesh position={[0,11.3,0]}>
        <sphereGeometry args={[0.35,8,8]} />
        <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={3} />
      </mesh>
      <pointLight position={[0,11.3,0]} color="#00ff41" intensity={1.5} distance={30} decay={2} />
    </group>
  );
}

function CommsTower3D() {
  const beaconRef = useRef();
  useFrame(({ clock }) => {
    if (beaconRef.current) {
      beaconRef.current.material.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime*3)*0.4;
    }
  });
  return (
    <group position={[40,0,-30]}>
      <mesh position={[0,10,0]} castShadow>
        <boxGeometry args={[1.5,20,1.5]} />
        <meshStandardMaterial color="#1a1200" emissive="#f59e0b" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[3,20,0]} rotation={[0,0,-0.5]}>
        <boxGeometry args={[5,0.3,0.3]} />
        <meshStandardMaterial color="#1a1200" emissive="#f59e0b" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0,21,0]} rotation={[0.4,0,0]}>
        <cylinderGeometry args={[2.5,0.4,1,12]} />
        <meshStandardMaterial color="#1a1200" emissive="#f59e0b" emissiveIntensity={0.25} />
      </mesh>
      <mesh ref={beaconRef} position={[0,21.5,0]}>
        <sphereGeometry args={[0.4,8,8]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} />
      </mesh>
      <pointLight position={[0,21,0]} color="#f59e0b" intensity={2} distance={40} decay={2} />
      <mesh position={[0,0.05,0]} rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[8,9,32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.12} side={2} />
      </mesh>
    </group>
  );
}

function FuelDepot3D() {
  return (
    <group position={[-27,0,32]}>
      <mesh position={[0,1.5,0]} castShadow>
        <boxGeometry args={[12,3,12]} />
        <meshStandardMaterial color="#1a0505" emissive="#ef4444" emissiveIntensity={0.15} roughness={0.9} />
      </mesh>
      {[[-3,0,-3],[3,0,-3],[0,0,3]].map(([tx,,tz],i) => (
        <mesh key={i} position={[tx,3.5,tz]} castShadow>
          <cylinderGeometry args={[1.8,1.8,5,12]} />
          <meshStandardMaterial color="#220404" emissive="#ef4444" emissiveIntensity={0.1} />
        </mesh>
      ))}
      <mesh position={[0,0.05,0]} rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[10,12,32]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.12} side={2} />
      </mesh>
      <pointLight position={[0,6,0]} color="#ef4444" intensity={1} distance={25} decay={2} />
    </group>
  );
}

function FoePulseRings({ color }) {
  const r1 = useRef(), r2 = useRef();
  useFrame(({ clock }) => {
    const t1 = clock.elapsedTime % 2.5;
    const t2 = (clock.elapsedTime + 1.25) % 2.5;
    if (r1.current) {
      const s = 1 + t1 * 4;
      r1.current.scale.set(s,1,s);
      if (r1.current.material) r1.current.material.opacity = Math.max(0, 0.5 - t1/2.5*0.5);
    }
    if (r2.current) {
      const s = 1 + t2 * 4;
      r2.current.scale.set(s,1,s);
      if (r2.current.material) r2.current.material.opacity = Math.max(0, 0.5 - t2/2.5*0.5);
    }
  });
  return (
    <>
      <mesh ref={r1} position={[0,-1.2,0]} rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[1.8,2.2,32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={2} />
      </mesh>
      <mesh ref={r2} position={[0,-1.2,0]} rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[1.8,2.2,32]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} side={2} />
      </mesh>
    </>
  );
}

function ContactMarker3D({ contact }) {
  const meshRef = useRef();
  const iff = IFF_META[contact.iff] || IFF_META.NEUTRAL;
  const isFoe = contact.iff === "FOE";
  const [ex,,ez] = toENU(contact.lat, contact.lng);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.008;
      meshRef.current.position.y = 1.5 + Math.sin(clock.elapsedTime*1.2 + ex)*0.3;
      if (isFoe && meshRef.current.material) {
        meshRef.current.material.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime*3)*0.35;
      }
    }
  });
  return (
    <group position={[ex, 0, ez]}>
      <mesh ref={meshRef} castShadow>
        <octahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial color={iff.color} emissive={iff.color} emissiveIntensity={0.5} metalness={0.2} roughness={0.5} transparent opacity={0.9} />
      </mesh>
      <pointLight color={iff.color} intensity={0.6} distance={12} decay={2} />
      {isFoe && <FoePulseRings color={iff.color} />}
    </group>
  );
}

const ARM_OFFSETS = [[-2,0,-2],[2,0,-2],[-2,0,2],[2,0,2]];

function DroneUnit3D({ unit, isSelected, onSelect }) {
  const groupRef = useRef();
  const r0 = useRef(), r1 = useRef(), r2 = useRef(), r3 = useRef();
  const rotorRefs = [r0, r1, r2, r3];
  const [ex,,ez] = toENU(unit.lat, unit.lng);
  const isAir = unit.domain === "AIR";
  const baseAlt = isAir ? (unit.altitude > 0 ? unit.altitude : (unit.status !== "STANDBY" && unit.status !== "OFFLINE" ? 18 : 3)) : 0.5;
  const domainColor = DOMAIN_META[unit.domain]?.hex || "#00d4ff";
  const isMoving = unit.status === "ACTIVE" || unit.status === "EXECUTING";
  useFrame(({ clock }) => {
    const speed = isMoving ? 0.25 : 0.04;
    rotorRefs.forEach((r, i) => {
      if (r.current) r.current.rotation.y += (i % 2 === 0 ? speed : -speed);
    });
    if (groupRef.current && isAir) {
      groupRef.current.position.y = baseAlt + Math.sin(clock.elapsedTime*1.8 + ex*0.1)*0.7;
    }
  });
  return (
    <group ref={groupRef} position={[ex, baseAlt, ez]} onClick={(e) => { e.stopPropagation(); onSelect(unit.id); }}>
      <mesh castShadow>
        <boxGeometry args={[2.8,0.55,2.8]} />
        <meshStandardMaterial color={domainColor} emissive={domainColor} emissiveIntensity={isSelected?0.9:0.45} metalness={0.75} roughness={0.25} />
      </mesh>
      {ARM_OFFSETS.map(([ax,,az], i) => (
        <group key={i} position={[ax,0,az]}>
          <mesh>
            <boxGeometry args={[0.2,0.1,0.2]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh ref={rotorRefs[i]} position={[0,0.22,0]}>
            <cylinderGeometry args={[1.0,1.0,0.04,16]} />
            <meshStandardMaterial color={domainColor} emissive={domainColor} emissiveIntensity={0.9} transparent opacity={0.7} side={2} />
          </mesh>
        </group>
      ))}
      <mesh position={[0,-0.45,0.9]}>
        <sphereGeometry args={[0.25,8,8]} />
        <meshStandardMaterial color="#111" emissive="#ff5500" emissiveIntensity={0.6} />
      </mesh>
      {unit.armed && (
        <mesh position={[0.7,0.4,-0.7]}>
          <sphereGeometry args={[0.2,6,6]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.5} />
        </mesh>
      )}
      {isSelected && (
        <mesh rotation={[-Math.PI/2,0,0]}>
          <ringGeometry args={[3.2,3.6,32]} />
          <meshBasicMaterial color={domainColor} transparent opacity={0.75} side={2} />
        </mesh>
      )}
      <pointLight color={domainColor} intensity={isSelected?2.5:0.8} distance={18} decay={2} />
      {isAir && (
        <mesh position={[0,-baseAlt/2,0]}>
          <cylinderGeometry args={[0.02,0.02,baseAlt,4]} />
          <meshBasicMaterial color={domainColor} transparent opacity={0.25} />
        </mesh>
      )}
    </group>
  );
}

function WaypointMarker3D({ wp }) {
  const meshRef = useRef();
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.012;
      meshRef.current.position.y = 2 + Math.sin(clock.elapsedTime*1.5 + wp.enu_x)*0.4;
    }
  });
  return (
    <group position={[wp.enu_x, 0, -wp.enu_y]}>
      <mesh ref={meshRef} castShadow>
        <coneGeometry args={[0.8,3,6]} />
        <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.5} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0,0.06,0]} rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[0.5,1.2,16]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.35} side={2} />
      </mesh>
    </group>
  );
}

function CompoundPerimeter() {
  return (
    <group>
      {[[0,0,40,120,1,1],[0,0,-40,120,1,1],[60,0,0,1,1,80],[-60,0,0,1,1,80]].map(([px,py,pz,sw,sh,sd],i)=>(
        <mesh key={i} position={[px,0.5,pz]}>
          <boxGeometry args={[sw,sh,sd]} />
          <meshStandardMaterial color="#0a1f0a" emissive="#00ff41" emissiveIntensity={0.06} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Scene3D({ uxs, contacts, waypoints, selectedId, executedIds, onSelectUnit }) {
  return (
    <>
      <ambientLight intensity={0.12} color="#001a06" />
      <directionalLight position={[60,100,40]} intensity={0.5} color="#00ff41" castShadow shadow-mapSize={[1024,1024]} />
      <fog attach="fog" args={["#000000", 90, 320]} />
      <mesh rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[400,400]} />
        <meshStandardMaterial color="#010601" roughness={1} />
      </mesh>
      <gridHelper args={[400,80,"#071509","#030903"]} position={[0,0.01,0]} />
      <CompoundPerimeter />
      {TOWER_POSITIONS_3D.map(([x,z],i) => <WatchTower3D key={i} x={x} z={z} />)}
      {STRUCTURES_3D.map(s => <Building3D key={s.id} pos={s.pos} size={s.size} color={s.color} emissive={s.emissive} />)}
      <CommsTower3D />
      <FuelDepot3D />
      {(waypoints||[]).map(wp => <WaypointMarker3D key={wp.id} wp={wp} />)}
      {contacts.map(c => <ContactMarker3D key={c.id} contact={c} />)}
      {uxs.map(unit => <DroneUnit3D key={unit.id} unit={unit} isSelected={unit.id===selectedId} onSelect={onSelectUnit} />)}
    </>
  );
}

function TacticalMap({ uxs, contacts, waypoints, selectedId, executedIds, tick, onSelectUnit }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bg-void)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"3px", height:"20px", background:"var(--cyan-air)", boxShadow:"0 0 8px var(--cyan-air)" }}/>
          <span style={{ fontFamily:"var(--font-display)", fontSize:"11px", letterSpacing:"3px", color:"var(--cyan-air)", fontWeight:700 }}>&#8853; TACTICAL DISPLAY &mdash; 3D</span>
        </div>
        <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
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
          <span style={{ fontSize:"8px", color:"var(--text-dim)", letterSpacing:"1px" }}>DRAG&middot;ORBIT | SCROLL&middot;ZOOM | CLICK&middot;SELECT</span>
        </div>
      </div>
      <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
        <Canvas
          shadows
          camera={{ position:[0,90,70], fov:45, near:0.1, far:1000 }}
          style={{ background:"#000000", width:"100%", height:"100%" }}
          gl={{ antialias:true, alpha:false }}
        >
          <Scene3D
            uxs={uxs}
            contacts={contacts}
            waypoints={waypoints}
            selectedId={selectedId}
            executedIds={executedIds}
            onSelectUnit={onSelectUnit}
          />
          <OrbitControls
            target={[0,0,0]}
            minDistance={15}
            maxDistance={250}
            maxPolarAngle={Math.PI/2.1}
            makeDefault
          />
        </Canvas>
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
    let hasLoggedDisconnect = false;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus("LIVE");
        hasLoggedDisconnect = false;
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
        if(!hasLoggedDisconnect){
          hasLoggedDisconnect = true;
          addLog("DATALINK: Backend disconnected — reverting to SIMULATED","PENDING");
        }
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
          params:{
            area:     command.area||null,
            altitude: command.altitude||null,
            local_x:  command.local_x||null,
            local_y:  command.local_y||null,
          },
          timestamp:zuluNow(),
        }));
      });
    }
    setTimeout(()=>{setPipelineStage(null);setParsedCommand(null);},3000);
  },[addLog]);

  const handleIFF=useCallback((command)=>{
    const iffResult=runIFFCheck(command,INITIAL_UXS,CONTACTS);
    if(iffResult.hardReject){
      addLog(`IFF: REJECTED — ${iffResult.rejectMsg}`,"DENIED");
      setPipelineStage(null);
      setParsedCommand(null);
      return;
    }
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
    const systemPrompt=`You are a military drone C2 AI for a simulated compound operation.
COMPOUND CENTER: 32.990°N, 106.975°W | DRONE HOME: Landing Pad at local ENU (-40, 0)

KNOWN LOCATIONS (use exact id and local ENU x,y):
LANDING_PAD(-40,0) WEST_GATE(-60,0) NW_TOWER(-57,37) NE_TOWER(57,37) SW_TOWER(-57,-37) SE_TOWER(57,-37)
CMD_BUILDING(20,10) ROOFTOP(25,14) BARRACKS_1(-20,25) BARRACKS_2(-20,-25)
MOTOR_POOL(38,-20) CONTAINERS(0,-15) COMMS_TOWER(40,30) FUEL_DEPOT(-27,-32) RUBBLE(-5,20)

NO-GO ZONES (ALWAYS set valid:false):
1. FUEL_DEPOT(-27,-32): No flight within 10m at ANY altitude
2. COMMS_TOWER(40,30): No flight within 8m below 25m AGL

INVALID ACTIONS (ALWAYS set valid:false): self-destruct, kamikaze, launch missile, fire weapons, shoot, attack, drop bomb, turn off engines

VALID ACTIONS: TAKEOFF, LAND, GOTO, RTB, HOVER, ORBIT, DESCEND, ASCEND, REPORT, SCOUT

Available fleet: ${fleetSummary}
Known contacts: ${contactSummary}

Respond ONLY with valid JSON. No markdown, no backticks.
Schema:
{"targets":["UAV-01"],"action":"TAKEOFF|LAND|GOTO|RTB|HOVER|ORBIT|DESCEND|ASCEND|REPORT|SCOUT","area":"location id or null","local_x":number_or_null,"local_y":number_or_null,"altitude":number_or_null,"contact":"contact id or null","priority":"IMMEDIATE|URGENT|ROUTINE","riskLevel":"HIGH|MEDIUM|LOW","valid":true_or_false,"rejection_reason":"string or null","message":"one sentence summary"}
HIGH risk = weapons/engagement. MEDIUM = GOTO unknown/FOE area. LOW = TAKEOFF/LAND/RECON/HOLD/RTB.`;
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
      // Claude signals invalid/rejected commands via valid:false
      if(parsed.valid===false){
        addLog(`IFF: REJECTED — ${parsed.rejection_reason||"Command rejected — invalid operation"}`,"DENIED");
        setPipelineStage(null);
        return;
      }
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