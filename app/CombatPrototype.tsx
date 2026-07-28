"use client";

import { Canvas } from "@react-three/fiber";
import { Grid, Line, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import {
  Activity,
  Box,
  Braces,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Crosshair,
  Database,
  Eye,
  EyeOff,
  FastForward,
  GitBranch,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Swords,
  Target,
  TimerReset,
  Workflow,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";

const DURATION = 18;

type Playback = {
  phase: "Phase 1" | "Phase 2";
  state: string;
  action: string;
  reason: string;
  status: "준비" | "실행" | "회복";
  bossHp: number;
  distance: number;
  targetVisible: boolean;
};

function playbackAt(time: number): Playback {
  if (time < 4) {
    return {
      phase: "Phase 1",
      state: "Approach",
      action: "MoveToRange",
      reason: "타깃 거리 8.4m > 권장 거리 4.0m",
      status: "실행",
      bossHp: 100,
      distance: 8.4 - time * 1.1,
      targetVisible: true,
    };
  }
  if (time < 7) {
    return {
      phase: "Phase 1",
      state: "Arc Sweep",
      action: "Execute_Sweep",
      reason: "거리 조건 충족 · Sweep 쿨타임 완료",
      status: time < 5 ? "준비" : time < 5.7 ? "실행" : "회복",
      bossHp: 78,
      distance: 3.8,
      targetVisible: true,
    };
  }
  if (time < 9) {
    return {
      phase: "Phase 1",
      state: "Recover",
      action: "WaitRecovery",
      reason: "Sweep 후딜 1.4초가 남아 있음",
      status: "회복",
      bossHp: 68,
      distance: 4.1,
      targetVisible: true,
    };
  }
  if (time < 13) {
    return {
      phase: "Phase 2",
      state: "Reposition",
      action: "OrbitTarget",
      reason: "HP 60% 이하 · 돌진 진입각 확보",
      status: "실행",
      bossHp: 54,
      distance: 6.2,
      targetVisible: true,
    };
  }
  if (time < 15) {
    return {
      phase: "Phase 2",
      state: "Line Charge",
      action: "Execute_Charge",
      reason: "정면각 8° < 허용각 15° · 경로 확보",
      status: time < 14 ? "준비" : time < 14.8 ? "실행" : "회복",
      bossHp: 43,
      distance: time < 14 ? 7.1 : Math.max(1.2, 7.1 - (time - 14) * 7.2),
      targetVisible: true,
    };
  }
  return {
    phase: "Phase 2",
    state: "Recover",
    action: "WaitRecovery",
    reason: "Charge 후딜 · 다음 Selector 평가 대기",
    status: "회복",
    bossHp: 38,
    distance: 2.3,
    targetVisible: true,
  };
}

function Actor({
  position,
  color,
  accent,
  scale = 1,
  name,
}: {
  position: [number, number, number];
  color: string;
  accent: string;
  scale?: number;
  name: string;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.85, 0]}>
        <capsuleGeometry args={[0.46, 0.9, 8, 18]} />
        <meshStandardMaterial color={color} roughness={0.38} metalness={0.18} />
      </mesh>
      <mesh position={[0, 1.68, 0]}>
        <sphereGeometry args={[0.28, 20, 20]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.62, 0.7, 48]} />
        <meshBasicMaterial color={accent} transparent opacity={0.9} />
      </mesh>
      <sprite position={[0, 2.35, 0]} scale={[2.2, 0.42, 1]}>
        <spriteMaterial color="#111821" transparent opacity={0.86} />
      </sprite>
      <mesh visible={false} name={name} />
    </group>
  );
}

function Arena({
  time,
  showHitbox,
  showPath,
  showRange,
}: {
  time: number;
  showHitbox: boolean;
  showPath: boolean;
  showRange: boolean;
}) {
  const state = playbackAt(time);
  const bossPosition = useMemo<[number, number, number]>(() => {
    if (time < 4) return [0, 0, -5.8 + time * 0.78];
    if (time < 9) return [0, 0, -2.6];
    if (time < 13) {
      const angle = (time - 9) * 0.55;
      return [Math.sin(angle) * 4.2, 0, -Math.cos(angle) * 4.2];
    }
    if (time < 14) return [0, 0, -6.4];
    if (time < 14.8) return [0, 0, -6.4 + (time - 14) * 7.2];
    return [0, 0, -0.7];
  }, [time]);
  const playerPosition: [number, number, number] = [0.6, 0, 1.6];
  const sweepVisible = state.state === "Arc Sweep";
  const chargeVisible = state.state === "Line Charge";
  const activeColor = state.status === "실행" ? "#ff5b5b" : "#ffb24a";

  return (
    <>
      <color attach="background" args={["#0a1119"]} />
      <fog attach="fog" args={["#0a1119", 14, 28]} />
      <ambientLight intensity={0.72} />
      <directionalLight castShadow position={[6, 12, 5]} intensity={2.6} color="#d8f6ff" />
      <pointLight position={[-7, 4, -5]} intensity={38} distance={12} color="#26d7c5" />
      <PerspectiveCamera makeDefault position={[9.5, 9, 11]} fov={45} />
      <OrbitControls
        makeDefault
        target={[0, 0.7, -1.2]}
        minDistance={7}
        maxDistance={22}
        maxPolarAngle={Math.PI / 2.05}
      />
      <Grid
        args={[30, 30]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#243442"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#35606a"
        fadeDistance={24}
        fadeStrength={1.8}
        infiniteGrid
      />

      <Actor position={bossPosition} color="#24495b" accent="#42e0ce" scale={1.35} name="boss" />
      <Actor position={playerPosition} color="#485669" accent="#8fafff" name="player" />

      {showRange && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bossPosition[0], 0.025, bossPosition[2]]}>
          <ringGeometry args={[3.85, 3.94, 96]} />
          <meshBasicMaterial color="#4ddfce" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}

      {showPath && (
        <Line
          points={[
            [bossPosition[0], 0.12, bossPosition[2]],
            [bossPosition[0] * 0.55 + 0.3, 0.12, bossPosition[2] * 0.55 + 0.8],
            [playerPosition[0], 0.12, playerPosition[2]],
          ]}
          color="#5de6d5"
          lineWidth={1.6}
          dashed
          dashSize={0.28}
          gapSize={0.18}
        />
      )}

      {showHitbox && sweepVisible && (
        <group position={[bossPosition[0], 0.045, bossPosition[2]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[4.2, 64, 0.15, Math.PI * 1.25]} />
            <meshBasicMaterial
              color={activeColor}
              transparent
              opacity={state.status === "실행" ? 0.3 : 0.16}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[3.95, 4.12, 64, 1, 0.15, Math.PI * 1.25]} />
            <meshBasicMaterial color={activeColor} transparent opacity={0.95} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {showHitbox && chargeVisible && (
        <group position={[0.2, 0.04, -2.35]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.1, 8.7]} />
            <meshBasicMaterial
              color={activeColor}
              transparent
              opacity={state.status === "실행" ? 0.28 : 0.14}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <Line
            points={[
              [-1.05, 0.03, -4.35],
              [-1.05, 0.03, 4.35],
              [1.05, 0.03, 4.35],
              [1.05, 0.03, -4.35],
              [-1.05, 0.03, -4.35],
            ]}
            color={activeColor}
            lineWidth={2}
          />
        </group>
      )}
    </>
  );
}

const hfsmStates = [
  { name: "Boss Combat", depth: 0, type: "root" },
  { name: "Phase 1", depth: 1, type: "phase" },
  { name: "Approach", depth: 2, type: "state" },
  { name: "Arc Sweep", depth: 2, type: "state" },
  { name: "Recover", depth: 2, type: "state" },
  { name: "Phase 2", depth: 1, type: "phase" },
  { name: "Reposition", depth: 2, type: "state" },
  { name: "Line Charge", depth: 2, type: "state" },
  { name: "Recover", depth: 2, type: "state", phase: "Phase 2" },
] as const;

const segments = [
  { label: "접근", start: 0, end: 4, tone: "move" },
  { label: "Sweep 선딜", start: 4, end: 5, tone: "windup" },
  { label: "판정", start: 5, end: 5.7, tone: "active" },
  { label: "후딜", start: 5.7, end: 9, tone: "recover" },
  { label: "재배치", start: 9, end: 13, tone: "move" },
  { label: "Charge 선딜", start: 13, end: 14, tone: "windup" },
  { label: "판정", start: 14, end: 14.8, tone: "active" },
  { label: "후딜", start: 14.8, end: 18, tone: "recover" },
] as const;

export function CombatPrototype() {
  const [time, setTime] = useState(4.55);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showHitbox, setShowHitbox] = useState(true);
  const [showPath, setShowPath] = useState(true);
  const [showRange, setShowRange] = useState(false);
  const [activeTool, setActiveTool] = useState("simulate");
  const current = playbackAt(time);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setTime((value) => {
        const next = value + 0.08 * speed;
        return next >= DURATION ? 0 : next;
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, [playing, speed]);

  const activeStateMatches = (name: string, phase?: string) =>
    current.state === name && (!phase || current.phase === phase);

  return (
    <main className="workbench-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Swords size={18} /></div>
          <div>
            <strong>Combat Behavior Workbench</strong>
            <span>Boss_Guardian_A · Prototype</span>
          </div>
        </div>

        <nav className="view-tabs" aria-label="주요 보기">
          <button><Workflow size={15} />행동 구조</button>
          <button className="active"><Box size={15} />3D 시뮬레이션</button>
          <button><ShieldCheck size={15} />검증 결과 <b>2</b></button>
        </nav>

        <div className="top-actions">
          <span className="schema-link"><Database size={14} />Game Schema 연결됨</span>
          <button className="icon-action" aria-label="설정"><Settings2 size={17} /></button>
          <button className="primary-action">테스트 저장</button>
        </div>
      </header>

      <aside className="toolrail" aria-label="도구">
        {[
          { id: "simulate", label: "시뮬레이션", icon: <Play size={18} /> },
          { id: "hfsm", label: "HFSM", icon: <GitBranch size={18} /> },
          { id: "bt", label: "Behavior Tree", icon: <Workflow size={18} /> },
          { id: "blackboard", label: "Blackboard", icon: <Braces size={18} /> },
          { id: "data", label: "테이블 연결", icon: <Database size={18} /> },
        ].map((tool) => (
          <button
            key={tool.id}
            className={activeTool === tool.id ? "active" : ""}
            aria-label={tool.label}
            title={tool.label}
            onClick={() => setActiveTool(tool.id)}
          >
            {tool.icon}
          </button>
        ))}
      </aside>

      <section className="left-panel">
        <div className="panel-heading">
          <div><span>행동 구조</span><strong>Guardian HFSM</strong></div>
          <button aria-label="행동 구조 옵션"><Settings2 size={15} /></button>
        </div>

        <div className="section-label">상태 계층</div>
        <div className="state-tree">
          {hfsmStates.map((item, index) => {
            const active = activeStateMatches(item.name, "phase" in item ? item.phase : undefined)
              || item.name === current.phase;
            return (
              <button
                key={`${item.name}-${index}`}
                className={`state-row ${active ? "active" : ""} ${item.type}`}
                style={{ paddingLeft: 12 + item.depth * 17 }}
                onClick={() => {
                  const target = segments.find((segment) =>
                    item.name.toLowerCase().includes(segment.label.toLowerCase().split(" ")[0] ?? "")
                  );
                  if (target) setTime(target.start + 0.15);
                }}
              >
                {item.type !== "state" ? <ChevronDown size={13} /> : <CircleDot size={10} />}
                <span>{item.name}</span>
                {active && <i>ACTIVE</i>}
              </button>
            );
          })}
        </div>

        <div className="section-label with-line">전이 조건</div>
        <div className="condition-card active">
          <div><GitBranch size={14} /><strong>{current.phase === "Phase 1" ? "Phase 1 → Phase 2" : "행동 선택 유지"}</strong></div>
          <code>{current.phase === "Phase 1" ? "Boss.HP ≤ 60%" : "Target.Visible == true"}</code>
          <span>{current.phase === "Phase 1" ? "현재 68% · 미충족" : "현재 true · 충족"}</span>
        </div>
        <div className="condition-card">
          <div><TimerReset size={14} /><strong>Any → Stagger</strong></div>
          <code>Poise ≤ 0</code>
          <span>현재 42 · 미충족</span>
        </div>
      </section>

      <section className="center-stage">
        <div className="stage-toolbar">
          <div className="breadcrumb">
            <span>Boss_Guardian_A</span><ChevronRight size={13} />
            <strong>{current.phase}</strong><ChevronRight size={13} />
            <strong>{current.state}</strong>
          </div>
          <div className="viewport-toggles">
            <button className={showHitbox ? "active" : ""} onClick={() => setShowHitbox((value) => !value)}>
              {showHitbox ? <Eye size={14} /> : <EyeOff size={14} />}판정
            </button>
            <button className={showPath ? "active" : ""} onClick={() => setShowPath((value) => !value)}>
              <Activity size={14} />경로
            </button>
            <button className={showRange ? "active" : ""} onClick={() => setShowRange((value) => !value)}>
              <Crosshair size={14} />사거리
            </button>
          </div>
        </div>

        <div className="viewport">
          <Canvas shadows dpr={[1, 1.5]}>
            <Suspense fallback={null}>
              <Arena time={time} showHitbox={showHitbox} showPath={showPath} showRange={showRange} />
            </Suspense>
          </Canvas>
          <div className="viewport-hud top-left">
            <span className={`status-dot ${current.status}`}></span>
            <div><small>현재 행동</small><strong>{current.action}</strong></div>
          </div>
          <div className="viewport-hud top-right">
            <div><small>거리</small><strong>{current.distance.toFixed(1)} m</strong></div>
            <div><small>정면각</small><strong>{current.state === "Line Charge" ? "8°" : "21°"}</strong></div>
          </div>
          <div className="axis-legend">
            <span className="axis-x">X</span><span className="axis-y">Y</span><span className="axis-z">Z</span>
          </div>
          <div className="viewport-tip">드래그: 회전 · 휠: 확대/축소 · 우클릭: 이동</div>
        </div>

        <div className="transport">
          <div className="transport-buttons">
            <button aria-label="처음으로" onClick={() => setTime(0)}><SkipBack size={15} /></button>
            <button aria-label="이전 프레임" onClick={() => setTime((value) => Math.max(0, value - 0.1))}><RotateCcw size={15} /></button>
            <button className="play-button" aria-label={playing ? "일시정지" : "재생"} onClick={() => setPlaying((value) => !value)}>
              {playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
            </button>
            <button aria-label="다음 프레임" onClick={() => setTime((value) => Math.min(DURATION, value + 0.1))}><SkipForward size={15} /></button>
          </div>
          <button className="timecode" onClick={() => setSpeed((value) => value === 2 ? 0.5 : value === 0.5 ? 1 : 2)}>
            <FastForward size={14} /><b>{speed}×</b>
          </button>
          <div className="time-readout"><b>{time.toFixed(2)}</b><span>/ {DURATION.toFixed(2)} s</span></div>
        </div>

        <div className="timeline">
          <div className="timeline-ruler">
            {[0, 3, 6, 9, 12, 15, 18].map((mark) => <span key={mark} style={{ left: `${(mark / DURATION) * 100}%` }}>{mark}s</span>)}
          </div>
          <div className="timeline-track">
            {segments.map((segment) => (
              <button
                key={segment.label}
                className={`segment ${segment.tone}`}
                style={{
                  left: `${(segment.start / DURATION) * 100}%`,
                  width: `${((segment.end - segment.start) / DURATION) * 100}%`,
                }}
                onClick={() => setTime(segment.start + 0.05)}
              >
                {segment.label}
              </button>
            ))}
            <div className="playhead" style={{ left: `${(time / DURATION) * 100}%` }}><i /></div>
          </div>
          <input
            aria-label="시뮬레이션 시간"
            type="range"
            min="0"
            max={DURATION}
            step="0.01"
            value={time}
            onChange={(event) => {
              setPlaying(false);
              setTime(Number(event.target.value));
            }}
          />
        </div>
      </section>

      <aside className="right-panel">
        <div className="panel-heading">
          <div><span>실행 분석</span><strong>Decision Trace</strong></div>
          <span className="live-badge">LIVE</span>
        </div>

        <div className="decision-summary">
          <div className="summary-icon"><Target size={18} /></div>
          <div><small>선택된 Task</small><strong>{current.action}</strong><p>{current.reason}</p></div>
        </div>

        <div className="section-label with-line">Behavior Tree 경로</div>
        <div className="bt-path">
          {[
            { type: "Selector", name: "Combat Priority", state: "running" },
            { type: "Sequence", name: current.phase === "Phase 1" ? "Close Range Attack" : "Charge Opportunity", state: "running" },
            { type: "Condition", name: current.state === "Line Charge" ? "IsChargeAngleValid" : "IsTargetInRange", state: "success" },
            { type: "Task", name: current.action, state: current.status === "회복" ? "running" : "active" },
          ].map((node, index) => (
            <div className={`bt-node ${node.state}`} key={node.type}>
              <div className="bt-rail"><i />{index < 3 && <span />}</div>
              <div><small>{node.type}</small><strong>{node.name}</strong></div>
              <b>{node.state === "success" ? "PASS" : node.state === "active" ? "ACTIVE" : "RUN"}</b>
            </div>
          ))}
        </div>

        <div className="section-label with-line">Blackboard</div>
        <div className="blackboard">
          {[
            ["Target.Distance", `${current.distance.toFixed(1)} m`, "number"],
            ["Target.Visible", String(current.targetVisible), "boolean"],
            ["Boss.HP", `${current.bossHp}%`, "number"],
            ["Skill.Charge.Ready", time > 12 ? "true" : "false", "boolean"],
            ["Combat.Phase", current.phase.replace(" ", ""), "enum"],
          ].map(([key, value, type]) => (
            <div className="blackboard-row" key={key}>
              <span><i className={type} />{key}</span><b>{value}</b>
            </div>
          ))}
        </div>

        <div className="data-binding">
          <div><Database size={15} /><strong>테이블 바인딩</strong><span>정상</span></div>
          <p><code>Skill.SkillId</code> → <b>{current.state === "Line Charge" ? "skill_charge_02" : "skill_sweep_01"}</b></p>
          <p><code>Skill.CastRange</code> → <b>{current.state === "Line Charge" ? "8.0" : "4.2"}</b></p>
        </div>
      </aside>

      <footer className="statusbar">
        <span><i className="ok" />Simulation deterministic · Seed 1042</span>
        <span>60 FPS fixed step</span>
        <span>Schema revision <code>8e4c1a</code></span>
        <span className="status-spacer" />
        <span>오류 0</span>
        <span className="warning">경고 2</span>
      </footer>
    </main>
  );
}
