import React, { Suspense, lazy, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  AtmosphericCloudConfig,
  EarthDipoleConfig,
  EarthquakeEvent,
  ExternalMagneticSource,
  GlobalWeatherData,
  HeatmapMetric,
  LayerVisibilityConfig,
  MoonConfig,
  RenderMode,
  SolarWindConfig,
  DEFAULT_CLOUD_CONFIG,
  DEFAULT_EARTH_DIPOLE,
  DEFAULT_MOON_CONFIG,
  DEFAULT_SOLAR_WIND,
} from './types';
import { CloudParticleSystem } from './physics/cloudParticleEngine';
import { advanceMoon, advanceSource, DEFAULT_RESEARCH, ResearchConfig, needsLogOnly } from './physics/fieldModel';
import { KnowledgePage } from './components/KnowledgePage';
import { CrustalStressManager } from './physics/crustalStressEngine';
import { GLOBAL_WEATHER_PRESETS } from './physics/weatherEngine';
import { SimulationCanvas2D } from './components/SimulationCanvas2D';
import { DEFAULT_LAYER_VISIBILITY } from './components/VisualElementsGuidePanel';
import { PhysicsControls } from './components/PhysicsControls';
import { MathFormulaCard } from './components/MathFormulaCard';
import {
  Activity,
  AlertOctagon,
  Box,
  Code,
  Compass,
  FileCode,
  Flame,
  Globe,
  Layers,
  Maximize2,
  Minimize2,
  Moon,
  Radio,
  RotateCcw,
  Sliders,
  Sparkles,
  Sun,
  Wind,
  Zap,
} from 'lucide-react';

const Magnetosphere3DView = lazy(() =>
  import('./components/Magnetosphere3DView').then((module) => ({ default: module.Magnetosphere3DView }))
);
const NumericalVerificationModal = lazy(() =>
  import('./components/NumericalVerificationModal').then((module) => ({ default: module.NumericalVerificationModal }))
);

const createDefaultCloudConfig = (): AtmosphericCloudConfig => ({
  ...DEFAULT_CLOUD_CONFIG,
  weatherData: { ...GLOBAL_WEATHER_PRESETS[0].data },
});

const ViewLoadingFallback = () => (
  <div className="h-full w-full flex items-center justify-center bg-[#09090d] text-xs font-mono text-cyan-300">
    시각화 모듈을 불러오는 중입니다…
  </div>
);

export default function App() {
  // 1. Global Meteorological Data State (NOAA GFS / ECMWF IFS / DWD ICON)
  const [weatherData, setWeatherData] = useState<GlobalWeatherData>(GLOBAL_WEATHER_PRESETS[0].data);

  // 2. Earth Dipole Configuration
  const [earthConfig, setEarthConfig] = useState<EarthDipoleConfig>({ ...DEFAULT_EARTH_DIPOLE });

  // 3. External Magnetic Sources (Monopoles, Dipoles, Comets)
  const [sources, setSources] = useState<ExternalMagneticSource[]>([]);

  // 4. Solar Wind & IMF Configuration
  const [solarWind, setSolarWind] = useState<SolarWindConfig>({ ...DEFAULT_SOLAR_WIND });

  // 5. Lunar Satellite & Tidal Physics Configuration
  const [moonConfig, setMoonConfig] = useState<MoonConfig>({ ...DEFAULT_MOON_CONFIG });

  // 6. Atmospheric Cloud Particle Model Configuration ("가상 지진운")
  const [cloudConfig, setCloudConfig] = useState<AtmosphericCloudConfig>(createDefaultCloudConfig);

  // 7. Physics Engines Instances
  const stressManager = useMemo(() => new CrustalStressManager(48), []);
  const particleSystem = useMemo(() => new CloudParticleSystem(500), []);

  // 8. View & UI State
  const [research, setResearch] = useState<ResearchConfig>({ ...DEFAULT_RESEARCH });
  const [isPlaying, setIsPlaying] = useState(true);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const closeKnowledge = useCallback(() => setKnowledgeOpen(false), []);
  const closePython = useCallback(() => setIsPythonModalOpen(false), []);
  const [viewMode, setViewMode] = useState<'2D' | '3D' | 'split'>('2D');
  const [renderMode, setRenderMode] = useState<RenderMode>('composite');
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>('magnitude');
  const [showNeutralPoints, setShowNeutralPoints] = useState<boolean>(true);
  const [streamlineDensity, setStreamlineDensity] = useState<number>(28);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibilityConfig>(DEFAULT_LAYER_VISIBILITY);

  const [activeControlTab, setActiveControlTab] = useState<'earth' | 'sources' | 'solar' | 'cloud' | 'aerosol' | 'moon' | 'stress' | 'presets' | 'weather'>('presets');
  const [isPythonModalOpen, setIsPythonModalOpen] = useState<boolean>(false);
  const [latestEarthquake, setLatestEarthquake] = useState<EarthquakeEvent | null>(null);
  const simulationViewportRef = useRef<HTMLDivElement | null>(null);
  const [isViewportFullscreen, setIsViewportFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsViewportFullscreen(document.fullscreenElement === simulationViewportRef.current);
      // Both canvas ResizeObserver and the Three.js container observer receive
      // the layout change; resize also covers browsers that delay that signal.
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleSimulationFullscreen = useCallback(async () => {
    setFullscreenError(null);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const viewport = simulationViewportRef.current;
      if (!viewport?.requestFullscreen) {
        setFullscreenError('이 브라우저는 전체 화면 API를 지원하지 않습니다.');
        return;
      }
      await viewport.requestFullscreen({ navigationUI: 'hide' });
    } catch (error) {
      console.error('Simulation fullscreen request failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
      });
      setFullscreenError('전체 화면을 시작하지 못했습니다. 브라우저 권한을 확인해 주세요.');
    }
  }, []);

  // Earthquake Event Handler
  const handleEarthquakeTriggered = useCallback((event: EarthquakeEvent) => {
    setLatestEarthquake(event);
    setTimeout(() => {
      setLatestEarthquake((prev) => (prev?.id === event.id ? null : prev));
    }, 6000);
  }, []);

  const clockState = useRef({ isPlaying, earthConfig, sources, solarWind, moonConfig, cloudConfig });
  clockState.current = { isPlaying, earthConfig, sources, solarWind, moonConfig, cloudConfig };
  useEffect(() => {
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(), dt = Math.min(0.2, (now-last)/1000); last=now;
      const state = clockState.current;
      if (!state.isPlaying || document.hidden) return;
      setMoonConfig(prev => advanceMoon(prev, dt));
      setSources(prev => {
        let changed = false;
        const next = prev.map(source => {
          const updated=advanceSource(source,state.earthConfig,dt);
          if(updated!==source)changed=true;
          return updated;
        });
        return changed ? next : prev;
      });
      if (!needsLogOnly({ earth:state.earthConfig, sources:state.sources, solar:state.solarWind, moon:state.moonConfig })) {
        particleSystem.update(state.cloudConfig, state.earthConfig, state.sources, state.solarWind, dt, now/1000);
        stressManager.update(state.earthConfig, state.sources, state.solarWind, dt, handleEarthquakeTriggered, state.moonConfig);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [particleSystem, stressManager, handleEarthquakeTriggered]);

  // Preset Scenario Applier
  const handleApplyPreset = (presetKey: string) => {
    if (presetKey === 'quiet') {
      setEarthConfig((prev) => ({ ...prev, moment: 1, tiltAngle: 0, reversed: false, x: 0, y: 0 }));
      setSources([]);
      setSolarWind((prev) => ({ ...prev, enabled: false }));
      setMoonConfig((prev) => ({ ...prev, enabled: true, phaseAngleDeg: 45, autoOrbit: true }));
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
        speedKmS: 700,
        densityCm3: 4.64,
        fieldVisualizationGain: DEFAULT_SOLAR_WIND.fieldVisualizationGain,
      });
      setMoonConfig((prev) => ({ ...prev, enabled: true, phaseAngleDeg: 180 }));
    } else if (presetKey === 'third_pole') {
      setEarthConfig((prev) => ({ ...prev, moment: 2.0, tiltAngle: -15, reversed: false, x: 0, y: 0 }));
      setSources([
        {
          id: 'ext-n',
          name: '가설 외부 쌍극자 A',
          type: 'dipole',
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
          name: '가설 외부 쌍극자 B',
          type: 'dipole',
          angle: 180,
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
      setSolarWind((prev) => ({
        ...prev,
        enabled: true,
        pressure: 1.2,
        imfBz: -0.5,
        speedKmS: 380,
        densityCm3: 4.97,
      }));
    } else if (presetKey === 'comet_approach') {
      // 혜성 근접 시뮬레이션 프리셋
      setEarthConfig((prev) => ({ ...prev, moment: 2.2, tiltAngle: 12, reversed: false, x: 0, y: 0 }));
      setSources([
        {
          id: 'comet-halley-type',
          name: '근접 외계 혜성 (Comet Nucleus)',
          type: 'comet',
          x: -2.8,
          y: 1.8,
          strength: 3.6,
          active: true,
          orbiting: true,
          orbitRadius: 3.3,
          orbitSpeed: 0.45,
          orbitPhase: 2.4,
          cometGasActivity: 3.5,
          cometTailLength: 3.8,
        },
      ]);
      setSolarWind({
        enabled: true,
        pressure: 1.8,
        imfBx: 0.4,
        imfBz: -1.2,
        speed: 1.6,
        density: 1.4,
        speedKmS: 500,
        densityCm3: 4.3,
        fieldVisualizationGain: DEFAULT_SOLAR_WIND.fieldVisualizationGain,
      });
      setCloudConfig((prev) => ({
        ...prev,
        enabled: true,
        showWaveClouds: true,
        polarizationSusceptibility: 1.6,
      }));
    } else if (presetKey === 'lunar_syzygy') {
      // 달 삭/망 조석 기조력 및 지각 공명 프리셋
      setEarthConfig((prev) => ({ ...prev, moment: 2.3, tiltAngle: 11, reversed: false, x: 0, y: 0 }));
      setSources([]);
      setSolarWind({
        enabled: true,
        pressure: 1.4,
        imfBx: 0.2,
        imfBz: -0.8,
        speed: 1.2,
        density: 1.2,
        speedKmS: 450,
        densityCm3: 4.13,
        fieldVisualizationGain: DEFAULT_SOLAR_WIND.fieldVisualizationGain,
      });
      setMoonConfig({
        ...DEFAULT_MOON_CONFIG,
        enabled: true,
        phaseAngleDeg: 180, // Full Moon entering magnetotail
        tidalStressWeight: 0.45,
        remanentMoment: 0,
        hypothesisDipoleEnabled: false,
        autoOrbit: true,
        orbitSpeed: 0.5,
      });
      // Prime near-rupture nodes
      stressManager.nodes[0].accumulatedStress = 0.81;
      stressManager.nodes[24].accumulatedStress = 0.83;
    } else if (presetKey === 'critical_earthquake') {
      setEarthConfig((prev) => ({ ...prev, moment: 2.8, tiltAngle: 25, reversed: false, x: 0, y: 0 }));
      setSources([
        {
          id: 'dense-pole',
          name: '집중 자기 교란원',
          type: 'dipole',
          angle: 180,
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

  // Full Simulation Reset Functionality (기본값 복원 및 외부 자극 완전 제거)
  const handleResetSimulation = useCallback(() => {
    setEarthConfig({ ...DEFAULT_EARTH_DIPOLE });
    setSources([]); // 모든 외부 자극원 제거
    setSolarWind({ ...DEFAULT_SOLAR_WIND }); // 외부 태양풍 자극 비활성화
    setMoonConfig({ ...DEFAULT_MOON_CONFIG }); // 달 정상 궤도 기본값 복원
    setCloudConfig(createDefaultCloudConfig());
    setWeatherData(GLOBAL_WEATHER_PRESETS[0].data); // 기본 대한민국 수원 기상데이터 복원

    // Crustal Stress Engine 초기화
    if (stressManager) {
      stressManager.initNodes();
      stressManager.earthquakes = [];
      stressManager.activeWaves = [];
    }

    // Particle System 초기화
    if (particleSystem) {
      particleSystem.init(500);
    }

    setResearch({ ...DEFAULT_RESEARCH });
    setIsPlaying(true);
    setLatestEarthquake(null);
    setRenderMode('composite');
    setHeatmapMetric('magnitude');
    setShowNeutralPoints(true);
    setLayerVisibility(DEFAULT_LAYER_VISIBILITY);
  }, [stressManager, particleSystem]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 antialiased">
      {/* Top Main Navigation Header - High Density */}
      <header className="h-14 px-3 md:px-5 bg-[#0f0f13]/95 backdrop-blur-md border-b border-[#1e1e24] flex items-center justify-between gap-3 sticky top-0 z-40">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#14141b] border border-[#22222e] text-cyan-400 shadow-sm flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="min-w-0 text-xs md:text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <span className="truncate">다극 자기장 상호작용 및 가상 지진운 시뮬레이션</span>
              <span className="hidden 2xl:inline-flex shrink-0 items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded bg-[#161622] text-cyan-400 border border-cyan-500/30 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Hypothesis / Control Engine
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono hidden xl:block truncate">
              Dipole Superposition · IMF Perturbation · Cloud Coupling Hypothesis · Synthetic Failure Index
            </p>
          </div>
        </div>

        {/* View Switchers & Export Actions */}
        <div className="flex shrink-0 items-center gap-1.5 xl:gap-2">
          <button onClick={() => setKnowledgeOpen(true)} className="rounded border border-cyan-800 px-2 py-1 text-xs text-cyan-200">용어·이론 해설</button>
          {/* Global Simulation Reset Button */}
          <button
            id="btn-global-reset-simulation"
            aria-label="시뮬레이션 전체 리셋"
            onClick={handleResetSimulation}
            title="시뮬레이션을 기본값으로 리셋하고 모든 외부 자극원을 제거합니다"
            className="px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden xl:inline">시뮬레이션 리셋</span>
          </button>

          {/* 2D / 3D / Split Switcher */}
          <div className="flex items-center p-0.5 bg-[#0a0a0e] rounded-md border border-[#1e1e24] text-xs font-medium">
            <button
              id="view-mode-2d"
              aria-pressed={viewMode === '2D'}
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
              aria-pressed={viewMode === '3D'}
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
              aria-pressed={viewMode === 'split'}
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
            aria-label="Python 수치 검증 열기"
            onClick={() => setIsPythonModalOpen(true)}
            className="px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xl:inline">Python 수치 검증</span>
          </button>
        </div>
      </header>

      {/* Main Grid Workspace - High Density */}
      <main className="flex-1 p-3 md:p-4 grid grid-cols-1 lg:grid-cols-12 lg:items-start gap-3.5 max-w-[1880px] w-full mx-auto">
        {/* Left / Center Viewport Column (Canvas 2D / 3D) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-3.5">
          {/* Main Visualizer Area */}
          <div
            ref={simulationViewportRef}
            data-testid="simulation-viewport"
            className={`relative w-full bg-[#0c0c10] overflow-hidden shadow-2xl shadow-black/80 ${
              isViewportFullscreen
                ? 'h-screen min-h-0 max-h-none rounded-none border-0'
                : 'h-[540px] md:h-[620px] lg:h-[calc(100vh-5.5rem)] lg:min-h-[32rem] lg:max-h-[620px] rounded-lg border border-[#1e1e24]'
            }`}
          >
            {viewMode === '2D' && (
              <SimulationCanvas2D
                research={research} isPlaying={isPlaying} setIsPlaying={setIsPlaying}
                key={`${cloudConfig.perspectiveMode ?? 'space_global'}:${cloudConfig.inspectionMode === 'split_3view' ? 'split' : 'canvas'}`}
                earthConfig={earthConfig}
                setEarthConfig={setEarthConfig}
                sources={sources}
                setSources={setSources}
                solarWind={solarWind}
                setSolarWind={setSolarWind}
                moonConfig={moonConfig}
                setMoonConfig={setMoonConfig}
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
                layerVisibility={layerVisibility}
                setLayerVisibility={setLayerVisibility}
              />
            )}

            {viewMode === '3D' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <Magnetosphere3DView
                  particleSystem={particleSystem} setLayerVisibility={setLayerVisibility}
                  research={research} moonConfig={moonConfig} isPlaying={isPlaying} setIsPlaying={setIsPlaying} layerVisibility={layerVisibility}
                  earthConfig={earthConfig}
                  sources={sources}
                  solarWind={solarWind}
                  cloudConfig={cloudConfig}
                />
              </Suspense>
            )}

            {viewMode === 'split' && (
              <div className="grid grid-cols-2 gap-2 h-full bg-[#0a0a0c]">
                <SimulationCanvas2D
                  research={research} isPlaying={isPlaying} setIsPlaying={setIsPlaying}
                  key={`split:${cloudConfig.perspectiveMode ?? 'space_global'}:${cloudConfig.inspectionMode === 'split_3view' ? 'split' : 'canvas'}`}
                  earthConfig={earthConfig}
                  setEarthConfig={setEarthConfig}
                  sources={sources}
                  setSources={setSources}
                  solarWind={solarWind}
                  setSolarWind={setSolarWind}
                  moonConfig={moonConfig}
                  setMoonConfig={setMoonConfig}
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
                  layerVisibility={layerVisibility}
                  setLayerVisibility={setLayerVisibility}
                />
                <Suspense fallback={<ViewLoadingFallback />}>
                  <Magnetosphere3DView
                    particleSystem={particleSystem} setLayerVisibility={setLayerVisibility}
                    research={research} moonConfig={moonConfig} isPlaying={isPlaying} setIsPlaying={setIsPlaying} layerVisibility={layerVisibility}
                    earthConfig={earthConfig}
                    sources={sources}
                    solarWind={solarWind}
                    cloudConfig={cloudConfig}
                  />
                </Suspense>
              </div>
            )}

            <button
              id="btn-simulation-fullscreen"
              type="button"
              aria-label={isViewportFullscreen ? '시뮬레이션 전체 화면 종료' : '시뮬레이션만 전체 화면으로 보기'}
              aria-pressed={isViewportFullscreen}
              onClick={toggleSimulationFullscreen}
              title={isViewportFullscreen ? '전체 화면 종료 (Esc)' : '시뮬레이션 화면만 전체 화면으로 표시'}
              className="absolute bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-md border border-cyan-500/35 bg-[#0b1118]/90 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-cyan-200 shadow-xl backdrop-blur-md transition-colors hover:bg-cyan-950/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              {isViewportFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span>{isViewportFullscreen ? '전체 화면 종료' : '전체 화면'}</span>
            </button>

            {fullscreenError && (
              <div role="alert" className="absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded border border-red-500/50 bg-red-950/90 px-3 py-1.5 text-xs text-red-200 shadow-xl">
                {fullscreenError}
              </div>
            )}
          </div>

          {/* Mathematical Formulations Reference Card */}
          <MathFormulaCard />
        </div>

        {/* Right Sidebar: Physics Control Deck */}
        <aside aria-label="시뮬레이션 조건" className="lg:col-span-5 xl:col-span-4 flex min-h-0 flex-col gap-3.5 lg:sticky lg:top-[4.5rem]">
          {/* Controls Deck */}
          <PhysicsControls
            research={research} setResearch={setResearch}
            earthConfig={earthConfig}
            setEarthConfig={setEarthConfig}
            sources={sources}
            setSources={setSources}
            solarWind={solarWind}
            setSolarWind={setSolarWind}
            moonConfig={moonConfig}
            setMoonConfig={setMoonConfig}
            cloudConfig={cloudConfig}
            setCloudConfig={setCloudConfig}
            stressManager={stressManager}
            weatherData={weatherData}
            setWeatherData={setWeatherData}
            onEarthquakeTriggered={handleEarthquakeTriggered}
            onApplyPreset={handleApplyPreset}
            onResetSimulation={handleResetSimulation}
            activeTab={activeControlTab}
            setActiveTab={setActiveControlTab}
          />
        </aside>
      </main>

      {/* Real-time Earthquake Alert Toast Banner */}
      {latestEarthquake && (
        <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 p-3.5 bg-[#140a0c]/95 backdrop-blur-md rounded-lg border border-red-500/60 shadow-2xl shadow-black text-slate-200 flex items-center gap-3 animate-in slide-in-from-bottom duration-300 max-w-md">
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
              단층 노드 #{latestEarthquake.nodeIndex}의 합성 실패지수가 임계값을 넘어 가상 파열 및 P/S 파동이 생성되었습니다.
            </p>
          </div>
        </div>
      )}

      {knowledgeOpen && <KnowledgePage onClose={closeKnowledge} />}
      {/* Python Numerical Code Export Modal */}
      {isPythonModalOpen && (
        <Suspense fallback={null}>
          <NumericalVerificationModal
            isOpen={isPythonModalOpen}
            onClose={closePython}
            earthConfig={earthConfig}
            sources={sources}
            solarWind={solarWind}
            cloudConfig={cloudConfig}
            moonConfig={moonConfig}
            research={research}
          />
        </Suspense>
      )}
    </div>
  );
}
