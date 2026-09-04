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
    "id": "earthBody",
    "category": "core",
    "name": "지구 본체 및 대기 헤일로",
    "badge": "earthBody",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "지구 반경과 설명용 대기 광륜",
    "physicsDescription": "1 R_E=6,371 km. 광륜 두께는 실제 대기층 경계가 아니다. 구름 위치는 별도의 고도 설정을 따른다."
  },
  {
    "id": "dipoleAxis",
    "category": "core",
    "name": "자기 쌍극자 축 & N/S 자극",
    "badge": "dipoleAxis",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "모델의 자기 모멘트 방향",
    "physicsDescription": "N/S는 모델 자극의 방향이며 지리적 북극/남극과 구분한다. 지구 모멘트와 경사로 계산한다."
  },
  {
    "id": "crustalNodes",
    "category": "core",
    "name": "가설: 지각 단층 응력 노드",
    "badge": "crustalNodes",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "합성 단층 실패지수",
    "physicsDescription": "반드시 가설: 판구조 하중과 가역적 조석·선택적 자기 결합을 비교하는 합성 노드다. 실제 단층 관측이나 지진 예측 결과가 아니다."
  },
  {
    "id": "streamlines",
    "category": "field",
    "name": "RK4 자기력선 & 표시 펄스",
    "badge": "streamlines",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "공유 3D 벡터장 적분 곡선",
    "physicsDescription": "dr/ds=B/|B|를 RK4로 적분한다. 색은 고정 로그 nT 눈금. 움직이는 점은 방향 설명이며 실제 에너지·입자 수송 해가 아니다."
  },
  {
    "id": "neutralPoints",
    "category": "field",
    "name": "자기 중성점 후보 (X-Point)",
    "badge": "neutralPoints",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "작은 합성장을 찾는 수치 진단",
    "physicsDescription": "|B|가 작다는 사실만으로 자기 재결합이 증명되지 않는다. 이 앱은 저항성 MHD나 재결합률을 계산하지 않는다."
  },
  {
    "id": "externalSources",
    "category": "field",
    "name": "외부 자기원 (쌍극자/균일장/가설)",
    "badge": "externalSources",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "외부 벡터장과 자기원 표시",
    "physicsDescription": "쌍극자는 N/S 한 쌍이며 각도·자체 회전·공전이 가능하다. 균일장은 국소 근사. 반드시 가설: 독립 단극자와 혜성 프록시는 관측 천체의 정밀 재현이 아니다."
  },
  {
    "id": "moonBody",
    "category": "core",
    "name": "지구 자연 위성 (달 Moon)",
    "badge": "moonBody",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "달 본체와 동주기 자전",
    "physicsDescription": "현재 달에는 지구와 같은 전역 자기장이 없다. 기본 자기 결합은 OFF. 반드시 가설: 선택한 달 전역 쌍극자는 국소 지각장을 대신하는 검증된 모델이 아니다."
  },
  {
    "id": "moonOrbit",
    "category": "core",
    "name": "달 공전 궤도 및 위상",
    "badge": "moonOrbit",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "기본 거리 60.3 R_E의 원궤도",
    "physicsDescription": "공전주기 27.3일, 1초당 진행 일수로 시각화 시간을 조절한다. 실제 궤도 이심률·기울기·태양 운동은 생략한 근사다."
  },
  {
    "id": "lunarTideBulge",
    "category": "core",
    "name": "조석 변형 설명도",
    "badge": "lunarTideBulge",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "고체 지구 조석의 확대 표시",
    "physicsDescription": "반드시 가설: 모델 단층 응력의 가역 섭동을 비교한다. 타원은 실제 변형 크기가 아니고 파열 시점의 예측이 아니다."
  },
  {
    "id": "solarWind",
    "category": "atmosphere",
    "name": "태양풍 · IMF · 자기권계면",
    "badge": "solarWind",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "동압과 Shue 경험적 경계",
    "physicsDescription": "IMF nT에 시각적 배율을 곱하지 않는다. Shue 경계는 태양풍 조건의 별도 경험식이며 임의 외부 자기원에 대한 완전한 자기권 응답은 아니다."
  },
  {
    "id": "cloudParticles",
    "category": "atmosphere",
    "name": "가설: 대기 입자 & 정렬 바늘",
    "badge": "cloudParticles",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "지정 고도층의 공유 입자 단면",
    "physicsDescription": "반드시 가설: 정렬 바늘은 가정한 방향 반응이다. 자기장이 전기 쌍극자를 직접 만든다고 가정하지 않는다. 3D도 동일한 z=0 입자를 표시하며 분자·이온을 개별 추적하지 않는다."
  },
  {
    "id": "cloudBands",
    "category": "atmosphere",
    "name": "기상 구름층 기준선",
    "badge": "cloudBands",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "지정 고도층의 구름 프록시",
    "physicsDescription": "기상·습도에 따른 설명용 구름 점수. 기본 12±1.5 km의 지정 층이며 입자의 자발적 구름 생성이나 실측 영상이 아니다."
  },
  {
    "id": "waveClouds",
    "category": "atmosphere",
    "name": "가설: 주기적 구름 패턴",
    "badge": "waveClouds",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "외부장 결합을 가정한 파동 무늬",
    "physicsDescription": "반드시 가설: cos 위상과 파장을 부여한 패턴이다. 입자 정렬만으로 이 무늬가 필연적으로 생긴다는 증거가 아니다. 고도·표시 배율은 2D/3D에 함께 적용한다."
  },
  {
    "id": "seismicWaves",
    "category": "event",
    "name": "가설: 파열 파면 표시",
    "badge": "seismicWaves",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "합성 사건의 확대 애니메이션",
    "physicsDescription": "반드시 가설: 가상 파열 위치에서 확장하는 설명용 원이다. 실제 지층의 P/S파 전파나 지진 도달 시각을 풀지 않는다."
  },
  {
    "id": "heatmap",
    "category": "field",
    "name": "2D 자기장 진단 히트맵",
    "badge": "heatmap",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "선택한 스칼라 지표의 비교 지도",
    "physicsDescription": "자기압은 B²/(2μ₀), 간섭 지수는 무차원이다. 초대형·극한 입력에서는 일반 수치 진단을 중단한다. 색 밝기 자체가 물리 단위는 아니다."
  },
  {
    "id": "gridAxes",
    "category": "system",
    "name": "거리 눈금 · 좌표 격자",
    "badge": "gridAxes",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "지구 중심 거리 R_E / km",
    "physicsDescription": "거리 원과 눈금은 지구 중심 기준. 지표 고도와 중심 거리를 구분한다. 3D 원은 z=0 단면의 눈금이다."
  },
  {
    "id": "probeMarker",
    "category": "system",
    "name": "우클릭 프로브 · 중심 거리",
    "badge": "probeMarker",
    "color": "#67e8f9",
    "formulaSymbol": "",
    "summary": "선택 위치의 진단과 거리",
    "physicsDescription": "2D는 선택 좌표의 장을 계산한다. 3D는 시선과 z=0 단면 교점의 거리를 측정하며 구체 표면의 자동 측정은 아니다."
  }
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
  supportedLayers?: Array<keyof LayerVisibilityConfig>;
}

export const VisualElementsGuidePanel: React.FC<VisualElementsGuidePanelProps> = ({
  layerVisibility,
  setLayerVisibility,
  defaultExpanded = false,
  supportedLayers = Object.keys(DEFAULT_LAYER_VISIBILITY) as Array<keyof LayerVisibilityConfig>,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeCount = supportedLayers.filter(key=>layerVisibility[key]).length;
  const totalCount = supportedLayers.length;

  const toggleLayer = (key: keyof LayerVisibilityConfig) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const setAll=(value:boolean)=>setLayerVisibility(prev=>({...prev,...Object.fromEntries(supportedLayers.map(key=>[key,value]))}));
  const handleShowAll=()=>setAll(true);
  const handleHideAll=()=>setAll(false);
  const handleResetDefaults=()=>setLayerVisibility(prev=>({...prev,...Object.fromEntries(supportedLayers.map(key=>[key,DEFAULT_LAYER_VISIBILITY[key]]))}));

  const filteredItems = VISUAL_ELEMENTS_DATA.filter((item) => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.badge.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return supportedLayers.includes(item.id) && matchesCat && matchesSearch;
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
          aria-expanded={false}
          onClick={() => setIsExpanded(true)}
          className="flex max-w-full flex-wrap items-center gap-2 px-3 py-1.5 bg-[#0f0f15]/95 hover:bg-[#161622] text-slate-200 hover:text-white rounded-lg border border-[#252535] hover:border-cyan-500/50 shadow-xl backdrop-blur-md transition-all text-xs group"
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
        <div className="w-full max-w-[480px] bg-[#0c0c12]/98 backdrop-blur-xl border border-[#262638] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[min(70vh,450px)] transition-all animate-in fade-in zoom-in-95 duration-200">
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
