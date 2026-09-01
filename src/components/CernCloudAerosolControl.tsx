import React, { useMemo } from 'react';
import { AlertTriangle, Atom, Beaker, ExternalLink, FlaskConical, Link2, Waves } from 'lucide-react';
import { AtmosphericCloudConfig, CernCloudAerosolConfig, CernCloudEnvironment } from '../types';
import { CERN_CLOUD_PRESETS, computeCernCloudAerosol } from '../physics/cernCloudAerosolEngine';

interface Props {
  cloudConfig: AtmosphericCloudConfig;
  setCloudConfig: React.Dispatch<React.SetStateAction<AtmosphericCloudConfig>>;
}

const environmentLabels: Record<CernCloudEnvironment, string> = {
  boundary_layer: '경계층 SA–NH₃/DMA',
  marine_polar: '저온 해양·극지 HIOx/MSA',
  upper_troposphere: '상부대류권 IP‑OOM',
};

const channelLabels: Record<string, string> = {
  SA_NH3: '황산–암모니아',
  SA_DMA: '황산–디메틸아민',
  HIOX: '아이오딘 옥소산 상승작용',
  IP_OOM: '상부대류권 IP‑OOM',
  MSA: '저온 MSA–황산–암모니아',
  inactive: '비활성',
};

const scientific = (value: number) => value === 0 ? '0' : value.toExponential(2);

export function CernCloudAerosolControl({ cloudConfig, setCloudConfig }: Props) {
  const config = cloudConfig.aerosolExperiment ?? CERN_CLOUD_PRESETS.boundary_layer;
  const result = useMemo(() => computeCernCloudAerosol(config), [config]);

  const update = <K extends keyof CernCloudAerosolConfig>(key: K, value: CernCloudAerosolConfig[K]) => {
    setCloudConfig((previous) => ({
      ...previous,
      aerosolExperiment: { ...(previous.aerosolExperiment ?? CERN_CLOUD_PRESETS.boundary_layer), [key]: value },
    }));
  };

  const applyPreset = (environment: CernCloudEnvironment) => {
    setCloudConfig((previous) => ({
      ...previous,
      aerosolExperiment: {
        ...CERN_CLOUD_PRESETS[environment],
        coupleToCloudBaseline: previous.aerosolExperiment?.coupleToCloudBaseline ?? false,
      },
    }));
  };

  const concentrationSlider = (
    id: string,
    label: string,
    key: 'sulfuricAcidCm3' | 'iodineOxoacidCm3' | 'ipOomCm3' | 'msaCm3',
    minPower: number,
    maxPower: number
  ) => (
    <label htmlFor={id} className="block space-y-1.5 rounded-md border border-[#252532] bg-[#101017] p-2.5">
      <span className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
        <span>{label}</span><strong className="font-mono text-cyan-300">{scientific(config[key])} cm⁻³</strong>
      </span>
      <input id={id} type="range" min={minPower} max={maxPower} step="0.1" value={Math.log10(Math.max(1, config[key]))}
        onChange={(event) => update(key, Math.pow(10, Number(event.target.value)))} className="w-full accent-cyan-400" />
    </label>
  );

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-950/35 to-[#111118] p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-violet-200"><FlaskConical className="h-4 w-4" />CERN CLOUD 에어로졸 기준선 실험</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">핵생성 → 성장 → κ–Köhler CCN 가능성을 순서대로 계산합니다. 이 모드는 자기장·지진·지진운 인과를 검증하지 않습니다.</p>
          </div>
          <button type="button" aria-pressed={config.enabled} onClick={() => update('enabled', !config.enabled)}
            className={`shrink-0 rounded border px-2.5 py-1 text-[10px] font-mono ${config.enabled ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-300' : 'border-slate-600 bg-slate-900 text-slate-400'}`}>
            {config.enabled ? '실험 ON' : '실험 OFF'}
          </button>
        </div>
        <div className="rounded border border-amber-500/25 bg-amber-950/20 p-2 text-[10px] leading-relaxed text-amber-100/80">
          논문에 공개된 전체 다차원 적합식의 대체물이 아닌 범위 제한 스크리닝 모델입니다. 출력 숫자는 CLOUD 측정값이나 실제 CCN 농도가 아닙니다.
        </div>
      </section>

      <section aria-label="CERN CLOUD 환경 프리셋" className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
        {(Object.keys(environmentLabels) as CernCloudEnvironment[]).map((environment) => (
          <button key={environment} type="button" aria-pressed={config.environment === environment} onClick={() => applyPreset(environment)}
            className={`rounded-md border p-2 text-left text-[10px] transition-colors ${config.environment === environment ? 'border-violet-400/60 bg-violet-950/45 text-violet-200' : 'border-[#252532] bg-[#121219] text-slate-400 hover:text-slate-200'}`}>
            {environmentLabels[environment]}
          </button>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-2">
        <label htmlFor="cern-temperature" className="space-y-1 rounded-md border border-[#252532] bg-[#101017] p-2.5 text-[11px] text-slate-300">
          <span className="flex justify-between"><span>온도</span><strong className="font-mono text-violet-300">{config.temperatureK.toFixed(0)} K</strong></span>
          <input id="cern-temperature" type="range" min="208" max="303" step="1" value={config.temperatureK} onChange={(e) => update('temperatureK', Number(e.target.value))} className="w-full accent-violet-400" />
        </label>
        <label htmlFor="cern-pressure" className="space-y-1 rounded-md border border-[#252532] bg-[#101017] p-2.5 text-[11px] text-slate-300">
          <span className="flex justify-between"><span>압력</span><strong className="font-mono text-violet-300">{config.pressureHpa.toFixed(0)} hPa</strong></span>
          <input id="cern-pressure" type="range" min="200" max="1050" step="5" value={config.pressureHpa} onChange={(e) => update('pressureHpa', Number(e.target.value))} className="w-full accent-violet-400" />
        </label>
        <label htmlFor="cern-rh" className="space-y-1 rounded-md border border-[#252532] bg-[#101017] p-2.5 text-[11px] text-slate-300">
          <span className="flex justify-between"><span>상대습도</span><strong className="font-mono text-sky-300">{config.relativeHumidityPercent.toFixed(0)}%</strong></span>
          <input id="cern-rh" type="range" min="0" max="100" step="1" value={config.relativeHumidityPercent} onChange={(e) => update('relativeHumidityPercent', Number(e.target.value))} className="w-full accent-sky-400" />
        </label>
        <label htmlFor="cern-ion-rate" className="space-y-1 rounded-md border border-[#252532] bg-[#101017] p-2.5 text-[11px] text-slate-300">
          <span className="flex justify-between"><span>이온쌍 생성률 q</span><strong className="font-mono text-amber-300">{config.ionPairProductionCm3S.toFixed(1)}</strong></span>
          <input id="cern-ion-rate" type="range" min="0" max="75" step="0.5" value={config.ionPairProductionCm3S} onChange={(e) => update('ionPairProductionCm3S', Number(e.target.value))} className="w-full accent-amber-400" />
          <span className="block text-[9px] text-slate-500">cm⁻³ s⁻¹ · GCR 챔버 기준 약 2</span>
        </label>
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-200"><Beaker className="h-3.5 w-3.5" />응축성 증기와 안정화 물질</h3>
        {concentrationSlider('cern-sa', '황산 H₂SO₄', 'sulfuricAcidCm3', 4, 9)}
        {concentrationSlider('cern-hiox', '아이오딘 옥소산 HIOx', 'iodineOxoacidCm3', 3, 8)}
        {concentrationSlider('cern-ipoom', '이소프렌 산화물 IP‑OOM', 'ipOomCm3', 3, 9)}
        {concentrationSlider('cern-msa', '메탄설폰산 MSA', 'msaCm3', 3, 8)}
        <div className="grid grid-cols-2 gap-2">
          <label htmlFor="cern-nh3" className="space-y-1 rounded-md border border-[#252532] bg-[#101017] p-2.5 text-[11px] text-slate-300">
            <span className="flex justify-between"><span>NH₃</span><strong className="font-mono">{config.ammoniaPptv.toFixed(1)} pptv</strong></span>
            <input id="cern-nh3" type="range" min="0" max="50" step="0.5" value={config.ammoniaPptv} onChange={(e) => update('ammoniaPptv', Number(e.target.value))} className="w-full accent-cyan-400" />
          </label>
          <label htmlFor="cern-dma" className="space-y-1 rounded-md border border-[#252532] bg-[#101017] p-2.5 text-[11px] text-slate-300">
            <span className="flex justify-between"><span>DMA</span><strong className="font-mono">{config.dimethylaminePptv.toFixed(1)} pptv</strong></span>
            <input id="cern-dma" type="range" min="0" max="10" step="0.1" value={config.dimethylaminePptv} onChange={(e) => update('dimethylaminePptv', Number(e.target.value))} className="w-full accent-cyan-400" />
          </label>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <label htmlFor="cern-sink" className="space-y-1 rounded-md border border-[#252532] bg-[#101017] p-2.5 text-[11px] text-slate-300">
          <span className="flex justify-between"><span>응축손실 CS</span><strong className="font-mono">{scientific(config.condensationSinkS)} s⁻¹</strong></span>
          <input id="cern-sink" type="range" min="-5" max="-1" step="0.1" value={Math.log10(Math.max(1e-5, config.condensationSinkS))} onChange={(e) => update('condensationSinkS', Math.pow(10, Number(e.target.value)))} className="w-full accent-slate-400" />
        </label>
        <label htmlFor="cern-exposure" className="space-y-1 rounded-md border border-[#252532] bg-[#101017] p-2.5 text-[11px] text-slate-300">
          <span className="flex justify-between"><span>증기 노출시간</span><strong className="font-mono">{config.vaporExposureSeconds.toFixed(0)} s</strong></span>
          <input id="cern-exposure" type="range" min="0" max="1800" step="30" value={config.vaporExposureSeconds} onChange={(e) => update('vaporExposureSeconds', Number(e.target.value))} className="w-full accent-slate-400" />
        </label>
        <label htmlFor="cern-growth-hours" className="space-y-1 rounded-md border border-[#252532] bg-[#101017] p-2.5 text-[11px] text-slate-300">
          <span className="flex justify-between"><span>성장 시간</span><strong className="font-mono">{config.growthHours.toFixed(0)} h</strong></span>
          <input id="cern-growth-hours" type="range" min="0" max="72" step="1" value={config.growthHours} onChange={(e) => update('growthHours', Number(e.target.value))} className="w-full accent-emerald-400" />
        </label>
        <label htmlFor="cern-kappa" className="space-y-1 rounded-md border border-[#252532] bg-[#101017] p-2.5 text-[11px] text-slate-300">
          <span className="flex justify-between"><span>흡습성 κ</span><strong className="font-mono">{config.hygroscopicityKappa.toFixed(2)}</strong></span>
          <input id="cern-kappa" type="range" min="0.05" max="1" step="0.01" value={config.hygroscopicityKappa} onChange={(e) => update('hygroscopicityKappa', Number(e.target.value))} className="w-full accent-emerald-400" />
        </label>
        <label htmlFor="cern-ss" className="col-span-2 space-y-1 rounded-md border border-[#252532] bg-[#101017] p-2.5 text-[11px] text-slate-300">
          <span className="flex justify-between"><span>구름 과포화도</span><strong className="font-mono">{config.ccnSupersaturationPercent.toFixed(2)}%</strong></span>
          <input id="cern-ss" type="range" min="0.05" max="1" step="0.05" value={config.ccnSupersaturationPercent} onChange={(e) => update('ccnSupersaturationPercent', Number(e.target.value))} className="w-full accent-emerald-400" />
        </label>
      </section>

      <section aria-live="polite" className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-3 space-y-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-200"><Atom className="h-3.5 w-3.5" />단계별 스크리닝 결과</h3>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded bg-black/25 p-2"><span className="text-slate-500">총 핵생성률 J*</span><strong className="block font-mono text-cyan-300">{scientific(result.totalNucleationRateCm3S)} cm⁻³s⁻¹</strong></div>
          <div className="rounded bg-black/25 p-2"><span className="text-slate-500">이온 유도분</span><strong className="block font-mono text-amber-300">{scientific(result.ionInducedRateCm3S)} cm⁻³s⁻¹</strong></div>
          <div className="rounded bg-black/25 p-2"><span className="text-slate-500">성장률 GR*</span><strong className="block font-mono text-emerald-300">{result.growthRateNmH.toFixed(2)} nm h⁻¹</strong></div>
          <div className="rounded bg-black/25 p-2"><span className="text-slate-500">최종/임계 건조직경</span><strong className="block font-mono text-emerald-300">{result.finalDryDiameterNm.toFixed(1)} / {result.ccnCriticalDryDiameterNm.toFixed(1)} nm</strong></div>
          <div className="rounded bg-black/25 p-2"><span className="text-slate-500">우세 채널</span><strong className="block text-violet-300">{channelLabels[result.dominantChannel]}</strong></div>
          <div className="rounded bg-black/25 p-2"><span className="text-slate-500">CCN 활성 가능성*</span><strong className="block font-mono text-sky-300">{(result.ccnActivationPotential * 100).toFixed(1)}%</strong></div>
        </div>
        <p className="text-[9px] leading-relaxed text-slate-500">* 비교용 스크리닝 출력입니다. 실제 J, 성장률, CCN 농도에는 상세 화학·크기분포·응집손실과 관측 보정이 필요합니다.</p>
      </section>

      {result.applicabilityWarnings.length > 0 && <section role="alert" className="rounded-md border border-amber-500/30 bg-amber-950/20 p-2.5 text-[10px] text-amber-200">
        <div className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle className="h-3.5 w-3.5" />적용 범위 경고</div>
        <ul className="list-disc space-y-0.5 pl-4">{result.applicabilityWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </section>}

      <section className="rounded-lg border border-sky-500/25 bg-sky-950/15 p-3 space-y-2">
        <button type="button" aria-pressed={config.coupleToCloudBaseline} onClick={() => update('coupleToCloudBaseline', !config.coupleToCloudBaseline)}
          className={`flex w-full items-center justify-between rounded-md border p-2 text-[10px] ${config.coupleToCloudBaseline ? 'border-sky-400/50 bg-sky-950/50 text-sky-200' : 'border-[#30303d] bg-[#121219] text-slate-400'}`}>
          <span className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" />기상 구름 기준선에 CCN 민감도 연결</span><strong>{config.coupleToCloudBaseline ? '연결됨' : '독립 실행'}</strong>
        </button>
        <p className="text-[9px] leading-relaxed text-slate-500">연결해도 자기장 가설항 A_h와는 독립입니다. CCN 가능성이 자연 구름 프록시의 70–100% 범위만 조정합니다.</p>
      </section>

      <section className="rounded-md border border-[#252532] bg-[#101017] p-3 text-[10px] leading-relaxed text-slate-400 space-y-1.5">
        <h3 className="flex items-center gap-1.5 font-semibold text-slate-200"><Waves className="h-3.5 w-3.5" />근거 링크</h3>
        <a className="flex items-center gap-1 text-cyan-300 hover:underline" href="https://home.cern/science/experiments/CLOUD/" target="_blank" rel="noreferrer">CERN CLOUD 공식 소개 <ExternalLink className="h-3 w-3" /></a>
        <a className="flex items-center gap-1 text-cyan-300 hover:underline" href="https://doi.org/10.1126/science.aaf2649" target="_blank" rel="noreferrer">Dunne et al. 2016 전지구 핵생성 <ExternalLink className="h-3 w-3" /></a>
        <a className="flex items-center gap-1 text-cyan-300 hover:underline" href="https://doi.org/10.1126/science.adh2526" target="_blank" rel="noreferrer">He et al. 2023 HIOx–황산 <ExternalLink className="h-3 w-3" /></a>
        <a className="flex items-center gap-1 text-cyan-300 hover:underline" href="https://doi.org/10.1038/s41586-024-08196-0" target="_blank" rel="noreferrer">Shen et al. 2024 IP‑OOM <ExternalLink className="h-3 w-3" /></a>
        <a className="flex items-center gap-1 text-cyan-300 hover:underline" href="https://doi.org/10.1038/s41586-026-10810-2" target="_blank" rel="noreferrer">CLOUD 2026 MSA–황산–암모니아 <ExternalLink className="h-3 w-3" /></a>
      </section>
    </div>
  );
}
