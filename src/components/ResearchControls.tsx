import React, { useEffect, useRef, useState } from 'react';
import { EarthDipoleConfig, ExternalMagneticSource } from '../types';
import { ResearchConfig, parseFieldNt, distanceLabel } from '../physics/fieldModel';

export function ScientificFieldInput({ value, onApply, label }: { value: string; onApply: (value: string) => void; label: string }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(value); setError(''); }, [value]);
  const apply = () => {
    const result = parseFieldNt(draft);
    if (result.error) { setError(result.error); return; }
    setError(''); onApply(draft.trim());
  };
  return <div className="space-y-1"><label className="block text-slate-300">{label}
    <input aria-invalid={!!error} type="text" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') apply(); }}
      className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2 font-mono" /></label>
    <button type="button" onClick={apply} className="rounded bg-cyan-950 border border-cyan-700 px-3 py-1">nT 적용</button>
    {error && <p role="alert" className="text-red-300">{error}</p>}</div>;
}

export function NumericInput({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState(false);
  const editing=useRef(false), dirty=useRef(false);
  // A live rotating/orbiting source must not overwrite a number mid-edit.
  useEffect(() => { if(!editing.current) setDraft(String(value)); }, [value]);
  const apply = () => {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number) || (min !== undefined && number < min) || (max !== undefined && number > max)) { setError(true); return; }
    setError(false); onChange(number);
  };
  return <label className="block">{label}<input type="number" step="any" min={min} max={max} aria-invalid={error} value={draft}
    onFocus={()=>{editing.current=true;dirty.current=false;}}
    onChange={e => {dirty.current=true;setDraft(e.target.value);}}
    onBlur={()=>{editing.current=false;if(dirty.current)apply();else setDraft(String(value));dirty.current=false;}}
    onKeyDown={e => { if (e.key === 'Enter') apply(); }}
    className="w-full my-1 rounded bg-slate-950 border border-slate-700 p-1.5" />
    {error && <span role="alert" className="text-red-300">유한한 값과 허용 범위를 확인하세요. 기존 값은 유지됩니다. {min!==undefined?`최소 ${min}`:''} {max!==undefined?`최대 ${max}`:''}</span>}</label>;
}

export function ResearchControls({ config, setConfig }: { config: ResearchConfig; setConfig: React.Dispatch<React.SetStateAction<ResearchConfig>> }) {
  const update = (patch: Partial<ResearchConfig>) => setConfig(prev => ({ ...prev, ...patch }));
  return <section className="space-y-3 rounded border border-cyan-900 p-3">
    <h3 className="font-semibold text-cyan-200">공유 2D·3D 거리 / 경계 / 외핵</h3>
    {([['distances','중심 거리 눈금 (R_E / km)'], ['weakBoundary','지구 성분 약자기장 등치선'], ['magnetopause','태양풍 자기권계면 (Shue)'], ['coreVisible','외핵 유동 설명도']] as const).map(([key,label]) =>
      <label key={key} className="flex gap-2"><input type="checkbox" checked={config[key]} onChange={e => update({ [key]: e.target.checked })} />{label}</label>)}
    <NumericInput label="약자기장 표시 기준 (nT, 0 초과)" value={config.weakThresholdNt} min={0.000001} onChange={weakThresholdNt => update({ weakThresholdNt })} />
    <p className="text-slate-400">등치선은 자기장이 0인 경계가 아닙니다. Shue 선은 태양풍 기준 추정이며 임의의 외부 자기원을 포함한 MHD 해가 아닙니다.</p>
    <NumericInput label="외핵 기준 유속 (km/년, 대표 규모 10–20)" value={config.coreSpeedKmYear} min={0} onChange={coreSpeedKmYear => update({ coreSpeedKmYear })} />
    <label className="flex gap-2 text-amber-300"><input type="checkbox" checked={config.coreHypothesis} onChange={e => update({ coreHypothesis: e.target.checked })} />반드시 가설: 외부장–외핵 결합 실험</label>
    {config.coreHypothesis && <div className="space-y-2 border-l-2 border-amber-600 pl-3">
      <p>정상상태 민감도 Δu = κ T² P_ext τ / (ρ L). 관측으로 확인된 임계값이 아닙니다. 기준 유속·지구 자기 모멘트에 자동 피드백하지 않습니다.</p>
      <NumericInput label="가정: 내부 전달률 T (0–1)" value={config.coreTransmission} min={0} max={1} onChange={coreTransmission => update({ coreTransmission })} />
      <NumericInput label="가정: 부호 있는 결합 κ (음수=감속)" value={config.coreCoupling} onChange={coreCoupling => update({ coreCoupling })} />
      <NumericInput label="가정: 응답 시간 τ (년)" value={config.coreResponseYears} min={0} onChange={coreResponseYears => update({ coreResponseYears })} />
    </div>}
  </section>;
}

export function ExternalSourcesControl({ sources, setSources, earth }: { sources: ExternalMagneticSource[]; setSources: React.Dispatch<React.SetStateAction<ExternalMagneticSource[]>>; earth: EarthDipoleConfig }) {
  const [type, setType] = useState<ExternalMagneticSource['type']>('dipole');
  const [fieldNt, setFieldNt] = useState('100');
  const [monopoles, setMonopoles] = useState(false);
  const update = (id: string, patch: Partial<ExternalMagneticSource>) => setSources(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  const names = { dipole: '외부 쌍극자', uniform: '균일 외부 자기장', monopole_n: '반드시 가설: N 단극자', monopole_s: '반드시 가설: S 단극자', comet: '반드시 가설: 혜성 플라스마 프록시' };
  return <div className="space-y-3">
    <p className="text-slate-300">독립된 N/S 자기 단극자는 발견이 확립되지 않았습니다. 쌍극자·균일장이 기본이며 단극자와 혜성 프록시는 가설 실험입니다.</p>
    <label className="flex gap-2 text-amber-300"><input type="checkbox" checked={monopoles} onChange={e => { setMonopoles(e.target.checked); if (!e.target.checked && type.startsWith('monopole')) setType('dipole'); }} />가설 단극자 추가 목록 열기</label>
    <label className="block">외부 자기원 종류<select aria-label="외부 자기원 종류" value={type} onChange={e => setType(e.target.value as typeof type)} className="w-full rounded bg-slate-950 p-2 mt-1">
      <option value="dipole">쌍극자 (N/S 한 쌍)</option><option value="uniform">균일장 (먼 자기원의 국소 근사)</option><option value="comet">반드시 가설: 혜성 프록시</option>
      {monopoles && <><option value="monopole_n">반드시 가설: N 단극자</option><option value="monopole_s">반드시 가설: S 단극자</option></>}
    </select></label>
    <ScientificFieldInput value={fieldNt} onApply={setFieldNt} label="추가할 자기장 기준 세기 (nT)" />
    <p className="text-slate-400">적용값: {fieldNt} nT. 쌍극자는 자기원에서 1 R_E 떨어진 적도 세기, 단극자는 1 R_E 방사 세기, 균일장은 모든 지점 세기입니다. 혜성에는 별도 무차원 활동도를 사용합니다.</p>
    <p className="text-slate-400">좌표·회전·혜성 프록시의 수치 보호 범위는 nT 입력 상한과 별개입니다.</p><p className="text-amber-200">임의의 nT 상한 없음: 1e1000 등 과학적 표기 지원. ∞는 외부장 지배 방향의 극한일 뿐 무한 에너지의 실제 예측이 아닙니다. 영향에는 보편적 nT 문턱이 없습니다.</p>
    <button id="btn-add-source" onClick={() => setSources(prev => [...prev, { id: crypto.randomUUID(), name: names[type], type, x: earth.x+4, y: earth.y, z: 0, strength: 1, fieldNt, angle: 0, active: true, orbiting: false, orbitRadius: 4, orbitSpeed: 0.3, cometGasActivity: 1, cometTailLength: 3 }])}
      className="rounded bg-cyan-800 px-3 py-2">자기원 추가</button>
    {sources.map(source => <details key={source.id} open className="rounded border border-slate-700 p-2 space-y-2">
      <summary className="font-semibold">{names[source.type]} · {source.name}</summary>
      <p>중심 거리: {distanceLabel({ x: source.x, y: source.y, z: source.z ?? 0 }, earth)}</p>
      {source.type !== 'comet' && <ScientificFieldInput label={`${source.name} 기준 자기장 (nT)`} value={source.fieldNt ?? String(Math.abs(source.strength)*31200)} onApply={fieldNt => update(source.id,{ fieldNt })} />}
      {source.type === 'comet' && <><NumericInput label="가설 혜성 활동도 (무차원)" value={source.cometGasActivity ?? source.strength} min={0} max={1e50} onChange={cometGasActivity => update(source.id,{ cometGasActivity })} /><NumericInput label="가설 꼬리 길이 (R_E)" value={source.cometTailLength ?? 3} min={0.1} max={1e6} onChange={cometTailLength => update(source.id,{ cometTailLength })} /></>}
      <div className="grid grid-cols-2 gap-2"><NumericInput label="X (R_E)" value={source.x} min={-1e6} max={1e6} onChange={x => update(source.id,{ x })} /><NumericInput label="Y (R_E)" value={source.y} min={-1e6} max={1e6} onChange={y => update(source.id,{ y })} /></div>
      <NumericInput label="축 회전각 (°, +Y 기준)" value={source.angle ?? 0} onChange={angle => update(source.id,{ angle:((angle%360)+360)%360 })} />
      {(source.type==='dipole'||source.type==='uniform') && <div className="space-y-2 border border-purple-900 rounded p-2">
        <label className="flex gap-2"><input type="checkbox" checked={!!source.rotating} onChange={e=>update(source.id,{rotating:e.target.checked})} />자체 회전 (공전과 독립)</label>
        <NumericInput label="자체 회전 속도 (°/화면 초, 음수=반대 방향)" value={source.rotationSpeedDegS??15} min={-3600} max={3600} onChange={rotationSpeedDegS=>update(source.id,{rotationSpeedDegS})} />
      </div>}
      <div className="flex flex-wrap gap-3"><label><input type="checkbox" checked={source.active} onChange={e => update(source.id,{ active:e.target.checked })} /> 활성</label>
        {source.type !== 'uniform' && <label><input type="checkbox" checked={!!source.orbiting} onChange={e => update(source.id,{ orbiting:e.target.checked })} /> 공전 (가상 궤적)</label>}
        <button onClick={() => setSources(prev => prev.filter(s => s.id !== source.id))} className="text-red-300">이 자기원 삭제</button></div>
    </details>)}
  </div>;
}
