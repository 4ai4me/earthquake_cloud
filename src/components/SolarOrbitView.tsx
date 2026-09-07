import React, { useMemo } from 'react';
import { EarthDipoleConfig, EarthOrbitConfig, SolarWindConfig } from '../types';
import { computeEarthOrbitState, computeSunEarthCoupling } from '../physics/earthOrbit';
import { Pause, Play, Sun } from 'lucide-react';

interface SolarOrbitViewProps {
  config: EarthOrbitConfig;
  earthConfig: EarthDipoleConfig;
  solarWind: SolarWindConfig;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

export function SolarOrbitView({ config, earthConfig, solarWind, isPlaying, setIsPlaying }: SolarOrbitViewProps) {
  const state = useMemo(() => computeEarthOrbitState(config), [config]);
  const coupling = useMemo(() => computeSunEarthCoupling(config, earthConfig, solarWind), [config, earthConfig, solarWind]);
  const scale = 210 / Math.max(config.semiMajorAxisAu * (1 + config.eccentricity), 0.01);
  const sunX = 360;
  const sunY = 270;
  const earthX = sunX + state.xAu * scale;
  const earthY = sunY - state.yAu * scale;
  const orbitRx = config.semiMajorAxisAu * scale;
  const orbitRy = config.semiMajorAxisAu * Math.sqrt(1 - config.eccentricity ** 2) * scale;
  const ellipseCenterX = sunX - config.semiMajorAxisAu * config.eccentricity * scale;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_center,#111827_0%,#05070d_68%,#020308_100%)]" data-testid="solar-orbit-view">
      <svg className="h-full w-full" viewBox="0 0 720 540" role="img" aria-label="태양을 한 초점으로 하는 지구의 타원 공전 시뮬레이션">
        <defs>
          <radialGradient id="sun-glow"><stop offset="0" stopColor="#fff7ae"/><stop offset="0.35" stopColor="#fbbf24"/><stop offset="1" stopColor="#f97316" stopOpacity="0"/></radialGradient>
          <radialGradient id="earth-orbit-body"><stop offset="0" stopColor="#bfdbfe"/><stop offset="0.55" stopColor="#38bdf8"/><stop offset="1" stopColor="#075985"/></radialGradient>
          <filter id="orbit-glow"><feGaussianBlur stdDeviation="4"/></filter>
        </defs>
        {Array.from({ length: 80 }, (_, index) => {
          const x = (index * 83) % 720;
          const y = (index * 47 + 19) % 540;
          return <circle key={index} cx={x} cy={y} r={index % 7 === 0 ? 1.1 : 0.55} fill="#cbd5e1" opacity={0.25 + (index % 5) * 0.1}/>;
        })}
        <ellipse cx={ellipseCenterX} cy={sunY} rx={orbitRx} ry={orbitRy} fill="none" stroke="#334155" strokeWidth="6" opacity="0.35" filter="url(#orbit-glow)"/>
        <ellipse cx={ellipseCenterX} cy={sunY} rx={orbitRx} ry={orbitRy} fill="none" stroke="#67e8f9" strokeWidth="1.5" strokeDasharray="4 5"/>
        <line x1={sunX} y1={sunY} x2={earthX} y2={earthY} stroke="#fbbf24" strokeWidth="1" strokeDasharray="5 5" opacity="0.75"/>
        <line x1={sunX} y1={sunY} x2={earthX} y2={earthY} stroke="#f59e0b" strokeWidth="5" opacity="0.12"/>
        <circle cx={sunX} cy={sunY} r="48" fill="url(#sun-glow)"/>
        <circle cx={sunX} cy={sunY} r="17" fill="#fbbf24" stroke="#fde68a" strokeWidth="2"/>
        <text x={sunX} y={sunY + 70} fill="#fcd34d" fontSize="13" textAnchor="middle">태양 · 궤도 초점</text>
        <g transform={`translate(${earthX} ${earthY})`}>
          <circle r="17" fill="#38bdf8" opacity="0.25" filter="url(#orbit-glow)"/>
          <circle r="9" fill="url(#earth-orbit-body)" stroke="#bae6fd" strokeWidth="1.5"/>
          <line x1={-Math.sin(coupling.projectedDipoleAngleDeg * Math.PI / 180) * 17} y1={Math.cos(coupling.projectedDipoleAngleDeg * Math.PI / 180) * 17} x2={Math.sin(coupling.projectedDipoleAngleDeg * Math.PI / 180) * 17} y2={-Math.cos(coupling.projectedDipoleAngleDeg * Math.PI / 180) * 17} stroke="#f8fafc" strokeWidth="1.5"/>
          <text x="0" y="30" fill="#bae6fd" fontSize="13" textAnchor="middle">지구</text>
        </g>
        <text x="24" y="36" fill="#e2e8f0" fontSize="15" fontWeight="600">태양 중심 지구 공전 · 실제 이심률</text>
        <text x="24" y="58" fill="#94a3b8" fontSize="11">1 AU와 R_E 자기권 화면은 서로 다른 축척입니다.</text>
      </svg>
      <div className="absolute left-3 bottom-3 max-w-[calc(100%-7rem)] rounded-md border border-cyan-900/70 bg-slate-950/90 p-2.5 text-[11px] text-slate-300 shadow-xl backdrop-blur">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
          <span>평균근점이각</span><strong className="text-cyan-200">M {config.phaseAngleDeg.toFixed(2)}°</strong>
          <span>태양 중심 거리</span><strong className="text-cyan-200">{state.distanceAu.toFixed(5)} AU</strong>
          <span>거리</span><strong>{(state.distanceKm / 1_000_000).toFixed(3)} 백만 km</strong>
          <span>공전 속도</span><strong>{state.orbitalSpeedKmS.toFixed(2)} km/s</strong>
          <span>1 AU 대비 복사량</span><strong>{state.solarFluxRatio.toFixed(4)} ×</strong>
          <span>자전 위상 / 쌍극 투영</span><strong className="text-purple-200">{(config.rotationPhaseDeg ?? 0).toFixed(1)}° / {coupling.projectedDipoleAngleDeg.toFixed(1)}°</strong>
          <span>태양풍 방향 / 동압</span><strong className="text-amber-200">{coupling.solarWindFlowAngleDeg.toFixed(1)}° / {coupling.solarWindPressureRatio.toFixed(4)}×</strong>
        </div>
        <p className="mt-2 text-amber-200">2D/3D는 태양 방향·쌍극축 투영·정상상태 동압 r⁻²를 공유합니다. 순간 태양풍/IMF는 별도 입력입니다.</p>
      </div>
      <button type="button" onClick={() => setIsPlaying(value => !value)} className="absolute right-3 top-3 flex items-center gap-1.5 rounded border border-cyan-700 bg-slate-950/90 px-3 py-2 text-xs text-cyan-200">
        {isPlaying ? <Pause className="h-4 w-4"/> : <Play className="h-4 w-4"/>}{isPlaying ? '전체 시간 정지' : '전체 시간 재생'}
      </button>
      {!config.enabled && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-amber-200"><Sun className="mr-2 h-5 w-5"/>태양 공전 조건이 꺼져 있습니다.</div>}
    </div>
  );
}
