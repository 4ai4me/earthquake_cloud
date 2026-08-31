import React, { useState, useRef, useEffect } from 'react';
import { AIAnalysisMessage, EarthDipoleConfig, ExternalMagneticSource, SolarWindConfig } from '../types';
import { LatexRenderer } from './MathFormulaCard';
import {
  Bot,
  Send,
  Sparkles,
  Brain,
  Zap,
  RotateCcw,
  User,
  Copy,
  Check,
  ChevronDown,
  Layers,
  Flame,
} from 'lucide-react';

interface GeminiExpertAssistantProps {
  earthConfig: EarthDipoleConfig;
  sources: ExternalMagneticSource[];
  solarWind: SolarWindConfig;
  maxStress: number;
  maxStressNodeIndex: number;
  alignmentOrder: number;
}

export const GeminiExpertAssistant: React.FC<GeminiExpertAssistantProps> = ({
  earthConfig,
  sources,
  solarWind,
  maxStress,
  maxStressNodeIndex,
  alignmentOrder,
}) => {
  const [messages, setMessages] = useState<AIAnalysisMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `반갑습니다! 저는 **전산 물리 및 다극 자기장 상호작용 전문가 AI**입니다.

지구 자기 쌍극자($\\mathbf{B}_{\\text{earth}}$), 외부 다극원($\\mathbf{B}_{\\text{ext}}$), 태양풍 IMF의 벡터 중첩 왜곡 현상과 그에 따른 **가상 지진운(대기 입자 편광 정렬)** 및 **지각 응력 누적 메커니즘**을 수치 해석해 드립니다.

아래 추천 질의를 누르거나 자유롭게 물리 가설과 수학적 유도에 대해 질문해 보세요!`,
      timestamp: Date.now(),
      modelUsed: 'gemini-3.7-flash',
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [enableThinking, setEnableThinking] = useState<boolean>(true);
  const [modelPreference, setModelPreference] = useState<'flash' | 'pro'>('flash');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const presetQueries = [
    {
      label: '⚡ 자기 재결합 & X-Point 해석',
      prompt: '현재 시뮬레이션 상태에서 자기력선 중첩에 의해 형성되는 X-Point(자기 재결합점)의 위치와 에너지 변환 메커니즘을 LaTeX 수식과 함께 물리적으로 분석해줘.',
    },
    {
      label: '☁️ 가상 지진운 대기 편광 정렬 모델 유도',
      prompt: '왜곡된 자기력선을 따라 대기 중 하전 에어로졸/수적 입자가 정렬되는 토크 방정식 $\\tau = -\\kappa \\sin(2(\\phi - \\theta_B))$과 네마틱 질서도 $S$의 물리학적 의미를 설명해줘.',
    },
    {
      label: '🌊 양떼구름(Altocumulus) 국소 정렬 파동 모델',
      prompt: '외부 자기장과 지구 자기장의 간섭 강도 $I(x, y) = |\\mathbf{B}_{\\text{earth}} \\times \\mathbf{B}_{\\text{ext}}| + \\alpha |\\nabla |\\mathbf{B}_{\\text{total}}||$, 시그모이드 마스크 $M(x, y)$, 직교 파동 $C(x, y) = M(x, y) \\cdot \\frac{1 + \\cos(\\mathbf{k}_\\perp \\cdot \\mathbf{r})}{2}$의 수학적 유도와 물리적 원리를 설명해줘.',
    },
    {
      label: '🌋 지각 응력 텐서 및 임계 지진 유발 해석',
      prompt: '자기 에너지 밀도 구배 $\\nabla |\\mathbf{B}|^2$와 압전/자기변형 결합 계수 $\\alpha$를 통한 단층대 응력 누적 및 지진 파열(Rupture) 과정을 단계별로 수식과 함께 설명해줘.',
    },
    {
      label: '☀️ 태양풍(IMF) 남향 역전(Bz < 0) 충격 해석',
      prompt: '태양풍 IMF의 남향 성분($B_z < 0$)이 지구 자기권 전면부(Day-side)에 미치는 압축 및 자기 재결합 효과를 채프먼-페라로 모델 관점에서 설명해줘.',
    },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputPrompt;
    if (!query.trim() || isLoading) return;

    const userMessage: AIAnalysisMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputPrompt('');
    setIsLoading(true);

    try {
      const activeSources = sources.filter((s) => s.active);
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          modelPreference: enableThinking ? 'pro' : modelPreference,
          enableThinking,
          simulationState: {
            earthMoment: earthConfig.moment,
            earthTilt: earthConfig.tiltAngle,
            sources: activeSources,
            imfBx: solarWind.imfBx,
            imfBz: solarWind.imfBz,
            solarWindPressure: solarWind.pressure,
            maxStress,
            maxStressNodeIndex,
            alignmentOrder,
          },
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        if (!res.ok) {
          throw new Error('정적 웹 호스팅(GitHub Pages) 환경입니다. 대화형 AI 분석 기능은 Node.js 서버 환경에서 실행하거나 개발 환경에서 지원됩니다. (2D/3D 물리 계산 및 파동운 시뮬레이션은 100% 브라우저에서 정상 작동합니다.)');
        }
      }

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ 오류: ${data.error}`,
            timestamp: Date.now(),
          },
        ]);
      } else if (data.text) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: data.text,
            timestamp: Date.now(),
            modelUsed: data.model,
            isThinking: enableThinking,
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `ℹ️ ${err.message || '요청을 처리할 수 없습니다.'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to render text with math blocks
  const renderFormattedContent = (content: string) => {
    // Split by double dollar $$ for display mode or single dollar $ for inline
    const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+\$)/g);

    return (
      <div className="space-y-2 leading-relaxed">
        {parts.map((part, index) => {
          if (part.startsWith('$$') && part.endsWith('$$')) {
            const math = part.slice(2, -2).trim();
            return (
              <div key={index} className="my-2 p-2 bg-slate-950/80 rounded border border-slate-800 text-center overflow-x-auto">
                <LatexRenderer math={math} displayMode={true} />
              </div>
            );
          } else if (part.startsWith('$') && part.endsWith('$')) {
            const math = part.slice(1, -1).trim();
            return <LatexRenderer key={index} math={math} displayMode={false} />;
          } else {
            return (
              <span key={index} className="whitespace-pre-wrap">
                {part}
              </span>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="bg-[#0f0f13] border border-[#1e1e24] rounded-lg shadow-2xl flex flex-col h-[580px] overflow-hidden text-slate-200">
      {/* Header - High Density */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e24] bg-[#09090c]">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 shadow-sm">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5 font-mono">
              <span>Gemini 전산 물리 전문가 AI</span>
              <span className="px-1 py-0.2 text-[9px] rounded bg-cyan-950/60 text-cyan-300 font-mono border border-cyan-500/30">
                Grounded
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              자기장 중첩 상태 기반 물리 해석 및 LaTeX 수식 유도
            </p>
          </div>
        </div>

        {/* Model & Thinking Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            id="btn-toggle-ai-thinking"
            onClick={() => setEnableThinking(!enableThinking)}
            className={`px-2 py-1 text-xs rounded transition-all flex items-center gap-1 border font-mono ${
              enableThinking
                ? 'bg-purple-950/40 text-purple-300 border-purple-500/40 shadow-sm font-semibold'
                : 'bg-[#14141b] text-slate-400 border-[#1e1e24] hover:text-slate-200'
            }`}
            title="High Thinking Mode for rigorous STEM reasoning"
          >
            <Brain className="w-3 h-3 text-purple-400" />
            <span className="text-[10px]">High Thinking</span>
          </button>
        </div>
      </div>

      {/* Preset Quick Question Chips */}
      <div className="px-2.5 py-1.5 bg-[#0a0a0e] border-b border-[#1e1e24] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {presetQueries.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(chip.prompt)}
            disabled={isLoading}
            className="shrink-0 px-2 py-0.5 text-[10px] font-mono rounded bg-[#14141b] hover:bg-[#1a1a26] text-slate-300 hover:text-cyan-300 border border-[#1e1e24] hover:border-[#2a2a3c] transition-colors disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Message Chat List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-5 h-5 rounded bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center shrink-0 mt-0.5 text-cyan-300">
                <Bot className="w-3 h-3" />
              </div>
            )}

            <div
              className={`relative group max-w-[88%] rounded-md p-2.5 ${
                msg.role === 'user'
                  ? 'bg-[#12313d] text-cyan-100 border border-cyan-700/50 rounded-br-none shadow-sm'
                  : 'bg-[#14141b] text-slate-200 border border-[#1e1e24] rounded-bl-none shadow-md'
              }`}
            >
              {msg.role === 'assistant' && msg.modelUsed && (
                <div className="text-[9px] text-slate-400 font-mono mb-1 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                  <span>{msg.modelUsed}</span>
                  {msg.isThinking && <span className="text-purple-400 font-semibold">· High Thinking Applied</span>}
                </div>
              )}

              {renderFormattedContent(msg.content)}

              {msg.role === 'assistant' && (
                <button
                  onClick={() => copyMessage(msg.id, msg.content)}
                  className="absolute bottom-1.5 right-1.5 p-1 text-slate-400 hover:text-white rounded bg-[#09090c] border border-[#1e1e24] opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy message"
                >
                  {copiedId === msg.id ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                </button>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-5 h-5 rounded bg-[#1a1a24] border border-[#2a2a38] flex items-center justify-center shrink-0 mt-0.5 text-slate-300">
                <User className="w-3 h-3" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="w-5 h-5 rounded bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center shrink-0 text-cyan-300">
              <Bot className="w-3 h-3 animate-spin" />
            </div>
            <div className="p-2 bg-[#14141b] rounded-md border border-[#1e1e24] text-slate-300 text-xs flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span className="text-[11px]">전산 물리 모델 수치 적분 및 분석 중...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box - High Density */}
      <div className="p-2 border-t border-[#1e1e24] bg-[#09090c]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            id="input-ai-prompt"
            type="text"
            placeholder="다극 자기장 왜곡, 가상 지진운 생성 메커니즘을 질문하세요..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-[#14141b] border border-[#1e1e24] rounded px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors font-mono"
          />
          <button
            id="btn-send-ai-prompt"
            type="submit"
            disabled={isLoading || !inputPrompt.trim()}
            className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center justify-center"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
