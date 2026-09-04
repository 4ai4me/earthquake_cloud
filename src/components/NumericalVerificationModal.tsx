import React, { useEffect, useRef, useState } from 'react';
import { AtmosphericCloudConfig, EarthDipoleConfig, ExternalMagneticSource, MoonConfig, SolarWindConfig } from '../types';
import { Check, Copy, Download, FileCode, Sparkles, Terminal, X } from 'lucide-react';
import { requestGemini, turnstileSiteKey } from '../services/geminiApiClient';
import { TurnstileWidget } from './TurnstileWidget';
import { ResearchConfig } from '../physics/fieldModel';
import { buildVerificationPython } from '../physics/verificationScript';

interface NumericalVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  earthConfig: EarthDipoleConfig;
  sources: ExternalMagneticSource[];
  solarWind: SolarWindConfig;
  cloudConfig: AtmosphericCloudConfig;
  moonConfig: MoonConfig;
  research: ResearchConfig;
}

export const NumericalVerificationModal: React.FC<NumericalVerificationModalProps> = ({
  isOpen,
  onClose,
  earthConfig,
  sources,
  solarWind,
  cloudConfig,
  moonConfig,
  research,
}) => {
  const [basePythonCode] = useState(() => buildVerificationPython(earthConfig,sources,solarWind,cloudConfig,moonConfig,research));
  const [copied, setCopied] = useState(false);
  const [isGeneratingAICode, setIsGeneratingAICode] = useState(false);
  const [customRequest, setCustomRequest] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [challengeVersion, setChallengeVersion] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Freeze the export at opening; ongoing orbits must not mutate a script being read/copied.
  const currentCode = generatedCode || basePythonCode;

  const download = (content: string, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  const handleDownloadIpynb = () => {
    const notebook = {
      cells: [
        {
          cell_type: 'markdown',
          metadata: {},
          source: [
            '# Earthquake-cloud hypothesis/control analysis\n',
            'This notebook separates established baseline equations from the hypothetical coupling term.\n',
          ],
        },
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: currentCode.split('\n').map((line) => `${line}\n`),
        },
      ],
      metadata: { language_info: { name: 'python' } },
      nbformat: 4,
      nbformat_minor: 2,
    };
    download(JSON.stringify(notebook, null, 2), 'earthquake_cloud_hypothesis_control.ipynb', 'application/x-ipynb+json');
  };

  const handleGenerateAICode = async () => {
    if (turnstileSiteKey && !turnstileToken) {
      setGenerationError('자동화 요청 확인이 완료된 뒤 다시 시도해 주세요.');
      return;
    }
    setIsGeneratingAICode(true);
    setGenerationError(null);
    try {
      const data = await requestGemini<{ code: string }>(
        '/api/gemini/generate-script',
        {
          simulationState: {
            earthMoment: earthConfig.moment,
            earthTilt: earthConfig.tiltAngle,
            sources: sources.filter((source) => source.active),
            imfBx: solarWind.imfBx,
            imfBz: solarWind.imfBz,
          },
          customizationRequest: customRequest,
        },
        turnstileToken
      );
      if (!data.code?.trim()) throw new Error('AI 서버가 생성 코드를 반환하지 않았습니다.');
      setGeneratedCode(data.code);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'AI 코드 생성 요청에 실패했습니다.');
    } finally {
      setIsGeneratingAICode(false);
      if (turnstileSiteKey) {
        setTurnstileToken(null);
        setChallengeVersion((value) => value + 1);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="verification-title" aria-describedby="verification-description" className="relative w-full max-w-4xl h-[min(88vh,760px)] min-h-0 bg-[#0f0f13] rounded-lg border border-[#1e1e24] shadow-2xl flex flex-col overflow-hidden text-slate-200">
        <div className="flex shrink-0 items-center justify-between gap-3 px-3 sm:px-4 py-2.5 border-b border-[#1e1e24] bg-[#09090c]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/30"><Terminal className="w-4 h-4" /></div>
            <div>
              <h3 id="verification-title" className="font-semibold text-slate-100 text-xs font-mono">Python 가설/대조군 수치 분석</h3>
              <p id="verification-description" className="text-[10px] text-slate-400">창을 연 시점의 입력을 고정합니다. 자기장과 시간 0 가설/대조군 진단이며 구름 궤적 전체 재현은 아닙니다.</p>
            </div>
          </div>
          <button ref={closeButtonRef} id="btn-close-verification-modal" aria-label="수치 분석 창 닫기" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-[#1a1a24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"><X className="w-4 h-4" /></button>
        </div>

        <div className="shrink-0 px-3 sm:px-4 py-2 bg-[#0c0c10] border-b border-[#1e1e24] flex flex-wrap sm:flex-nowrap items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <label htmlFor="input-custom-python-request" className="sr-only">Gemini Python 코드 추가 요청</label>
          <input id="input-custom-python-request" type="text" placeholder="AI 추가 요청…" value={customRequest} onChange={(event) => setCustomRequest(event.target.value)} className="min-w-[12rem] flex-1 bg-[#14141b] border border-[#1e1e24] rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60 font-mono text-[11px]" />
          <button id="btn-generate-ai-python-code" onClick={handleGenerateAICode} disabled={isGeneratingAICode} className="px-2.5 py-1 text-xs font-mono font-medium bg-purple-600/90 hover:bg-purple-600 text-white rounded flex items-center gap-1 disabled:opacity-50">
            {isGeneratingAICode ? '생성 중…' : 'Gemini 코드 커스텀'}
          </button>
        </div>

        {turnstileSiteKey && <div className="px-4 py-1.5 bg-[#0c0c10] border-b border-[#1e1e24]"><TurnstileWidget key={challengeVersion} siteKey={turnstileSiteKey} onToken={setTurnstileToken} /></div>}
        {generationError && <div role="alert" className="px-4 py-2 text-[11px] text-amber-200 bg-amber-950/30 border-b border-amber-700/30">{generationError} 기본 가설/대조군 코드는 계속 사용할 수 있습니다.</div>}

        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4 bg-[#070709] font-mono text-[11px] text-emerald-400 [scrollbar-gutter:stable]"><pre className="min-w-max whitespace-pre leading-relaxed">{currentCode}</pre></div>

        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-t border-[#1e1e24] bg-[#09090c]">
          <span className="text-[10px] text-slate-500 font-mono">NumPy + Matplotlib · 예측 도구 아님</span>
          <div className="flex items-center gap-1.5 font-mono">
            <button id="btn-copy-python-code" onClick={handleCopy} className="px-2.5 py-1 text-xs rounded bg-[#14141b] text-slate-200 flex items-center gap-1 border border-[#1e1e24]">{copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}{copied ? '복사됨' : '코드 복사'}</button>
            <button id="btn-download-python-script" onClick={() => download(currentCode, 'earthquake_cloud_hypothesis_control.py', 'text/x-python')} className="px-2.5 py-1 text-xs rounded bg-[#14141b] text-slate-200 flex items-center gap-1 border border-[#1e1e24]"><Download className="w-3.5 h-3.5" />.py</button>
            <button id="btn-download-jupyter-notebook" onClick={handleDownloadIpynb} className="px-2.5 py-1 text-xs rounded bg-cyan-600 text-white flex items-center gap-1"><FileCode className="w-3.5 h-3.5" />.ipynb</button>
          </div>
        </div>
      </div>
    </div>
  );
};
