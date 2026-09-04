import React from 'react';
import { FieldContext, ResearchConfig, coreResponse, externalField, formatLogNt, needsLogOnly } from '../physics/fieldModel';

export function FieldReadout({ context, research, error, calculationMs }: { context: FieldContext; research: ResearchConfig; error?: string | null; calculationMs?: number }) {
  const external = externalField({ x: context.earth.x, y: context.earth.y, z: 0 }, context);
  const core = coreResponse(context, research);
  const extreme = needsLogOnly(context);
  return <div className="absolute left-2 bottom-28 z-20 max-w-[90%] rounded border border-cyan-950 bg-slate-950/90 px-2 py-1.5 text-[10px] text-slate-300 space-y-1" data-testid="field-readout">
    <details className="max-h-[40vh] overflow-y-auto"><summary className="cursor-pointer">자기장 수치·범례·모델 한계 · 펼치기</summary>
    <p>외부장 (지구 중심 위치): <span className="text-cyan-200">{formatLogNt(external.logNt)} nT</span> · 영향 문턱 없음</p>
    <p>자기력선 색: |B_total| 로그 눈금 · 0.01 → 1 → 100 → 31,200 nT</p>
    <div className="h-1 w-40 bg-gradient-to-r from-transparent to-cyan-300" />
    <p>1 R_E = 6,371 km · 점선: |B_E|={research.weakThresholdNt} nT · 0 경계 아님</p>
    <p>RK4 정자기 중첩 근사 · 입자/펄스는 에너지 전달 해가 아님</p>
    {context.moon?.enabled && <p>달 {context.moon.phaseAngleDeg.toFixed(1)}° · {(context.moon.physicalDistanceEarthRadii ?? 60.3).toFixed(1)} R_E · 1초={(context.moon.daysPerSecond ?? 0.5)}일 (공전·동주기 자전)</p>}
    {context.sources.some(s => s.active && (s.type.startsWith('monopole') || s.type === 'comet')) && <p className="text-amber-300">반드시 가설: 단극자 / 혜성 프록시 포함</p>}
    {context.moon?.hypothesisDipoleEnabled && <p className="text-amber-300">반드시 가설: 달 전역 쌍극자 활성</p>}
    {context.solar.enabled && <p className="text-amber-200">주황 선: Shue 태양풍 전용 경계 (외부 자기원/MHD 응답 제외)</p>}
    {context.solar.enabled && (Math.abs(context.solar.imfBz)>50 || context.solar.pressure>100 || context.solar.pressure<0.05) && <p role="status" className="text-amber-300">Shue 적용 보호 범위 밖: 경계 추정 중단, 입력 유지</p>}
    {extreme && <p role="status" className="text-amber-300">극한/초대형 입력: 방향·로그 세기만 계산. 구름·파열 정량 계산 중단.</p>}
    {external.indeterminate && <p role="alert" className="text-red-300">복수 무한장의 상대 증가율이 없어 극한 경로가 미정입니다.</p>}
    {research.coreVisible && <div className="border-t border-slate-700 pt-1">
      <p>외핵 기준 {core.base.toFixed(2)} km/년 = {(core.base*1e6/(365.25*86400)).toFixed(3)} mm/s</p>
      <p className="text-amber-200">{research.coreHypothesis ? `반드시 가설: Δu=${core.delta < 0 ? '−' : '+'}${formatLogNt(core.deltaLogKmYear)} km/년` : '외핵 결합 OFF: Δu = 0 (대조군)'}</p>
      <p>유동 설명도 · ρ=11,000 kg/m³, L=2,260 km 가정 · 지구 자기장 자동 피드백 없음</p>
    </div>}
    {calculationMs !== undefined && <p className="text-slate-500">계산 작업자 {calculationMs.toFixed(0)} ms · 최신값 대기열 1개 · 최대 4 Hz 갱신</p>}
    </details>
    {extreme && <p role="status" className="text-amber-300">극한/초대형 모드: 구름·파열 정량 계산 중단</p>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </div>;
}

/** The same labelled cross-section in both views; no claim of a solved 3D geodynamo. */
export function CoreFlowInset({ context, research, playing }: { context: FieldContext; research: ResearchConfig; playing: boolean }) {
  if (!research.coreVisible) return null;
  const core = coreResponse(context, research);
  // Fixed pedagogic loop: changing assumed speed alters animation only within a labelled display range.
  const finiteSpeed = Number.isNaN(core.speed) ? 0 : Number.isFinite(core.speed) ? core.speed : Math.sign(core.delta)*1e6;
  const duration = Math.max(0.6, Math.min(120, 30/Math.max(0.01, Math.abs(finiteSpeed))));
  return <div className="absolute bottom-14 right-2 z-10 rounded bg-slate-950/90 p-2 text-[10px] pointer-events-none">
    <svg width="124" height="124" viewBox="-62 -62 124 124" aria-label="외핵 유동 설명도">
      <circle r="55" fill="#172554" stroke="#38bdf8" /><circle r="30" fill="#9a3412" /><circle r="11" fill="#fed7aa" />
      <g style={{ transformOrigin:'0 0', animation: `core-circulation ${duration}s linear infinite`, animationPlayState: playing && finiteSpeed !== 0 ? 'running' : 'paused', animationDirection: finiteSpeed < 0 ? 'reverse' : 'normal' }}>
        {[0,90,180,270].map(a => <path key={a} transform={`rotate(${a})`} d="M 0 -23 Q 18 -24 23 -8 M 23 -8 L 15 -12 M 23 -8 L 25 -17" fill="none" stroke="#fbbf24" strokeWidth="2" />)}
      </g>
    </svg><p>외핵 단면 개념도 · 속도 시각적 재척도</p><p>{research.coreHypothesis ? '반드시 가설: 외부장 응답' : '문헌 기반 유속 규모'}</p>
  </div>;
}
