import React, { useState } from 'react';
import {
  AtmosphericCloudConfig,
  EarthDipoleConfig,
  EarthquakeEvent,
  ExternalMagneticSource,
  GlobalWeatherData,
  MoonConfig,
  PoleType,
  SolarWindConfig,
  DEFAULT_CLOUD_CONFIG,
  DEFAULT_EARTH_DIPOLE,
  DEFAULT_MOON_CONFIG,
  DEFAULT_SOLAR_WIND,
} from '../types';
import { CrustalStressManager } from '../physics/crustalStressEngine';
import { GlobalWeatherControl } from './GlobalWeatherControl';
import {
  Activity,
  AlertTriangle,
  CloudSun,
  Globe,
  Info,
  Moon,
  Orbit,
  Plus,
  Radio,
  RotateCcw,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Zap,
  Flame,
  Layers,
  ChevronRight,
  Eye,
  Columns,
  Waves,
  Wind,
  CheckCircle2,
} from 'lucide-react';

interface PhysicsControlsProps {
  earthConfig: EarthDipoleConfig;
  setEarthConfig: React.Dispatch<React.SetStateAction<EarthDipoleConfig>>;
  sources: ExternalMagneticSource[];
  setSources: React.Dispatch<React.SetStateAction<ExternalMagneticSource[]>>;
  solarWind: SolarWindConfig;
  setSolarWind: React.Dispatch<React.SetStateAction<SolarWindConfig>>;
  moonConfig?: MoonConfig;
  setMoonConfig?: React.Dispatch<React.SetStateAction<MoonConfig>>;
  cloudConfig: AtmosphericCloudConfig;
  setCloudConfig: React.Dispatch<React.SetStateAction<AtmosphericCloudConfig>>;
  stressManager: CrustalStressManager;
  weatherData: GlobalWeatherData;
  setWeatherData: React.Dispatch<React.SetStateAction<GlobalWeatherData>>;
  onEarthquakeTriggered?: (event: EarthquakeEvent) => void;
  onApplyPreset: (presetKey: string) => void;
  onResetSimulation?: () => void;
  activeTab: 'earth' | 'moon' | 'sources' | 'solar' | 'cloud' | 'stress' | 'presets' | 'weather';
  setActiveTab: (tab: 'earth' | 'moon' | 'sources' | 'solar' | 'cloud' | 'stress' | 'presets' | 'weather') => void;
}

export const PhysicsControls: React.FC<PhysicsControlsProps> = ({
  earthConfig,
  setEarthConfig,
  sources,
  setSources,
  solarWind,
  setSolarWind,
  moonConfig = DEFAULT_MOON_CONFIG,
  setMoonConfig,
  cloudConfig,
  setCloudConfig,
  stressManager,
  weatherData,
  setWeatherData,
  onEarthquakeTriggered,
  onApplyPreset,
  onResetSimulation,
  activeTab,
  setActiveTab,
}) => {
  const [newSourceType, setNewSourceType] = useState<PoleType>('monopole_n');
  const [newSourceStrength, setNewSourceStrength] = useState<number>(2.0);
  const [newCometActivity, setNewCometActivity] = useState<number>(2.5);
  const [newCometTailLen, setNewCometTailLen] = useState<number>(3.2);

  const handleAddSource = () => {
    const id = `source-${Date.now()}`;
    let name = '외부 N극';
    if (newSourceType === 'monopole_s') name = '외부 S극';
    else if (newSourceType === 'dipole') name = '외부 쌍극자';
    else if (newSourceType === 'comet') name = '접근 혜성 (Comet C/2026)';

    const newSource: ExternalMagneticSource = {
      id,
      name,
      type: newSourceType,
      x: newSourceType === 'comet' ? -3.2 : 2.2 + (Math.random() - 0.5) * 1.5,
      y: (Math.random() - 0.5) * 2.0,
      strength: newSourceStrength,
      angle: 0,
      active: true,
      orbiting: newSourceType === 'comet',
      orbitRadius: newSourceType === 'comet' ? 3.4 : 2.8,
      orbitSpeed: newSourceType === 'comet' ? 0.45 : 0.8,
      orbitPhase: Math.random() * Math.PI * 2,
      cometGasActivity: newCometActivity,
      cometTailLength: newCometTailLen,
    };
    setSources((prev) => [...prev, newSource]);
  };

  const handleRemoveSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleTriggerCME = () => {
    setSolarWind((prev) => ({
      ...prev,
      enabled: true,
      pressure: 3.5,
      imfBz: -2.2,
    }));
    setTimeout(() => {
      setSolarWind((prev) => ({
        ...prev,
        pressure: Math.max(1.0, prev.pressure * 0.7),
      }));
    }, 4000);
  };

  // Section Default Reset Handlers (Normal Earth Environment)
  const handleResetEarthNormal = () => {
    setEarthConfig({ ...DEFAULT_EARTH_DIPOLE });
  };

  const handleResetMoonNormal = () => {
    if (setMoonConfig) {
      setMoonConfig({ ...DEFAULT_MOON_CONFIG });
    }
  };

  const handleResetSourcesNormal = () => {
    setSources([]);
  };

  const handleResetSolarWindNormal = () => {
    setSolarWind({ ...DEFAULT_SOLAR_WIND });
  };

  const handleResetCloudNormal = () => {
    setCloudConfig({ ...DEFAULT_CLOUD_CONFIG });
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
          id="tab-moon"
          onClick={() => setActiveTab('moon')}
          className={`px-2.5 py-1.5 text-xs font-mono rounded transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'moon'
              ? 'bg-[#181824] text-slate-100 border border-slate-500/40 shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
          }`}
        >
          <Moon className="w-3.5 h-3.5 text-slate-300" />
          달 위성 (Moon)
        </button>
        <button
          id="tab-sources"
          onClick={() => setActiveTab('sources')}
          className={`px-2.5 py-1.5 text-xs font-mono rounded transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'sources'
              ? 'bg-[#181824] text-purple-300 border border-[#2c2c3e] shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-purple-400" />
          외부 자극원 & 혜성 ({sources.filter((s) => s.active).length})
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
        <button
          id="tab-weather"
          onClick={() => setActiveTab('weather')}
          className={`px-2.5 py-1.5 text-xs font-mono rounded transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'weather'
              ? 'bg-[#181824] text-emerald-300 border border-emerald-500/40 shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
          }`}
        >
          <Wind className="w-3.5 h-3.5 text-emerald-400" />
          세계 기상 연동 (수원/글로벌)
        </button>
      </div>

      {/* Tab Panels Content */}
      <div className="p-3 space-y-3 text-xs">
        {/* GLOBAL WEATHER TAB */}
        {activeTab === 'weather' && (
          <GlobalWeatherControl
            weatherData={weatherData}
            setWeatherData={setWeatherData}
            cloudConfig={cloudConfig}
            setCloudConfig={setCloudConfig}
            solarWind={solarWind}
            setSolarWind={setSolarWind}
          />
        )}

        {/* PRESETS TAB */}
        {activeTab === 'presets' && (
          <div className="space-y-2.5">
            {onResetSimulation && (
              <div className="p-3 bg-gradient-to-r from-red-950/40 via-[#181824] to-cyan-950/30 rounded-lg border border-red-500/30 flex items-center justify-between gap-3 shadow-lg">
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                    <span>시뮬레이션 전체 리셋 (Master Reset)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    모든 외부 자극원 및 혜성을 제거하고 지구 쌍극자·달·태양풍·지진운을 평온(Default) 상태로 일괄 초기화합니다.
                  </div>
                </div>
                <button
                  id="btn-reset-simulation-preset-tab"
                  onClick={onResetSimulation}
                  className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/50 rounded-md font-mono text-xs font-semibold whitespace-nowrap transition-all shadow-md active:scale-95 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  전체 초기화
                </button>
              </div>
            )}

            <p className="text-slate-400 text-[11px]">
              천체 물리 상호작용 및 가상 지자기-지진-대기 연동 가설을 즉시 검증할 수 있는 표준 프리셋입니다.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                id="preset-quiet"
                onClick={() => onApplyPreset('quiet')}
                className="p-2.5 bg-[#14141b] hover:bg-[#191924] border border-[#1e1e24] hover:border-cyan-500/40 rounded-md text-left transition-all group"
              >
                <div className="font-semibold text-cyan-300 text-xs flex items-center justify-between">
                  <span>1. 표준 평온 지구 쌍극자</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  외부 자극원이 없는 대칭적 1.0M 지구 자기 쌍극자 및 정상 달 궤도 환경
                </p>
              </button>

              <button
                id="preset-solar-storm"
                onClick={() => onApplyPreset('solar_storm')}
                className="p-2.5 bg-[#14141b] hover:bg-[#191924] border border-[#1e1e24] hover:border-amber-500/40 rounded-md text-left transition-all group"
              >
                <div className="font-semibold text-amber-300 text-xs flex items-center justify-between">
                  <span>2. 태양풍 CME 폭풍 & 자력선 재결합</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  강력한 동압(3.5 nPa) 및 남향 IMF(Bz &lt; 0) 유입에 따른 전면부 압축 및 Reconnection
                </p>
              </button>

              <button
                id="preset-comet-approach"
                onClick={() => onApplyPreset('comet_approach')}
                className="p-2.5 bg-[#14141b] hover:bg-[#191924] border border-[#1e1e24] hover:border-sky-500/40 rounded-md text-left transition-all group"
              >
                <div className="font-semibold text-sky-300 text-xs flex items-center justify-between">
                  <span>3. 외부 혜성 접근 (Comet Approach)</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition-colors" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  승화 가스 코마·이온 꼬리·반자성 공동에 의한 태양풍 왜곡 및 대기 직교 파동 유도
                </p>
              </button>

              <button
                id="preset-lunar-syzygy"
                onClick={() => onApplyPreset('lunar_syzygy')}
                className="p-2.5 bg-[#14141b] hover:bg-[#191924] border border-[#1e1e24] hover:border-indigo-500/40 rounded-md text-left transition-all group"
              >
                <div className="font-semibold text-indigo-300 text-xs flex items-center justify-between">
                  <span>4. 삭망월 조석력 극대화 (Lunar Syzygy)</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  보름달(180°) 자기권 꼬리 진입, 지구 조석 팽창(Tidal Bulge) 및 단층 임계 응력 촉발
                </p>
              </button>

              <button
                id="preset-third-pole"
                onClick={() => onApplyPreset('third_pole')}
                className="p-2.5 bg-[#14141b] hover:bg-[#191924] border border-[#1e1e24] hover:border-purple-500/40 rounded-md text-left transition-all group"
              >
                <div className="font-semibold text-purple-300 text-xs flex items-center justify-between">
                  <span>5. 제3의 우주 자기원 접근</span>
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
                  <span>6. 가상 지진운 & 지각 파열 유발</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400 transition-colors" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  자기 구배 집중 영역의 대기 입자 선형 밴드 형성 및 단층대 임계 지진 파열
                </p>
              </button>
            </div>
          </div>
        )}

        {/* EARTH DIPOLE TAB */}
        {activeTab === 'earth' && (
          <div className="space-y-3">
            {/* Explanatory Info Card */}
            <div className="p-2.5 bg-gradient-to-br from-cyan-950/30 to-[#12121a] rounded-md border border-cyan-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-cyan-300 font-semibold text-xs">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  지구 쌍극자(Earth Dipole) 물리적 의미
                </span>
                <button
                  id="btn-reset-earth-normal"
                  onClick={handleResetEarthNormal}
                  className="px-2 py-0.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 rounded text-[10px] font-mono transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  지구 기본값 복원 (1.0M, 11.5°)
                </button>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                지구 외핵의 액체 철 대류(지오다이내모)로 발생하는 주 자기장입니다. 자기 모멘트 m의 세기와 자축 경사각 θ(11.5°)에 의해 지구 자기권 형상과 방사선대(밴앨런대)가 결정됩니다.
              </p>
            </div>

            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>지구 자기 모멘트 (m)</span>
                <span className="font-mono text-cyan-400 font-bold">{earthConfig.moment.toFixed(1)} M_E</span>
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
              <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                <span>0.2 (약한 자기장)</span>
                <span className="text-cyan-300 font-semibold">1.0 (표준 정상 지구)</span>
                <span>6.0 (초강력 자기권)</span>
              </div>
            </div>

            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>지자기축 기울기 (Tilt Angle θ)</span>
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
              <div className="text-[10px] text-slate-400 mt-1 flex justify-between font-mono">
                <span>-90° (수평축)</span>
                <span className="text-cyan-300">11.5° (실제 지자기축)</span>
                <span>+90°</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div>
                <div className="font-medium text-slate-200 text-xs">지자기 극성 반전 (Geomagnetic Reversal)</div>
                <div className="text-[10px] text-slate-400">지구 N극과 S극 극성을 180도 뒤집습니다 (마투야마-브륀스 역전).</div>
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

        {/* MOON SATELLITE TAB */}
        {activeTab === 'moon' && (
          <div className="space-y-3">
            {/* Explanatory Info Card */}
            <div className="p-2.5 bg-gradient-to-br from-slate-900/50 via-[#14141d] to-sky-950/30 rounded-md border border-slate-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-slate-200 font-semibold text-xs">
                <span className="flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-slate-300" />
                  지구 위성 "달(Moon)" 물리적 속성 & 영향
                </span>
                <button
                  id="btn-reset-moon-normal"
                  onClick={handleResetMoonNormal}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded text-[10px] font-mono transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  달 기본값 복원
                </button>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                달은 지구 질량의 약 1/81.3로 평균 거리 약 384,400 km (3.5 R_E)에서 공전합니다.
                <br />
                • <strong>고체 지구 조석력(기조력)</strong>: 달의 중력 구배로 인해 지구 지각에 주기적인 인장/압축 응력(Δσ_tide)이 발생하여 지진 단층 파열에 기여합니다.
                <br />
                • <strong>국소 지각 잔류자기장</strong>: 달 지각 암석의 잔류 자화(Remanent Field) 및 태양풍 차폐 플라즈마 후류(Plasma Wake)가 형성됩니다.
              </p>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div>
                <div className="font-medium text-slate-200 text-xs">달(Moon) 시뮬레이션 활성화</div>
                <div className="text-[10px] text-slate-400">달 천체, 공전 궤도, 기조력 타원체, 플라즈마 후류 연동</div>
              </div>
              <button
                id="btn-toggle-moon"
                onClick={() => setMoonConfig && setMoonConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  moonConfig.enabled
                    ? 'bg-sky-600/30 text-sky-200 border border-sky-500/40'
                    : 'bg-[#1a1a24] text-slate-400 border border-[#2a2a38] hover:bg-[#222230]'
                }`}
              >
                {moonConfig.enabled ? 'ON (활성화)' : 'OFF (비활성)'}
              </button>
            </div>

            {moonConfig.enabled && (
              <>
                <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>달 궤도 위상각 (Orbital Phase)</span>
                    <span className="font-mono text-sky-300 font-bold">
                      {Math.round(moonConfig.phaseAngleDeg)}° (
                      {Math.abs(moonConfig.phaseAngleDeg - 0) < 20
                        ? '신월/New'
                        : Math.abs(moonConfig.phaseAngleDeg - 90) < 20
                        ? '상현/1st Qtr'
                        : Math.abs(moonConfig.phaseAngleDeg - 180) < 20
                        ? '보름달/Full'
                        : Math.abs(moonConfig.phaseAngleDeg - 270) < 20
                        ? '하현/3rd Qtr'
                        : '중간 위상'}
                      )
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={moonConfig.phaseAngleDeg}
                    onChange={(e) =>
                      setMoonConfig &&
                      setMoonConfig((prev) => ({ ...prev, phaseAngleDeg: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-[#09090c] rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                    <span>0° (신월/태양 방향)</span>
                    <span>90° (상현)</span>
                    <span>180° (보름달/자기권꼬리)</span>
                    <span>270° (하현)</span>
                  </div>
                </div>

                <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>달 궤도 반경 (Distance)</span>
                    <span className="font-mono text-sky-300 font-bold">
                      {(moonConfig.orbitRadius ?? 3.5).toFixed(1)} R_E (약{' '}
                      {Math.round((moonConfig.orbitRadius ?? 3.5) * 110000).toLocaleString()} km)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.8"
                    max="6.0"
                    step="0.1"
                    value={moonConfig.orbitRadius ?? 3.5}
                    onChange={(e) =>
                      setMoonConfig &&
                      setMoonConfig((prev) => ({ ...prev, orbitRadius: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-[#09090c] rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                    <span>1.8 R_E (근지점 가상접근)</span>
                    <span className="text-sky-300 font-bold">3.5 R_E (실제 평균 궤도)</span>
                    <span>6.0 R_E (원거리)</span>
                  </div>
                </div>

                <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>고체 지구 조석력(기조력) 가중치</span>
                    <span className="font-mono text-sky-300 font-bold">
                      {(moonConfig.tidalStressWeight ?? 0.25).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={moonConfig.tidalStressWeight ?? 0.25}
                    onChange={(e) =>
                      setMoonConfig &&
                      setMoonConfig((prev) => ({ ...prev, tidalStressWeight: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-[#09090c] rounded"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    달의 기조력에 의한 지각 응력 변조율입니다. 삭망월(신월·보름) 축을 따라 단층 응력 축적이 가속됩니다.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-[#14141b] rounded border border-[#1e1e24]">
                    <div className="flex justify-between text-slate-300 text-[11px] mb-1">
                      <span>달 잔류 자기장 (m_M)</span>
                      <span className="font-mono text-sky-300 font-bold">
                        {(moonConfig.remanentMoment ?? 0.08).toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="0.8"
                      step="0.02"
                      value={moonConfig.remanentMoment ?? 0.08}
                      onChange={(e) =>
                        setMoonConfig &&
                        setMoonConfig((prev) => ({ ...prev, remanentMoment: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-sky-400 h-1.5 bg-[#09090c] rounded"
                    />
                  </div>

                  <div className="p-2 bg-[#14141b] rounded border border-[#1e1e24] flex flex-col justify-between">
                    <div className="text-[11px] text-slate-300">달 자동 공전 (Auto-Orbit)</div>
                    <button
                      onClick={() =>
                        setMoonConfig &&
                        setMoonConfig((prev) => ({ ...prev, autoOrbit: !prev.autoOrbit }))
                      }
                      className={`w-full py-1 rounded text-xs font-mono font-medium transition-colors ${
                        moonConfig.autoOrbit
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                          : 'bg-[#0f0f15] text-slate-400 border border-[#1e1e24]'
                      }`}
                    >
                      {moonConfig.autoOrbit ? '공전 진행 중' : '공전 정지'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* EXTERNAL SOURCES & COMET TAB */}
        {activeTab === 'sources' && (
          <div className="space-y-3">
            {/* Explanatory Info Card */}
            <div className="p-2.5 bg-gradient-to-br from-purple-950/30 to-[#14141d] rounded-md border border-purple-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-purple-300 font-semibold text-xs">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  외부 자극원 & 접근 혜성(Comet) 물리적 의미
                </span>
                <button
                  id="btn-reset-sources-normal"
                  onClick={handleResetSourcesNormal}
                  className="px-2 py-0.5 bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-500/40 rounded text-[10px] font-mono transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  외부 자극원 전체 제거 (0개)
                </button>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                • <strong>단극/쌍극자</strong>: 우주 공간의 외부 자기 섭동원으로 지구 자기력선을 왜곡하고 Reconnection(X점)을 생성합니다.
                <br />
                • <strong>접근 혜성(Comet)</strong>: 태양 복사열로 승화된 가스 코마가 광전리(Photoionization)되어 태양풍 자기장에 플라즈마를 부하(Mass-loading)시킵니다. 핵 주변 반자성 공동(Diamagnetic cavity)과 긴 이온 꼬리가 지구 자기권과 대기 파동운을 간섭합니다.
              </p>
            </div>

            {/* Add New Source Tool */}
            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24] space-y-2">
              <div className="font-medium text-slate-200 text-xs">새로운 외부 자기원 / 혜성 추가</div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => setNewSourceType('monopole_n')}
                  className={`py-1 text-[11px] font-mono rounded border font-medium ${
                    newSourceType === 'monopole_n'
                      ? 'bg-red-950/40 text-red-300 border-red-500/50'
                      : 'bg-[#0f0f15] text-slate-400 border-[#1e1e24]'
                  }`}
                >
                  N극 단극 (+q)
                </button>
                <button
                  onClick={() => setNewSourceType('monopole_s')}
                  className={`py-1 text-[11px] font-mono rounded border font-medium ${
                    newSourceType === 'monopole_s'
                      ? 'bg-blue-950/40 text-blue-300 border-blue-500/50'
                      : 'bg-[#0f0f15] text-slate-400 border-[#1e1e24]'
                  }`}
                >
                  S극 단극 (-q)
                </button>
                <button
                  onClick={() => setNewSourceType('dipole')}
                  className={`py-1 text-[11px] font-mono rounded border font-medium ${
                    newSourceType === 'dipole'
                      ? 'bg-purple-950/40 text-purple-300 border-purple-500/50'
                      : 'bg-[#0f0f15] text-slate-400 border-[#1e1e24]'
                  }`}
                >
                  쌍극자 (m_ext)
                </button>
                <button
                  onClick={() => setNewSourceType('comet')}
                  className={`py-1 text-[11px] font-mono rounded border font-medium ${
                    newSourceType === 'comet'
                      ? 'bg-sky-950/60 text-sky-300 border-sky-500/50 font-bold'
                      : 'bg-[#0f0f15] text-slate-400 border-[#1e1e24]'
                  }`}
                >
                  ☄️ 혜성 (Comet)
                </button>
              </div>

              {newSourceType === 'comet' ? (
                <div className="space-y-2 pt-1 border-t border-[#1e1e24]">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs">승화 가스 방출율 (Activity):</span>
                    <input
                      type="range"
                      min="1.0"
                      max="6.0"
                      step="0.2"
                      value={newCometActivity}
                      onChange={(e) => setNewCometActivity(parseFloat(e.target.value))}
                      className="flex-1 accent-sky-400 h-1.5 bg-[#09090c] rounded"
                    />
                    <span className="font-mono text-sky-400 font-bold">{newCometActivity.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs">이온 꼬리 길이 (Tail Length):</span>
                    <input
                      type="range"
                      min="1.5"
                      max="5.5"
                      step="0.2"
                      value={newCometTailLen}
                      onChange={(e) => setNewCometTailLen(parseFloat(e.target.value))}
                      className="flex-1 accent-sky-400 h-1.5 bg-[#09090c] rounded"
                    />
                    <span className="font-mono text-sky-400 font-bold">{newCometTailLen.toFixed(1)} R_E</span>
                    <button
                      id="btn-add-comet-source"
                      onClick={handleAddSource}
                      className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded flex items-center gap-1 font-medium transition-colors text-xs shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      혜성 투입
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-slate-400 text-xs">자극 세기:</span>
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
              )}
            </div>

            {/* List of Active Sources */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {sources.length === 0 ? (
                <div className="text-slate-500 text-center py-3 bg-[#14141b] rounded border border-[#1e1e24] text-xs">
                  현재 활성화된 외부 자극원/혜성이 없습니다.
                </div>
              ) : (
                sources.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 bg-[#14141b] rounded border border-[#1e1e24] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          s.type === 'monopole_n'
                            ? 'bg-red-500'
                            : s.type === 'monopole_s'
                            ? 'bg-blue-500'
                            : s.type === 'comet'
                            ? 'bg-sky-400 animate-pulse'
                            : 'bg-purple-500'
                        }`}
                      />
                      <div>
                        <div className="font-medium text-slate-200 text-xs flex items-center gap-1">
                          {s.type === 'comet' ? '☄️ ' : ''}
                          {s.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          좌표: ({s.x.toFixed(1)}, {s.y.toFixed(1)}) · 강도: {s.strength}q
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
                ))
              )}
            </div>
          </div>
        )}

        {/* SOLAR WIND & IMF TAB */}
        {activeTab === 'solar' && (
          <div className="space-y-3">
            {/* Explanatory Info Card */}
            <div className="p-2.5 bg-gradient-to-br from-amber-950/30 to-[#14141d] rounded-md border border-amber-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-amber-300 font-semibold text-xs">
                <span className="flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  태양풍 & IMF(행성간 자기장) 물리적 의미
                </span>
                <button
                  id="btn-reset-solar-normal"
                  onClick={handleResetSolarWindNormal}
                  className="px-2 py-0.5 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40 rounded text-[10px] font-mono transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  태양풍 기본값 복원 (1.0 nPa, 0.0 nT)
                </button>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                • <strong>동압축(P_dyn = ρ v²)</strong>: 태양 코로나에서 방출되는 초음속 플라즈마 흐름으로, 주간측 자기권을 압축하고 후방으로 자기권 꼬리(Magnetotail)를 늘어뜨립니다.
                <br />
                • <strong>IMF Bz (남북 성분)</strong>: 남향(Bz &lt; 0)일 때 지구 북향 자기력선과 반평행 결합(Reconnection)하여 극관으로 태양 에너지를 주입하고 오로라 및 지자기 폭풍을 촉발합니다.
              </p>
            </div>

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
                <span>태양풍 동압 (P_dyn)</span>
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
              <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                <span>0.2 (극약)</span>
                <span className="text-amber-300 font-bold">1.0 (평온 상태)</span>
                <span>4.5 (강력한 폭풍압축)</span>
              </div>
            </div>

            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>IMF 남북 성분 (Bz) - Reconnection</span>
                <span className={`font-mono font-bold ${solarWind.imfBz < 0 ? 'text-pink-400' : 'text-cyan-400'}`}>
                  {solarWind.imfBz.toFixed(1)} nT {solarWind.imfBz < 0 ? '(남향: Reconnection 폭풍)' : '(북향: 폐쇄 쉴드)'}
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
              <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                <span className="text-pink-400">-3.0 nT (강력 남향 재결합)</span>
                <span className="text-slate-300">0.0 nT (중립)</span>
                <span className="text-cyan-400">+3.0 nT (북향)</span>
              </div>
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
            {/* Explanatory Info Card */}
            <div className="p-2.5 bg-gradient-to-br from-cyan-950/30 to-[#14141d] rounded-md border border-cyan-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-cyan-300 font-semibold text-xs">
                <span className="flex items-center gap-1.5">
                  <CloudSun className="w-3.5 h-3.5 text-cyan-400" />
                  가상 지진운(Atmospheric Wave Clouds) 물리 모델
                </span>
                <button
                  id="btn-reset-cloud-normal"
                  onClick={handleResetCloudNormal}
                  className="px-2 py-0.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 rounded text-[10px] font-mono transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  지진운 기본값 복원
                </button>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                지진 단층대의 압전·마찰 전기(Piezoelectric) 및 외부 자기 섭동에 의해 대기 중 전하 입자가 자기력선 직교 방향(B_perp)으로 선형 밴드(양떼구름) 형태로 정렬되는 가상 물리 모델입니다.
                <br />
                • <strong>외부 자극원 연동 게이팅</strong>: 외부 자극원(자기원·혜성·태양풍 CME) 총합이 설정 임계치 이상일 때만 양떼구름 지진운이 발현되며, 평상시에는 수원 관측소 등 <strong>실제 세계 기상 구름</strong>이 적용됩니다.
              </p>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24]">
              <div>
                <div className="font-medium text-slate-200 text-xs">가상 지진운 모델링 활성화</div>
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
                  {/* External Stimulus Gating Threshold Control */}
                  <div className="p-2 bg-[#09090d] rounded border border-cyan-950/60 space-y-1">
                    <div className="flex justify-between text-slate-300 text-[11px]">
                      <span className="font-semibold text-cyan-300">지진운 발현 최소 외부자극 임계치</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {(cloudConfig.externalStimulusThreshold ?? 0.5).toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.05"
                      value={cloudConfig.externalStimulusThreshold ?? 0.5}
                      onChange={(e) =>
                        setCloudConfig((prev) => ({ ...prev, externalStimulusThreshold: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-cyan-400 h-1.5 bg-[#14141c] rounded"
                    />
                    <div className="flex items-center justify-between text-[10px] pt-0.5">
                      <span className="text-slate-400">
                        현재 외부자극도:{' '}
                        <strong className="text-slate-200 font-mono">
                          {(
                            sources.filter((s) => s.active).reduce((sum, s) => sum + s.strength, 0) +
                            (solarWind.enabled ? solarWind.pressure * 0.5 : 0)
                          ).toFixed(2)}
                        </strong>
                      </span>
                      {sources.filter((s) => s.active).reduce((sum, s) => sum + s.strength, 0) +
                        (solarWind.enabled ? solarWind.pressure * 0.5 : 0) >=
                      (cloudConfig.externalStimulusThreshold ?? 0.5) ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-bold font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          지진운 발현 조건 충족
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/30 font-mono">
                          평상시 세계 기상 구름 적용 중
                        </span>
                      )}
                    </div>
                  </div>

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
                </div>
              )}
            </div>

            {/* INSPECTION VIEW & PERSPECTIVE CONTROL SECTION */}
            <div className="p-2.5 bg-[#121218] rounded-md border border-purple-900/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-purple-300 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    지진운 격리 시각화 및 패턴 검증 뷰 (Inspection Mode)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    배경 간섭 요소를 끄고 파동운의 국소성과 직교 정렬을 고대비로 정밀 검증
                  </div>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setCloudConfig((prev) => ({ ...prev, inspectionMode: 'cloud_density' }))}
                  className={`p-1.5 rounded border text-[11px] font-mono text-left transition-colors flex items-center gap-1.5 ${
                    cloudConfig.inspectionMode === 'cloud_density'
                      ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50 font-semibold'
                      : 'bg-[#14141d] text-slate-400 border-[#222230] hover:text-slate-200'
                  }`}
                >
                  <Waves className="w-3.5 h-3.5 text-cyan-400" />
                  <div>
                    <div className="font-bold">1. 순수 구름 단독</div>
                    <div className="text-[9px] text-slate-500">배경 요소 차단, C(x,y)만 렌더</div>
                  </div>
                </button>

                <button
                  onClick={() => setCloudConfig((prev) => ({ ...prev, inspectionMode: 'hotspot_mask' }))}
                  className={`p-1.5 rounded border text-[11px] font-mono text-left transition-colors flex items-center gap-1.5 ${
                    cloudConfig.inspectionMode === 'hotspot_mask'
                      ? 'bg-orange-950/60 text-orange-300 border-orange-500/50 font-semibold'
                      : 'bg-[#14141d] text-slate-400 border-[#222230] hover:text-slate-200'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <div>
                    <div className="font-bold">2. 핫스팟 마스크 분석</div>
                    <div className="text-[9px] text-slate-500">M(x,y) 시그모이드 활성화 영역</div>
                  </div>
                </button>

                <button
                  onClick={() => setCloudConfig((prev) => ({ ...prev, inspectionMode: 'cloud_vector_overlay' }))}
                  className={`p-1.5 rounded border text-[11px] font-mono text-left transition-colors flex items-center gap-1.5 ${
                    cloudConfig.inspectionMode === 'cloud_vector_overlay'
                      ? 'bg-sky-950/60 text-sky-300 border-sky-500/50 font-semibold'
                      : 'bg-[#14141d] text-slate-400 border-[#222230] hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <div>
                    <div className="font-bold">3. 벡터 정렬 오버레이</div>
                    <div className="text-[9px] text-slate-500">반투명(α=0.35) 자기력선 중첩</div>
                  </div>
                </button>

                <button
                  onClick={() => setCloudConfig((prev) => ({ ...prev, inspectionMode: 'split_3view', perspectiveMode: 'space_global' }))}
                  className={`p-1.5 rounded border text-[11px] font-mono text-left transition-colors flex items-center gap-1.5 ${
                    cloudConfig.inspectionMode === 'split_3view'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50 font-semibold'
                      : 'bg-[#14141d] text-slate-400 border-[#222230] hover:text-slate-200'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <div className="font-bold">4. 3분할 패턴 비교 뷰</div>
                    <div className="text-[9px] text-slate-500">수치 스크립트 1:1 동기화 3-Plot</div>
                  </div>
                </button>
              </div>

              {/* Perspective Mode Switcher */}
              <div className="p-2 bg-[#161622] rounded border border-[#262638] space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <Eye className="w-3 h-3 text-cyan-400" />
                  관측 시점 (Perspective Mode)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setCloudConfig((prev) => ({ ...prev, perspectiveMode: 'space_global' }))}
                    className={`py-1 text-xs font-mono rounded border text-center transition-colors ${
                      cloudConfig.perspectiveMode === 'space_global' || !cloudConfig.perspectiveMode
                        ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 font-semibold'
                        : 'bg-[#0f0f15] text-slate-400 border-[#1e1e24]'
                    }`}
                  >
                    우주 전역 2D 뷰
                  </button>
                  <button
                    onClick={() => setCloudConfig((prev) => ({ ...prev, perspectiveMode: 'ground_sky' }))}
                    className={`py-1 text-xs font-mono rounded border text-center transition-colors ${
                      cloudConfig.perspectiveMode === 'ground_sky'
                        ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 font-semibold'
                        : 'bg-[#0f0f15] text-slate-400 border-[#1e1e24]'
                    }`}
                  >
                    지상 관측자 하늘 뷰 (어안 렌즈)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STRESS & EARTHQUAKES TAB */}
        {activeTab === 'stress' && (
          <div className="space-y-3">
            {/* Explanatory Info Card */}
            <div className="p-2.5 bg-gradient-to-br from-red-950/30 to-[#14141d] rounded-md border border-red-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-red-300 font-semibold text-xs">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-red-400" />
                  지각 응력 & 파쇄(Rupture) 물리적 의미
                </span>
                <button
                  onClick={() => stressManager.dischargeAllStress()}
                  className="px-2 py-0.5 bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/40 rounded text-[10px] font-mono transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  응력 전체 방전/초기화
                </button>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                판구조론적 지각 노드(48개 단층 분할)에 축적되는 전단 응력 σ 모델입니다.
                <br />
                • <strong>복합 기전</strong>: 배경 지각 변형 + 지자기 압전 유도 응력 + <strong>달 고체 조석력 변조(Δσ_tide)</strong>가 합산되며, 쿨롱 파괴 기준(Coulomb Failure Criterion) σ ≥ σ_crit(0.85) 도달 시 모멘트 규모 M_w 4.5 ~ 7.8 지진이 파열됩니다.
              </p>
            </div>

            <div className="p-2.5 bg-[#14141b] rounded-md border border-[#1e1e24] flex items-center justify-between">
              <div>
                <div className="font-semibold text-amber-400 text-xs font-mono">최대 지각 응력 단층 노드 #{stressManager.maxStressNodeIndex}</div>
                <div className="text-slate-200 font-mono text-xs font-bold mt-0.5">
                  현재 축적도: {(stressManager.maxStressValue * 100).toFixed(1)}% / 임계 파열점: {(stressManager.ruptureThreshold * 100).toFixed(0)}%
                </div>
              </div>
              <button
                id="btn-trigger-rupture"
                onClick={() => stressManager.manualTriggerNode(stressManager.maxStressNodeIndex, onEarthquakeTriggered)}
                className="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white font-mono text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shadow-md shadow-red-950/50"
              >
                <Zap className="w-3.5 h-3.5 text-yellow-300" />
                강제 파열 (Rupture)
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
