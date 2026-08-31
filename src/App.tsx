import React, { useState, useMemo, useCallback } from 'react';
import {
  AtmosphericCloudConfig,
  EarthDipoleConfig,
  EarthquakeEvent,
  ExternalMagneticSource,
  HeatmapMetric,
  RenderMode,
  SolarWindConfig,
} from './types';
import { CloudParticleSystem } from './physics/cloudParticleEngine';
import { CrustalStressManager } from './physics/crustalStressEngine';
import { SimulationCanvas2D } from './components/SimulationCanvas2D';
import { Magnetosphere3DView } from './components/Magnetosphere3DView';
import { PhysicsControls } from './components/PhysicsControls';
import { GeminiExpertAssistant } from './components/GeminiExpertAssistant';
import { MathFormulaCard } from './components/MathFormulaCard';
import { NumericalVerificationModal } from './components/NumericalVerificationModal';
import {
  Activity,
  AlertOctagon,
  Bot,
  Box,
  Code,
  Compass,
  FileCode,
  Flame,
  Globe,
  Layers,
  Maximize2,
  Radio,
  Sliders,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react';

export default function App() {
  // 1. Earth Dipole Configuration
  const [earthConfig, setEarthConfig] = useState<EarthDipoleConfig>({
    x: 0,
    y: 0,
    moment: 2.2,
    tiltAngle: 11,
    radius: 0.95,
    reversed: false,
  });

  // 2. External Magnetic Sources (Monopoles & Dipoles)
  const [sources, setSources] = useState<ExternalMagneticSource[]>([
    {
      id: 'source-1',
      name: '접근하는 외부 N극',
      type: 'monopole_n',
      x: 2.6,
      y: 0.8,
      strength: 2.5,
      active: true,
      orbiting: false,
      orbitRadius: 2.6,
      orbitSpeed: 0.5,
      orbitPhase: 0.3,
    },
  ]);

  // 3. Solar Wind & IMF Configuration
  const [solarWind, setSolarWind] = useState<SolarWindConfig>({
    enabled: true,
    pressure: 1.5,
    imfBx: 0.5,
    imfBz: -1.2, // Southward IMF for reconnection
    speed: 1.2,
    density: 1.0,
  });

  // 4. Atmospheric Cloud Particle Model Configuration ("가상 지진운")
  const [cloudConfig, setCloudConfig] = useState<AtmosphericCloudConfig>({
    enabled: true,
    particleCount: 500,
    polarizationSusceptibility: 1.2,
    chargeRatio: 0.6,
    condensationThreshold: 0.8,
    showParticles: true,
    showCloudBands: true,
    cloudOpacity: 0.85,
    viscosity: 0.08,
  });

  // 5. Physics Engines Instances
  const stressManager = useMemo(() => new CrustalStressManager(48), []);
  const particleSystem = useMemo(() => new CloudParticleSystem(500), []);

  // 6. View & UI State
  const [viewMode, setViewMode] = useState<'2D' | '3D' | 'split'>('2D');
  const [renderMode, setRenderMode] = useState<RenderMode>('composite');
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>('magnitude');
  const [showNeutralPoints, setShowNeutralPoints] = useState<boolean>(true);
  const [streamlineDensity, setStreamlineDensity] = useState<number>(28);

  const [activeControlTab, setActiveControlTab] = useState<'earth' | 'sources' | 'solar' | 'cloud' | 'stress' | 'presets'>('presets');
  const [isPythonModalOpen, setIsPythonModalOpen] = useState<boolean>(false);
  const [latestEarthquake, setLatestEarthquake] = useState<EarthquakeEvent | null>(null);

  // Earthquake Event Handler
  const handleEarthquakeTriggered = useCallback((event: EarthquakeEvent) => {
    setLatestEarthquake(event);
    setTimeout(() => {
      setLatestEarthquake((prev) => (prev?.id === event.id ? null : prev));
    }, 6000);
  }, []);

  // Preset Scenario Applier
  const handleApplyPreset = (presetKey: string) => {
    if (presetKey === 'quiet') {
      setEarthConfig((prev) => ({ ...prev, moment: 2.5, tiltAngle: 0, reversed: false, x: 0, y: 0 }));
      setSources([]);
      setSolarWind((prev) => ({ ...prev, enabled: false }));
    } else if (presetKey === 'solar_storm') {
      setEarthConfig((prev) => ({ ...prev, moment: 2.2, tiltAngle: 11, reversed: false, x: 0, y: 0 }));
      setSources([]);
      setSolarWind({
        enabled: true,
        pressure: 3.8,
        imfBx: 0.8,
        imfBz: -2.4, // Strong southward reconnection
        speed: 2.2,
        density: 2.0,
      });
    } else if (presetKey === 'third_pole') {
      setEarthConfig((prev) => ({ ...prev, moment: 2.0, tiltAngle: -15, reversed: false, x: 0, y: 0 }));
      setSources([
        {
          id: 'ext-n',
          name: '우주 외부 N극',
          type: 'monopole_n',
          x: 2.5,
          y: 1.2,
          strength: 3.2,
          active: true,
          orbiting: true,
          orbitRadius: 2.8,
          orbitSpeed: 0.7,
          orbitPhase: 0,
        },
        {
          id: 'ext-s',
          name: '우주 외부 S극',
          type: 'monopole_s',
          x: -2.8,
          y: -1.5,
          strength: 2.8,
          active: true,
          orbiting: true,
          orbitRadius: 3.2,
          orbitSpeed: -0.4,
          orbitPhase: Math.PI,
        },
      ]);
      setSolarWind((prev) => ({ ...prev, enabled: true, pressure: 1.2, imfBz: -0.5 }));
    } else if (presetKey === 'critical_earthquake') {
      setEarthConfig((prev) => ({ ...prev, moment: 2.8, tiltAngle: 25, reversed: false, x: 0, y: 0 }));
      setSources([
        {
          id: 'dense-pole',
          name: '집중 자기 교란원',
          type: 'monopole_s',
          x: 1.5,
          y: 0.2,
          strength: 4.5,
          active: true,
          orbiting: false,
        },
      ]);
      setCloudConfig((prev) => ({
        ...prev,
        enabled: true,
        particleCount: 800,
        polarizationSusceptibility: 2.0,
        showCloudBands: true,
      }));
      // Prime crustal fault node to near rupture
      stressManager.nodes[12].accumulatedStress = 0.84;
    } else if (presetKey === 'reversal') {
      setEarthConfig((prev) => ({
        ...prev,
        moment: 1.2, // Dipole weakens during reversal
        tiltAngle: 85,
        reversed: true,
        x: 0,
        y: 0,
      }));
      setSources([
        {
          id: 'transient-quadrupole',
          name: '과도기 다극 성분',
          type: 'dipole',
          x: -1.8,
          y: 0.5,
          strength: 2.0,
          angle: 45,
          active: true,
        },
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 antialiased">
      {/* Top Main Navigation Header - High Density */}
      <header className="h-14 px-3 md:px-5 bg-[#0f0f13]/95 backdrop-blur-md border-b border-[#1e1e24] flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#14141b] border border-[#22222e] text-cyan-400 shadow-sm flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs md:text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <span>다극 자기장 상호작용 및 가상 지진운 시뮬레이션</span>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded bg-[#161622] text-cyan-400 border border-cyan-500/30 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                RK4 Vector Engine
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
              Dipole Superposition · IMF Reconnection · Cloud Polarization · Crustal Stress Tensor
            </p>
          </div>
        </div>

        {/* View Switchers & Export Actions */}
        <div className="flex items-center gap-2">
          {/* 2D / 3D / Split Switcher */}
          <div className="flex items-center p-0.5 bg-[#0a0a0e] rounded-md border border-[#1e1e24] text-xs font-medium">
            <button
              id="view-mode-2d"
              onClick={() => setViewMode('2D')}
              className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 text-xs ${
                viewMode === '2D'
                  ? 'bg-[#181822] text-cyan-300 border border-[#2c2c3e] shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              2D 벡터장
            </button>
            <button
              id="view-mode-3d"
              onClick={() => setViewMode('3D')}
              className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 text-xs ${
                viewMode === '3D'
                  ? 'bg-[#181822] text-cyan-300 border border-[#2c2c3e] shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              3D 자기권
            </button>
            <button
              id="view-mode-split"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded transition-colors hidden md:flex items-center gap-1.5 text-xs ${
                viewMode === 'split'
                  ? 'bg-[#181822] text-cyan-300 border border-[#2c2c3e] shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              분할 뷰
            </button>
          </div>

          {/* Python Verification Exporter Button */}
          <button
            id="btn-open-python-modal"
            onClick={() => setIsPythonModalOpen(true)}
            className="px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Python 수치 검증</span>
          </button>
        </div>
      </header>

      {/* Main Grid Workspace - High Density */}
      <main className="flex-1 p-3 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3.5 max-w-[1880px] w-full mx-auto">
        {/* Left / Center Viewport Column (Canvas 2D / 3D) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-3.5">
          {/* Main Visualizer Area */}
          <div className="w-full h-[540px] md:h-[620px] rounded-lg border border-[#1e1e24] bg-[#0c0c10] overflow-hidden shadow-2xl shadow-black/80">
            {viewMode === '2D' && (
              <SimulationCanvas2D
                earthConfig={earthConfig}
                setEarthConfig={setEarthConfig}
                sources={sources}
                setSources={setSources}
                solarWind={solarWind}
                setSolarWind={setSolarWind}
                cloudConfig={cloudConfig}
                setCloudConfig={setCloudConfig}
                stressManager={stressManager}
                particleSystem={particleSystem}
                onEarthquakeTriggered={handleEarthquakeTriggered}
                renderMode={renderMode}
                setRenderMode={setRenderMode}
                heatmapMetric={heatmapMetric}
                setHeatmapMetric={setHeatmapMetric}
                showNeutralPoints={showNeutralPoints}
                setShowNeutralPoints={setShowNeutralPoints}
                streamlineDensity={streamlineDensity}
              />
            )}

            {viewMode === '3D' && (
              <Magnetosphere3DView
                earthConfig={earthConfig}
                sources={sources}
                solarWind={solarWind}
                cloudConfig={cloudConfig}
              />
            )}

            {viewMode === 'split' && (
              <div className="grid grid-cols-2 gap-2 h-full bg-[#0a0a0c]">
                <SimulationCanvas2D
                  earthConfig={earthConfig}
                  setEarthConfig={setEarthConfig}
                  sources={sources}
                  setSources={setSources}
                  solarWind={solarWind}
                  setSolarWind={setSolarWind}
                  cloudConfig={cloudConfig}
                  setCloudConfig={setCloudConfig}
                  stressManager={stressManager}
                  particleSystem={particleSystem}
                  onEarthquakeTriggered={handleEarthquakeTriggered}
                  renderMode={renderMode}
                  setRenderMode={setRenderMode}
                  heatmapMetric={heatmapMetric}
                  setHeatmapMetric={setHeatmapMetric}
                  showNeutralPoints={showNeutralPoints}
                  setShowNeutralPoints={setShowNeutralPoints}
                  streamlineDensity={streamlineDensity}
                />
                <Magnetosphere3DView
                  earthConfig={earthConfig}
                  sources={sources}
                  solarWind={solarWind}
                  cloudConfig={cloudConfig}
                />
              </div>
            )}
          </div>

          {/* Mathematical Formulations Reference Card */}
          <MathFormulaCard />
        </div>

        {/* Right Sidebar: Physics Control Deck & Gemini AI Expert Studio */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3.5">
          {/* Controls Deck */}
          <PhysicsControls
            earthConfig={earthConfig}
            setEarthConfig={setEarthConfig}
            sources={sources}
            setSources={setSources}
            solarWind={solarWind}
            setSolarWind={setSolarWind}
            cloudConfig={cloudConfig}
            setCloudConfig={setCloudConfig}
            stressManager={stressManager}
            onEarthquakeTriggered={handleEarthquakeTriggered}
            onApplyPreset={handleApplyPreset}
            activeTab={activeControlTab}
            setActiveTab={setActiveControlTab}
          />

          {/* Gemini AI Computational Physics Expert Studio */}
          <GeminiExpertAssistant
            earthConfig={earthConfig}
            sources={sources}
            solarWind={solarWind}
            maxStress={stressManager.maxStressValue}
            maxStressNodeIndex={stressManager.maxStressNodeIndex}
            alignmentOrder={particleSystem.globalAlignmentOrder}
          />
        </div>
      </main>

      {/* Real-time Earthquake Alert Toast Banner */}
      {latestEarthquake && (
        <div className="fixed bottom-4 right-4 z-50 p-3.5 bg-[#140a0c]/95 backdrop-blur-md rounded-lg border border-red-500/60 shadow-2xl shadow-black text-slate-200 flex items-center gap-3 animate-in slide-in-from-bottom duration-300 max-w-md">
          <div className="p-2 rounded-md bg-red-600/90 text-white flex-shrink-0">
            <AlertOctagon className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-red-300 text-xs flex items-center gap-2">
              <span>가상 지진 파열 (Virtual Rupture) 발생</span>
              <span className="px-1.5 py-0.2 rounded bg-red-900/80 border border-red-500/40 text-red-200 font-mono text-[10px] font-bold">
                M_w {latestEarthquake.magnitude}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              단층 노드 #{latestEarthquake.nodeIndex}에서 자기 변형 응력 임계 돌파로 탄성 파열 및 P/S 지진파가 방출되었습니다.
            </p>
          </div>
        </div>
      )}

      {/* Python Numerical Code Export Modal */}
      <NumericalVerificationModal
        isOpen={isPythonModalOpen}
        onClose={() => setIsPythonModalOpen(false)}
        earthConfig={earthConfig}
        sources={sources}
        solarWind={solarWind}
      />
    </div>
  );
}
