import React, { useState } from 'react';
import {
  Layers,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Sparkles,
  RotateCcw,
  CheckSquare,
  Square,
  Globe,
  Compass,
  Zap,
  Activity,
  Wind,
  Cloud,
  Waves,
  Radio,
  Crosshair,
  Grid,
  Info,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { LayerVisibilityConfig, VisualElementGuideItem } from '../types';

export const VISUAL_ELEMENTS_DATA: VisualElementGuideItem[] = [
  {
    id: 'earthBody',
    category: 'core',
    name: '지구 본체 및 대기 헤일로',
    badge: 'Earth Body & Atmosphere Halo',
    color: '#38bdf8',
    formulaSymbol: 'R_E, \\text{Atmosphere}',
    summary: '지구 구체 및 열권·중간권 대기 광륜',
    physicsDescription:
      '지구 자기장(쌍극자 모멘트)의 원점이자 전자기 유도 전류가 지각으로 침투하는 중심 행성체입니다. 외곽의 청록색 광륜은 열권 및 전리층(Ionosphere) 대기층을 나타내며, 하전 입자들의 1차 이온화 층입니다.',
  },
  {
    id: 'dipoleAxis',
    category: 'core',
    name: '자기 쌍극자 축 & N/S 자극',
    badge: 'Magnetic Dipole Axis (N/S)',
    color: '#ef4444',
    formulaSymbol: '\\mathbf{m}_E, \\theta_{\\text{tilt}}',
    summary: '지자기 자축 경사각 및 지자기 북극(N)/남극(S) 마커',
    physicsDescription:
      '지구 자전축 대비 기울어진 지자기 모멘트 벡터 축(기본 약 11.5° 경사)입니다. 적색 마커는 지자기 북극(N극, 자기력선 발산), 청색 마커는 지자기 남극(S극, 자기력선 수렴)을 표시하며, 지자기 역전 시 극성이 반전됩니다.',
  },
  {
    id: 'crustalNodes',
    category: 'core',
    name: '지각 단층 응력 노드 & 고응력 점멸',
    badge: 'Crustal Fault Stress Nodes',
    color: '#22c55e',
    formulaSymbol: '\\sigma_i, \\sigma_{\\text{crit}}',
    summary: '지구 표면 48개 단층 분절의 응력 축적 상태',
    physicsDescription:
      '지각 단층면의 국소 전단 응력(Shear Stress)을 48개 노드로 분할 시뮬레이션합니다. 안전(녹색) → 주의(황색) → 임계(적색 점멸)로 전이되며, 주변 자기장 간섭률 및 유도 기전력(EMF)에 의해 응력 누적이 가속되어 파쇄(지진)를 유발합니다.',
  },
  {
    id: 'streamlines',
    category: 'field',
    name: 'RK4 자기력선 & 에너지 펄스',
    badge: 'RK4 Magnetic Streamlines',
    color: '#67e8f9',
    formulaSymbol: '\\frac{d\\mathbf{r}}{ds} = \\frac{\\mathbf{B}}{|\\mathbf{B}|}',
    summary: '4차 룬게-쿠타 적분 자기력선 및 흐름 펄스',
    physicsDescription:
      '지구 쌍극자, 외부 다극자, 태양풍 IMF의 벡터 합성 자기장 공간에서 4차 룬게-쿠타(RK4) 정밀 수치 적분으로 추적한 자기력선입니다. 선 위를 달리는 청록색 펄스는 국소 자기장 세기에 비례하는 플럭스 밀도와 에너지 흐름 방향을 나타냅니다.',
  },
  {
    id: 'neutralPoints',
    category: 'field',
    name: '자기 재결합 중성점 (X-Point)',
    badge: 'Magnetic Reconnection X-Point',
    color: '#ec4899',
    formulaSymbol: '|\\mathbf{B}_{\\text{total}}| \\to 0',
    summary: '자기장이 0에 수렴하여 재결합이 일어나는 Null-Point',
    physicsDescription:
      '서로 반대 방향의 자기력선이 충돌하여 상쇄되는 자기 중성점(Null-Point)입니다. 이곳에서는 이상 저항(Anomalous Resistivity)과 자기 에너지의 폭발적 플라즈마 운동 에너지 변환(Magnetic Reconnection)이 발생하며 핑크색 교차 링(X-Point)으로 표시됩니다.',
  },
  {
    id: 'externalSources',
    category: 'field',
    name: '외부 자기원 (합성 극 프록시/쌍극자/혜성)',
    badge: 'External Magnetic Sources & Comet',
    color: '#a855f7',
    formulaSymbol: '\\mathbf{B}_{\\text{ext}}, q_m, \\mathbf{B}_{\\text{comet}}',
    summary: '지구 근방을 통과하는 행성간 천체, 혜성 및 인공 자기원',
    physicsDescription:
      '접근하는 강한 자화 천체, 혜성(이온 꼬리 자기장 드레이핑 및 충격파 공동), 행성간 자기 이상체를 모사합니다. 적색(N극), 청색(S극), 보라색(쌍극자), 에메랄드(혜성)로 표시되며 드래그로 이동하거나 궤도 공전시킬 수 있습니다.',
  },
  {
    id: 'moonBody',
    category: 'core',
    name: '지구 자연 위성 (달 Moon)',
    badge: 'Moon Satellite & Crustal Dipole',
    color: '#e2e8f0',
    formulaSymbol: 'R_{\\text{Moon}}, \\mathbf{m}_{\\text{crust}}',
    summary: '달 본체 구체 및 국소 지각 잔류 자기 모멘트',
    physicsDescription:
      '지구의 자연 위성인 달(반경 ~1,737km, 지구 반경의 약 27%)을 모사합니다. 달 자체의 고유 다이나모는 없으나 국소 지각 잔류 자기장(Lunar Swirl Remanent Dipole) 및 태양풍 플라즈마 후류 공동(Downstream Wake Cavity)을 형성합니다.',
  },
  {
    id: 'moonOrbit',
    category: 'core',
    name: '달 공전 궤도 및 위상 (Orbit & Phase)',
    badge: 'Lunar Orbit Ring (R_EM)',
    color: '#94a3b8',
    formulaSymbol: 'd_{EM} \\approx 60.3R_E \\approx 384,400\\text{km}, T = 27.3\\text{d}',
    summary: '달의 공전 궤도 원 및 삭-상현-망-하현 위상각',
    physicsDescription:
      '지구 중심을 기준으로 한 달의 공전 궤도 경로(원형 궤도선)입니다. 지구 자기권 꼬리(Magnetotail) 통과 여부 및 태양과의 상대적 각도(위상각 θ_M)에 따른 시뮬레이션 환경을 시각화합니다.',
  },
  {
    id: 'lunarTideBulge',
    category: 'core',
    name: '달 기조력 조석 팽창 타원 (Tidal Bulge)',
    badge: 'Solid Earth Tidal Bulge',
    color: '#38bdf8',
    formulaSymbol: '\\Delta \\sigma_{\\text{tide}} \\propto \\frac{G M_M}{R^3} \\cos(2\\Delta\\theta)',
    summary: '달의 차등 중력에 의한 고체 지구 조석 변형 타원',
    physicsDescription:
      '달의 인력에 의해 발생하는 고체 지구(Solid Earth)의 조석 팽창 타원체입니다. 대향측(Antipodal)과 직하점(Sublunar) 방향으로 지각 인장/압축 응력이 집중되어 지진 단층 파쇄를 주기적으로 변조합니다.',
  },
  {
    id: 'solarWind',
    category: 'atmosphere',
    name: '태양풍 플라즈마 & IMF 유선',
    badge: 'Solar Wind & IMF Flow',
    color: '#fbbf24',
    formulaSymbol: 'P_{\\text{dyn}} = \\rho v_{\\text{sw}}^2, \\mathbf{B}_{\\text{IMF}}',
    summary: '태양에서 유입되는 초음속 이온류 및 행성간 자기장',
    physicsDescription:
      '태양에서 초속 400~800km/s로 분출되는 하전 입자류입니다. 주간면(좌측) 자기권을 강하게 압축(Chapman-Ferraro 전류 형성)하고, 황금색 이온 입자 및 유입 화살표로 공간 전파 경로를 시각화합니다.',
  },
  {
    id: 'cloudParticles',
    category: 'atmosphere',
    name: '대기 에어로졸 입자 & 극화 바늘',
    badge: 'Aerosol Droplets & Polarized Needles',
    color: '#e0f2fe',
    formulaSymbol: '\\mathbf{p} = \\alpha \\mathbf{B}_{\\text{loc}}, \\theta_p',
    summary: '하전 대기 입자 및 지자기 방향 편광 정렬 바늘',
    physicsDescription:
      '대기 중에 부유하는 미세 하전 물방울과 에어로졸 입자입니다. 국소 자기장 벡터에 의해 유도 전기쌍극자 모멘트가 형성되어 입자 중심의 미세 백색 바늘(Needle)이 자기력선 방향으로 정렬됩니다 (가상 지진운의 미시적 기전).',
  },
  {
    id: 'cloudBands',
    category: 'atmosphere',
    name: '결맞음 구름 띠 (Coherent Cloud Bands)',
    badge: 'Coherent Cloud Ridge Bands',
    color: '#93c5fd',
    formulaSymbol: '\\text{Ridge}(p_i, p_j)',
    summary: '인접 정렬 입자들이 자기력선을 따라 형성하는 구름 띠',
    physicsDescription:
      '인접한 하전 입자들의 극화 정렬 각도가 높은 결맞음(Coherence)을 보일 때, 자기력선 궤적을 따라 형성되는 선형 응결 띠입니다. 푸른빛이 감도는 수증기 띠 형태로 시각화됩니다.',
  },
  {
    id: 'waveClouds',
    category: 'atmosphere',
    name: '국소 정렬 양떼구름 (Wave Cloud Hotspot)',
    badge: 'Altocumulus Wave Cloud Hotspots',
    color: '#38bdf8',
    formulaSymbol: 'I(x,y) > I_{\\text{th}}, \\lambda_{\\text{wave}}',
    summary: '전자기 간섭 핫스팟에서 자기장에 수직으로 형성되는 파동운',
    physicsDescription:
      '지구 자기장과 외부 자기원의 간섭 강도 I(x,y)가 임계치를 초과하는 핫스팟에서, 자기장 벡터에 직교하는 방향으로 형성되는 주기적 파동 구름(Altocumulus Billows)입니다. 방사형 퍼프와 직교 파면 리지로 표현됩니다.',
  },
  {
    id: 'seismicWaves',
    category: 'event',
    name: '지진 전파 충격파 (P파 / S파)',
    badge: 'Seismic Shockwaves (P/S Waves)',
    color: '#f97316',
    formulaSymbol: 'v_P \\approx 6.0\\text{km/s}, v_S \\approx 3.5\\text{km/s}',
    summary: '단층 파쇄 시 진원에서 방사되는 지진 탄성파 파면',
    physicsDescription:
      '지각 응력 파쇄 시 진원(Epicenter)에서 발생하여 사방으로 전파되는 지진 종파(적색 P파, 압축파) 및 횡파(주황색 S파, 전단파)의 팽창 동심원 파면입니다.',
  },
  {
    id: 'heatmap',
    category: 'field',
    name: '2D 자기장 스칼라 히트맵 배경',
    badge: '2D Field Scalar Heatmap',
    color: '#a855f7',
    formulaSymbol: '|\\mathbf{B}|, \\nabla|\\mathbf{B}|, P_{\\text{mag}}, I(x,y)',
    summary: '공간 자기장 세기, 기울기, 자기압, 간섭도의 격자 컬러맵',
    physicsDescription:
      '전체 시뮬레이션 영역을 2D 격자로 샘플링하여 선택된 물리 지표(자기장 크기, 자기압 B²/2, 공간 기울기, 간섭도, 파동운 밀도)의 공간 분포를 부드러운 컬러 그라디언트로 표시합니다.',
  },
  {
    id: 'gridAxes',
    category: 'system',
    name: '좌표 격자망 & 중심축',
    badge: 'Coordinate Grid & Origin Axes',
    color: '#64748b',
    formulaSymbol: '(x, y) \\in [-6, 6] R_E',
    summary: '지구 중심 기준 공간 거리(지구 반지름 R_E) 격자 및 원점축',
    physicsDescription:
      '지구 중심 (0,0)을 기준으로 지구 반지름 단위(R_E)의 공간 스케일 직교 좌표망과 십자 중심축을 표시하여 천체 및 장의 위치 관계를 정량적으로 파악할 수 있습니다.',
  },
  {
    id: 'probeMarker',
    category: 'system',
    name: '우클릭 정밀 프로브 마커 & 타겟',
    badge: 'Right-Click Vector Probe Target',
    color: '#22d3ee',
    formulaSymbol: '\\mathbf{B}(x_0, y_0), \\nabla|\\mathbf{B}|, M(x,y)',
    summary: '사용자가 우클릭한 측정 지점의 십자선 조준선 및 데이터 카드',
    physicsDescription:
      '캔버스 위를 마우스 우클릭했을 때 생성되는 실시간 프로브 타겟입니다. 해당 지점의 2D 자기장 벡터 성분, 공간 미분량, 전자기 간섭도, 파동운 마스크 확률 등을 정밀 측정합니다.',
  },
];

export const DEFAULT_LAYER_VISIBILITY: LayerVisibilityConfig = {
  earthBody: true,
  dipoleAxis: true,
  crustalNodes: true,
  streamlines: true,
  solarWind: true,
  neutralPoints: true,
  externalSources: true,
  moonBody: true,
  moonOrbit: true,
  lunarTideBulge: true,
  cloudParticles: true,
  cloudBands: true,
  waveClouds: true,
  seismicWaves: true,
  gridAxes: true,
  heatmap: true,
  probeMarker: true,
};

interface VisualElementsGuidePanelProps {
  layerVisibility: LayerVisibilityConfig;
  setLayerVisibility: React.Dispatch<React.SetStateAction<LayerVisibilityConfig>>;
  defaultExpanded?: boolean;
}

export const VisualElementsGuidePanel: React.FC<VisualElementsGuidePanelProps> = ({
  layerVisibility,
  setLayerVisibility,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeCount = Object.values(layerVisibility).filter(Boolean).length;
  const totalCount = Object.keys(layerVisibility).length;

  const toggleLayer = (key: keyof LayerVisibilityConfig) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleShowAll = () => {
    setLayerVisibility({
      earthBody: true,
      dipoleAxis: true,
      crustalNodes: true,
      streamlines: true,
      solarWind: true,
      neutralPoints: true,
      externalSources: true,
      moonBody: true,
      moonOrbit: true,
      lunarTideBulge: true,
      cloudParticles: true,
      cloudBands: true,
      waveClouds: true,
      seismicWaves: true,
      gridAxes: true,
      heatmap: true,
      probeMarker: true,
    });
  };

  const handleHideAll = () => {
    setLayerVisibility({
      earthBody: false,
      dipoleAxis: false,
      crustalNodes: false,
      streamlines: false,
      solarWind: false,
      neutralPoints: false,
      externalSources: false,
      moonBody: false,
      moonOrbit: false,
      lunarTideBulge: false,
      cloudParticles: false,
      cloudBands: false,
      waveClouds: false,
      seismicWaves: false,
      gridAxes: false,
      heatmap: false,
      probeMarker: false,
    });
  };

  const handleResetDefaults = () => {
    setLayerVisibility(DEFAULT_LAYER_VISIBILITY);
  };

  const filteredItems = VISUAL_ELEMENTS_DATA.filter((item) => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.badge.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'core':
        return <Globe className="w-3.5 h-3.5 text-cyan-400" />;
      case 'field':
        return <Zap className="w-3.5 h-3.5 text-pink-400" />;
      case 'atmosphere':
        return <Cloud className="w-3.5 h-3.5 text-sky-400" />;
      case 'event':
        return <Activity className="w-3.5 h-3.5 text-orange-400" />;
      case 'system':
        return <Grid className="w-3.5 h-3.5 text-slate-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  return (
    <div className="relative z-20">
      {/* Collapsed Bar / Trigger Pill */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#0f0f15]/95 hover:bg-[#161622] text-slate-200 hover:text-white rounded-lg border border-[#252535] hover:border-cyan-500/50 shadow-xl backdrop-blur-md transition-all text-xs group"
          title="화면 시각화 요소 가이드 및 레이어 표시/숨김 패널 열기"
        >
          <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
            <Layers className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform" />
            <span>화면 시각 요소 가이드 & 레이어</span>
          </div>
          <span className="px-1.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 font-mono text-[10px]">
            {activeCount}/{totalCount} 표시 중
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-0.5 ml-1">
            펼치기 <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:translate-y-0.5 transition-transform" />
          </span>
        </button>
      ) : (
        /* Expanded Floating Guide & Layer Panel */
        <div className="w-full max-w-[480px] bg-[#0c0c12]/98 backdrop-blur-xl border border-[#262638] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh] transition-all animate-in fade-in zoom-in-95 duration-200">
          {/* Header Bar with Fold Button */}
          <div className="p-3 bg-gradient-to-r from-[#12121c] via-[#161626] to-[#12121c] border-b border-[#222234] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <span>시각화 요소 해설 및 레이어 제어</span>
                  <span className="px-1.5 py-0.2 bg-cyan-950/70 border border-cyan-700/40 text-cyan-300 text-[10px] rounded font-mono">
                    {activeCount}/{totalCount} ON
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  화면의 모든 물리 요소를 이해하고 개별적으로 켜거나 숨깁니다.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1 px-2 py-1 text-slate-300 hover:text-white bg-[#1a1a28] hover:bg-[#252538] rounded-md border border-[#2e2e42] transition-colors text-[11px]"
              title="패널 접기"
            >
              <span>접기</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Batch Controls & Search */}
          <div className="p-2.5 bg-[#0f0f18] border-b border-[#1f1f2e] flex flex-wrap items-center justify-between gap-2 text-[11px]">
            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleShowAll}
                className="px-2 py-1 bg-[#181826] hover:bg-[#222236] text-emerald-400 hover:text-emerald-300 rounded border border-emerald-900/40 hover:border-emerald-700/60 transition-colors flex items-center gap-1"
                title="모든 요소 화면에 표시"
              >
                <CheckSquare className="w-3 h-3" />
                <span>전체 켜기</span>
              </button>
              <button
                onClick={handleHideAll}
                className="px-2 py-1 bg-[#181826] hover:bg-[#222236] text-rose-400 hover:text-rose-300 rounded border border-rose-900/40 hover:border-rose-700/60 transition-colors flex items-center gap-1"
                title="모든 요소 화면에서 숨김"
              >
                <Square className="w-3 h-3" />
                <span>전체 숨김</span>
              </button>
              <button
                onClick={handleResetDefaults}
                className="px-2 py-1 bg-[#181826] hover:bg-[#222236] text-slate-300 hover:text-white rounded border border-[#2a2a3e] transition-colors flex items-center gap-1"
                title="기본 설정으로 복원"
              >
                <RotateCcw className="w-3 h-3" />
                <span>초기화</span>
              </button>
            </div>

            {/* Filter Search Input */}
            <div className="relative flex-1 min-w-[140px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="요소 검색 (예: X-Point, 지진운...)"
                className="w-full bg-[#141420] border border-[#26263a] rounded px-2.5 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="px-2.5 pt-2 pb-1.5 bg-[#0e0e16] border-b border-[#1b1b28] flex items-center gap-1 overflow-x-auto scrollbar-none text-[11px]">
            {[
              { id: 'all', label: '전체' },
              { id: 'core', label: '지구·단층' },
              { id: 'field', label: '자기장·재결합' },
              { id: 'atmosphere', label: '대기·지진운' },
              { id: 'event', label: '지진·충격파' },
              { id: 'system', label: '좌표·프로브' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#161622]'
                }`}
              >
                {getCategoryIcon(cat.id)}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Element Cards List (Scrollable) */}
          <div className="p-2.5 overflow-y-auto space-y-2 max-h-[52vh] scrollbar-thin scrollbar-thumb-[#252538]">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                검색 조건에 맞는 시각화 요소가 없습니다.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isVisible = layerVisibility[item.id];
                const isDetailOpen = expandedItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border transition-all duration-150 ${
                      isVisible
                        ? 'bg-[#12121c]/90 border-[#26263a] hover:border-[#3b3b55]'
                        : 'bg-[#0d0d14]/60 border-[#1c1c28] opacity-60'
                    }`}
                  >
                    {/* Item Main Row */}
                    <div className="p-2.5 flex items-center justify-between gap-2.5">
                      {/* Left: Color indicator + Titles */}
                      <div
                        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none"
                        onClick={() => setExpandedItemId(isDetailOpen ? null : item.id)}
                      >
                        {/* Dot indicator */}
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: item.color }}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs font-semibold ${isVisible ? 'text-slate-100' : 'text-slate-400 line-through'}`}>
                              {item.name}
                            </span>
                            {item.formulaSymbol && (
                              <span className="text-[10px] font-mono text-cyan-400/90 bg-[#161626] px-1.5 py-0.2 rounded border border-[#222236]">
                                ${item.formulaSymbol}$
                              </span>
                            )}
                          </div>
                          <p className="text-[10.5px] text-slate-400 truncate mt-0.5">
                            {item.summary}
                          </p>
                        </div>
                      </div>

                      {/* Right: Detail button & ON/OFF Toggle Switch */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => setExpandedItemId(isDetailOpen ? null : item.id)}
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2e] rounded transition-colors"
                          title="상세 물리 원리 보기"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => toggleLayer(item.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                            isVisible
                              ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm shadow-cyan-900/50'
                              : 'bg-[#1a1a26] hover:bg-[#252538] text-slate-500 border border-[#2c2c3e]'
                          }`}
                          title={isVisible ? '화면에서 숨기기' : '화면에 표시하기'}
                        >
                          {isVisible ? (
                            <>
                              <Eye className="w-3.5 h-3.5 text-white" />
                              <span>표시</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                              <span>숨김</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Detailed Physics Explanation Accordion */}
                    {isDetailOpen && (
                      <div className="px-3 pb-3 pt-1 border-t border-[#1e1e2d] bg-[#0f0f18]/90 text-[11px] text-slate-300 animate-in fade-in duration-150">
                        <div className="p-2 bg-[#141422] rounded border border-[#242438] mt-1 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-[#202032] pb-1 font-mono">
                            <span className="text-cyan-400 font-semibold">{item.badge}</span>
                            <span>카테고리: {item.category}</span>
                          </div>
                          <p className="text-slate-300 leading-relaxed text-[11px]">
                            {item.physicsDescription}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="p-2.5 bg-[#0d0d14] border-t border-[#1e1e2c] flex items-center justify-between text-[10px] text-slate-500">
            <span>💡 요소를 클릭하여 상세 물리 이론을 확인하세요.</span>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-cyan-400 hover:underline flex items-center gap-0.5"
            >
              닫기 <ChevronUp className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
