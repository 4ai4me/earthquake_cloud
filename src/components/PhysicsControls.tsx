import React, { useState } from 'react';
import {
  AtmosphericCloudConfig,
  EarthDipoleConfig,
  EarthquakeEvent,
  ExternalMagneticSource,
  PoleType,
  SolarWindConfig,
} from '../types';
import { CrustalStressManager } from '../physics/crustalStressEngine';
import {
  Activity,
  AlertTriangle,
  CloudSun,
  Compass,
  Globe,
  Plus,
  Radio,
  RefreshCw,
  Sliders,
  Sun,
  Trash2,
  Zap,
  Flame,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface PhysicsControlsProps {
  earthConfig: EarthDipoleConfig;
  setEarthConfig: React.Dispatch<React.SetStateAction<EarthDipoleConfig>>;
  sources: ExternalMagneticSource[];
  setSources: React.Dispatch<React.SetStateAction<ExternalMagneticSource[]>>;
  solarWind: SolarWindConfig;
  setSolarWind: React.Dispatch<React.SetStateAction<SolarWindConfig>>;
  cloudConfig: AtmosphericCloudConfig;
  setCloudConfig: React.Dispatch<React.SetStateAction<AtmosphericCloudConfig>>;
  stressManager: CrustalStressManager;
  onEarthquakeTriggered?: (event: EarthquakeEvent) => void;
  onApplyPreset: (presetKey: string) => void;
  activeTab: 'earth' | 'sources' | 'solar' | 'cloud' | 'stress' | 'presets';
  setActiveTab: (tab: 'earth' | 'sources' | 'solar' | 'cloud' | 'stress' | 'presets') => void;
}

export const PhysicsControls: React.FC<PhysicsControlsProps> = ({
  earthConfig,
  setEarthConfig,
  sources,
  setSources,
  solarWind,
  setSolarWind,
  cloudConfig,
  setCloudConfig,
  stressManager,
  onEarthquakeTriggered,
  onApplyPreset,
  activeTab,
  setActiveTab,
}) => {
  const [newSourceType, setNewSourceType] = useState<PoleType>('monopole_n');
  const [newSourceStrength, setNewSourceStrength] = useState<number>(2.0);

  const handleAddSource = () => {
    const id = `source-${Date.now()}`;
    const newSource: ExternalMagneticSource = {
      id,
      name: newSourceType === 'monopole_n' ? '외부 N극' : newSourceType === 'monopole_s' ? '외부 S극' : '외부 쌍극자',
      type: newSourceType,
      x: 2.2 + (Math.random() - 0.5) * 1.5,
      y: (Math.random() - 0.5) * 2.0,
      strength: newSourceStrength,
      angle: 0,
      active: true,
      orbiting: false,
      orbitRadius: 2.8,
      orbitSpeed: 0.8,
      orbitPhase: Math.random() * Math.PI * 2,
    };
    setSources((prev) => [...prev, newSource]);
  };

  const handleRemoveSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleTriggerCME = () => {
    // Solar storm CME burst pulse
    setSolarWind((prev) => ({
      ...prev,
      enabled: true,
      pressure: 3.5,
      imfBz: -2.2, // Strong southward reconnection
    }));
    setTimeout(() => {
      setSolarWind((prev) => ({
        ...prev,
        pressure: Math.max(1.0, prev.pressure * 0.7),
      }));
    }, 4000);
  };

  return (
    <div className="bg-[#0f0f13] border border-[#1e1e24] rounded-lg shadow-2xl flex flex-col text-slate-200 overflow-hidden">
      {/* Navigation Tabs - High Density */}
      <div className="flex items-center gap-1 p-1 bg-[#09090c] border-b border-[#1e1e24] overflow-x-auto no-scrollbar">
        <button
          id="tab-presets"
          onClick={() => setActiveTab('presets')}
          className={`px-2.5 py-1.5 text-xs font-mono rounded transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'presets'
              ? 'bg-[#181824] text-cyan-300 border border-[#2c2c3e] shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          시나리오 프리셋
        </button>
        <button
          id="tab-earth"
          onClick={() => setActiveTab('earth')}
          className={`px-2.5 py-1.5 text-xs font-mono rounded transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'earth'
              ? 'bg-[#181824] text-cyan-300 border border-[#2c2c3e] shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          지구 쌍극자
        </button>
        <button
          id="tab-sources"
          onClick={() => setActiveTab('sources')}
          className={`px-2.5 py-1.5 text-xs font-mono rounded transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'sources'
              ? 'bg-[#181824] text-cyan-300 border border-[#2c2c3e] shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-purple-400" />
          외부 자극원 ({sources.filter((s) => s.active).length})
        </button>
        <button
          id="tab-solar"
          onClick={() => setActiveTab('solar')}
          className={`px-2.5 py-1.5 text-xs font-mono rounded transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'solar'
              ? 'bg-[#181824] text-amber-300 border border-[#2c2c3e] shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
          }`}
        >
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          태양풍 & IMF
        </button>
        <button
          id="tab-cloud"
          onClick={() => setActiveTab('cloud')}
          className={`px-2.5 py-1.5 text-xs font-mono rounded transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'cloud'
              ? 'bg-[#181824] text-cyan-300 border border-[#2c2c3e] shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
          }`}
        >
          <CloudSun className="w-3.5 h-3.5 text-cyan-400" />
          가상 지진운
        </button>
        <button
          id="tab-stress"
          onClick={() => setActiveTab('stress')}
          className={`px-2.5 py-1.5 text-xs font-mono rounded transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'stress'
              ? 'bg-[#181824] text-red-300 border border-[#2c2c3e] shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-red-400" />
          지각 응력 & 지진
        </button>
      </div>

      {/* Tab Panels Content - High Density */}
      <div className="p-3 space-y-3 text-xs">
        {/* PRESETS TAB */}
        {activeTab === 'presets' && (
          <div className="space-y-2">
            <p className="text-slate-400 text-[11px]">
              다극 자기장 상호작용 및 가상 물리 가설을 검증할 수 있는 사전 정의 시나리오입니다.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                id="preset-quiet"
                onClick={() => onApplyPreset('quiet')}
                className="p-2.5 bg-[#14141b] hover:bg-[#191924] border border-[#1e1e24] hover:border-cyan-500/40 rounded-md text-left transition-all group"
              >
                <div className="font-semibold text-cyan-300 text-xs flex items-center justify-between">
                  <span>1. 표준 고요 쌍극자</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  외부 왜곡이 없는 대칭적인 2D/3D 지구 자기 쌍극자 표준 상태
                </p>
              </button>

              <button
                id="preset-solar-storm"
                onClick={() => onApplyPreset('solar_storm')}
                className="p-2.5 bg-[#14141b] hover:bg-[#191924] border border-[#1e1e24] hover:border-amber-500/40 rounded-md text-left transition-all group"
              >
                <div className="font-semibold text-amber-300 text-xs flex items-center justify-between">
                  <span>2. 태양풍 CME 폭풍 & Reconnection</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  강력한 동압축 및 남향 IMF(Bz &lt; 0) 유입에 따른 전면부 자기권 왜곡
                </p>
              </button>

              <button
                id="preset-third-pole"
                onClick={() => onApplyPreset('third_pole')}
                className="p-2.5 bg-[#14141b] hover:bg-[#191924] border border-[#1e1e24] hover:border-purple-500/40 rounded-md text-left transition-all group"
              >
                <div className="font-semibold text-purple-300 text-xs flex items-center justify-between">
                  <span>3. 제3의 외부 자극원 접근</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  우주 공간에서 접근하는 N/S 극성 자극에 의한 비대칭 자기력선 궤적 왜곡
                </p>
              </button>

              <button
                id="preset-critical-earthquake"
                onClick={() => onApplyPreset('critical_earthquake')}
                className="p-2.5 bg-[#14141b] hover:bg-[#191924] border border-[#1e1e24] hover:border-red-500/40 rounded-md text-left transition-all group"
              >
                <div className="font-semibold text-red-400 text-xs flex items-center justify-between">
                  <span>4. 가상 지진운 & 지각 파열 유발</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400 transition-colors" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  자기 구배 집중 영역의 대기 입자 선형 밴드 형성 및 단층대 임계 지진 파열
                </p>
              </button>

              <button
                id="preset-reversal"
                onClick={() => onApplyPreset('reversal')}
                className="p-2.5 bg-[#14141b] hover:bg-[#191924] border border-[#1e1e24] hover:border-indigo-500/40 rounded-md text-left transition-all group col-span-1 md:col-span-2"
              >
                <div className="font-semibold text-indigo-300 text-xs flex items-center justify-between">
                  <span>5. 지자기 역전 (Geomagnetic Flip Inversion)</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  지구 N극과 S극이 역전되며 다극 성분이 일시적으로 극대화되는 시뮬레이션
                </p>
              </button>
            </div>
          </div>
        )}

        {/* EARTH DIPOLE TAB */}
        {activeTab === 'earth' && (
          <div className="space-y-3">
            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>지구 자기 모멘트 (m)</span>
                <span className="font-mono text-cyan-400 font-bold">{earthConfig.moment.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="6.0"
                step="0.1"
                value={earthConfig.moment}
                onChange={(e) => setEarthConfig((prev) => ({ ...prev, moment: parseFloat(e.target.value) }))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-[#09090c] rounded"
              />
            </div>

            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>자기축 기울기 (Tilt Angle θ)</span>
                <span className="font-mono text-cyan-400 font-bold">{earthConfig.tiltAngle}°</span>
              </div>
              <input
                type="range"
                min="-90"
                max="90"
                step="1"
                value={earthConfig.tiltAngle}
                onChange={(e) => setEarthConfig((prev) => ({ ...prev, tiltAngle: parseInt(e.target.value) }))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-[#09090c] rounded"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div>
                <div className="font-medium text-slate-200 text-xs">지자기 극성 반전 (N ↔ S)</div>
                <div className="text-[10px] text-slate-400">지구 자기 모멘트의 부호를 역전시킵니다.</div>
              </div>
              <button
                id="btn-toggle-earth-polarity"
                onClick={() => setEarthConfig((prev) => ({ ...prev, reversed: !prev.reversed }))}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  earthConfig.reversed
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                    : 'bg-[#1a1a24] text-slate-300 border border-[#2a2a38] hover:bg-[#222230]'
                }`}
              >
                {earthConfig.reversed ? '역전 (Reversed)' : '정상 (Normal)'}
              </button>
            </div>
          </div>
        )}

        {/* EXTERNAL SOURCES TAB */}
        {activeTab === 'sources' && (
          <div className="space-y-3">
            {/* Add New Source Tool */}
            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24] space-y-2">
              <div className="font-medium text-slate-200 text-xs">새로운 외부 자기원 추가</div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setNewSourceType('monopole_n')}
                  className={`py-1 text-xs font-mono rounded border font-medium ${
                    newSourceType === 'monopole_n'
                      ? 'bg-red-950/40 text-red-300 border-red-500/50'
                      : 'bg-[#0f0f15] text-slate-400 border-[#1e1e24]'
                  }`}
                >
                  N극 단극 (+q)
                </button>
                <button
                  onClick={() => setNewSourceType('monopole_s')}
                  className={`py-1 text-xs font-mono rounded border font-medium ${
                    newSourceType === 'monopole_s'
                      ? 'bg-blue-950/40 text-blue-300 border-blue-500/50'
                      : 'bg-[#0f0f15] text-slate-400 border-[#1e1e24]'
                  }`}
                >
                  S극 단극 (-q)
                </button>
                <button
                  onClick={() => setNewSourceType('dipole')}
                  className={`py-1 text-xs font-mono rounded border font-medium ${
                    newSourceType === 'dipole'
                      ? 'bg-purple-950/40 text-purple-300 border-purple-500/50'
                      : 'bg-[#0f0f15] text-slate-400 border-[#1e1e24]'
                  }`}
                >
                  쌍극자 (m_ext)
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-slate-400 text-xs">강도:</span>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.2"
                  value={newSourceStrength}
                  onChange={(e) => setNewSourceStrength(parseFloat(e.target.value))}
                  className="flex-1 accent-cyan-400 h-1.5 bg-[#09090c] rounded"
                />
                <span className="font-mono text-cyan-400 font-bold">{newSourceStrength.toFixed(1)}</span>
                <button
                  id="btn-add-source"
                  onClick={handleAddSource}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded flex items-center gap-1 font-medium transition-colors text-xs shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  추가
                </button>
              </div>
            </div>

            {/* List of Active Sources */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {sources.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2 bg-[#14141b] rounded border border-[#1e1e24] text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        s.type === 'monopole_n' ? 'bg-red-500' : s.type === 'monopole_s' ? 'bg-blue-500' : 'bg-purple-500'
                      }`}
                    />
                    <div>
                      <div className="font-medium text-slate-200 text-xs">{s.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ({s.x.toFixed(1)}, {s.y.toFixed(1)}) · 강도: {s.strength}q
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setSources((prev) =>
                          prev.map((src) => (src.id === s.id ? { ...src, orbiting: !src.orbiting } : src))
                        )
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        s.orbiting
                          ? 'bg-amber-950/40 text-amber-300 border-amber-500/40'
                          : 'bg-[#0f0f15] text-slate-400 border-[#1e1e24]'
                      }`}
                    >
                      {s.orbiting ? '공전 중' : '정적'}
                    </button>
                    <button
                      onClick={() => handleRemoveSource(s.id)}
                      className="p-1 text-slate-400 hover:text-red-400 hover:bg-[#1a1a24] rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SOLAR WIND & IMF TAB */}
        {activeTab === 'solar' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div>
                <div className="font-medium text-slate-200 text-xs">태양풍 및 IMF 중첩 활성화</div>
                <div className="text-[10px] text-slate-400">행성간 자기장(IMF)과 동압축을 시뮬레이션합니다.</div>
              </div>
              <button
                id="btn-toggle-solar-wind"
                onClick={() => setSolarWind((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  solarWind.enabled
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                    : 'bg-[#1a1a24] text-slate-300 border border-[#2a2a38] hover:bg-[#222230]'
                }`}
              >
                {solarWind.enabled ? 'ON (활성화)' : 'OFF (비활성)'}
              </button>
            </div>

            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>태양풍 동압축 (P_dyn)</span>
                <span className="font-mono text-amber-400 font-bold">{solarWind.pressure.toFixed(1)} nPa</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="4.5"
                step="0.1"
                value={solarWind.pressure}
                onChange={(e) => setSolarWind((prev) => ({ ...prev, pressure: parseFloat(e.target.value) }))}
                className="w-full accent-amber-400 h-1.5 bg-[#09090c] rounded"
              />
            </div>

            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>IMF 남북 성분 (Bz) - Reconnection</span>
                <span className={`font-mono font-bold ${solarWind.imfBz < 0 ? 'text-pink-400' : 'text-cyan-400'}`}>
                  {solarWind.imfBz.toFixed(1)} nT {solarWind.imfBz < 0 ? '(남향: Reconnection)' : '(북향)'}
                </span>
              </div>
              <input
                type="range"
                min="-3.0"
                max="3.0"
                step="0.1"
                value={solarWind.imfBz}
                onChange={(e) => setSolarWind((prev) => ({ ...prev, imfBz: parseFloat(e.target.value) }))}
                className="w-full accent-pink-400 h-1.5 bg-[#09090c] rounded"
              />
            </div>

            <button
              id="btn-trigger-cme"
              onClick={handleTriggerCME}
              className="w-full py-2 bg-gradient-to-r from-amber-600/90 to-red-600/90 hover:from-amber-600 hover:to-red-600 text-white font-mono text-xs font-semibold rounded-md shadow-lg shadow-red-950/40 flex items-center justify-center gap-1.5 transition-all"
            >
              <Flame className="w-3.5 h-3.5 text-yellow-200 animate-pulse" />
              태양 플레어 CME 폭풍 펄스 유입 트리거
            </button>
          </div>
        )}

        {/* CLOUD TAB */}
        {activeTab === 'cloud' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div>
                <div className="font-medium text-slate-200 text-xs">가상 지진운(대기 편광 정렬) 모델</div>
                <div className="text-[10px] text-slate-400">자기력선 왜곡에 따른 에어로졸 정렬 밴드 형성</div>
              </div>
              <button
                id="btn-toggle-cloud-model"
                onClick={() => setCloudConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  cloudConfig.enabled
                    ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                    : 'bg-[#1a1a24] text-slate-300 border border-[#2a2a38] hover:bg-[#222230]'
                }`}
              >
                {cloudConfig.enabled ? 'ON (시뮬레이션)' : 'OFF (정지)'}
              </button>
            </div>

            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>대기 수적/에어로졸 입자 수</span>
                <span className="font-mono text-cyan-400 font-bold">{cloudConfig.particleCount}개</span>
              </div>
              <input
                type="range"
                min="150"
                max="1200"
                step="50"
                value={cloudConfig.particleCount}
                onChange={(e) => setCloudConfig((prev) => ({ ...prev, particleCount: parseInt(e.target.value) }))}
                className="w-full accent-cyan-400 h-1.5 bg-[#09090c] rounded"
              />
            </div>

            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>자기장 편광 정렬 감수율 (κ)</span>
                <span className="font-mono text-cyan-400 font-bold">{cloudConfig.polarizationSusceptibility.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.1"
                value={cloudConfig.polarizationSusceptibility}
                onChange={(e) =>
                  setCloudConfig((prev) => ({ ...prev, polarizationSusceptibility: parseFloat(e.target.value) }))
                }
                className="w-full accent-cyan-400 h-1.5 bg-[#09090c] rounded"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                id="btn-toggle-cloud-bands"
                onClick={() => setCloudConfig((prev) => ({ ...prev, showCloudBands: !prev.showCloudBands }))}
                className={`p-2 rounded border text-xs font-mono font-medium ${
                  cloudConfig.showCloudBands
                    ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/40'
                    : 'bg-[#0f0f15] text-slate-400 border-[#1e1e24]'
                }`}
              >
                선형 지진운 밴드 표시
              </button>
              <button
                id="btn-toggle-particles"
                onClick={() => setCloudConfig((prev) => ({ ...prev, showParticles: !prev.showParticles }))}
                className={`p-2 rounded border text-xs font-mono font-medium ${
                  cloudConfig.showParticles
                    ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/40'
                    : 'bg-[#0f0f15] text-slate-400 border-[#1e1e24]'
                }`}
              >
                개별 에어로졸 입자 표시
              </button>
            </div>

            {/* WAVE CLOUD (양떼구름 / 국소 정렬 파동 모델) SECTION */}
            <div className="p-2.5 bg-[#121218] rounded-md border border-cyan-900/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    양떼구름 (국소 정렬 파동) 모델링
                  </div>
                  <div className="text-[10px] text-slate-400">
                    간섭 강도 $I(x,y)$, 시그모이드 마스크 $M(x,y)$, 직교 파동 $C(x,y)$
                  </div>
                </div>
                <button
                  id="btn-toggle-wave-clouds"
                  onClick={() => setCloudConfig((prev) => ({ ...prev, showWaveClouds: !prev.showWaveClouds }))}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                    cloudConfig.showWaveClouds
                      ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                      : 'bg-[#1a1a24] text-slate-300 border border-[#2a2a38] hover:bg-[#222230]'
                  }`}
                >
                  {cloudConfig.showWaveClouds ? 'ON (적용)' : 'OFF (해제)'}
                </button>
              </div>

              {cloudConfig.showWaveClouds && (
                <div className="space-y-2 pt-1 border-t border-[#1e1e24]">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1 text-[11px]">
                      <span>간섭 임계치 (I_th)</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {(cloudConfig.interferenceThreshold ?? 0.85).toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="2.0"
                      step="0.05"
                      value={cloudConfig.interferenceThreshold ?? 0.85}
                      onChange={(e) =>
                        setCloudConfig((prev) => ({ ...prev, interferenceThreshold: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-cyan-400 h-1.5 bg-[#09090c] rounded"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1 text-[11px]">
                      <span>시그모이드 급경사도 (k)</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {(cloudConfig.sigmoidSteepness ?? 6.0).toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="15.0"
                      step="0.5"
                      value={cloudConfig.sigmoidSteepness ?? 6.0}
                      onChange={(e) =>
                        setCloudConfig((prev) => ({ ...prev, sigmoidSteepness: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-cyan-400 h-1.5 bg-[#09090c] rounded"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1 text-[11px]">
                      <span>양떼구름 파장 (λ)</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {(cloudConfig.waveWavelength ?? 0.8).toFixed(2)} R_E
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="2.0"
                      step="0.05"
                      value={cloudConfig.waveWavelength ?? 0.8}
                      onChange={(e) =>
                        setCloudConfig((prev) => ({ ...prev, waveWavelength: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-cyan-400 h-1.5 bg-[#09090c] rounded"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1 text-[11px]">
                      <span>경도 가중치 (α)</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {(cloudConfig.gradientWeight ?? 0.5).toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.5"
                      step="0.05"
                      value={cloudConfig.gradientWeight ?? 0.5}
                      onChange={(e) =>
                        setCloudConfig((prev) => ({ ...prev, gradientWeight: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-cyan-400 h-1.5 bg-[#09090c] rounded"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STRESS & EARTHQUAKES TAB */}
        {activeTab === 'stress' && (
          <div className="space-y-3">
            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24] flex items-center justify-between">
              <div>
                <div className="font-semibold text-amber-400 text-xs font-mono">최대 지각 응력 노드 #{stressManager.maxStressNodeIndex}</div>
                <div className="text-slate-200 font-mono text-xs font-bold mt-0.5">
                  {(stressManager.maxStressValue * 100).toFixed(1)}% / 임계치: {(stressManager.ruptureThreshold * 100).toFixed(0)}%
                </div>
              </div>
              <button
                onClick={() => stressManager.dischargeAllStress()}
                className="px-2 py-1 text-xs font-mono bg-[#1a1a24] hover:bg-[#222230] text-slate-300 rounded border border-[#2a2a38] transition-colors"
              >
                응력 전체 방전
              </button>
            </div>

            <div className="flex gap-2">
              <button
                id="btn-trigger-rupture"
                onClick={() => stressManager.manualTriggerNode(stressManager.maxStressNodeIndex, onEarthquakeTriggered)}
                className="flex-1 py-1.5 bg-red-600/90 hover:bg-red-600 text-white font-mono text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-red-950/50"
              >
                <Zap className="w-3.5 h-3.5 text-yellow-300" />
                최대 응력 단층 강제 지진 파열 (Rupture)
              </button>
            </div>

            {/* Earthquake History Log */}
            <div>
              <div className="font-medium text-slate-300 text-xs mb-1 flex items-center justify-between font-mono">
                <span>가상 지진 발생 카탈로그 이력</span>
                <span className="text-slate-500">{stressManager.earthquakes.length}건</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                {stressManager.earthquakes.length === 0 ? (
                  <div className="text-slate-500 text-center py-2.5 bg-[#14141b] rounded border border-[#1e1e24]">
                    아직 파열된 지진 이벤트가 없습니다.
                  </div>
                ) : (
                  stressManager.earthquakes.map((eq) => (
                    <div
                      key={eq.id}
                      className="p-1.5 bg-[#14141b] rounded border border-red-900/40 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="px-1 py-0.2 rounded bg-red-950/60 border border-red-500/40 text-red-300 font-bold text-[9px]">
                          M_w {eq.magnitude}
                        </span>
                        <span className="text-slate-300">단층 #{eq.nodeIndex}</span>
                      </div>
                      <div className="text-slate-500">
                        {new Date(eq.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
