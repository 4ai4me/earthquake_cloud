import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import { BookOpen, CheckCircle, ChevronDown, ChevronUp, Cpu, Sparkles } from 'lucide-react';

interface MathFormulaProps {
  math: string;
  displayMode?: boolean;
}

export const LatexRenderer: React.FC<MathFormulaProps> = ({ math, displayMode = false }) => {
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(math, containerRef.current, {
          displayMode,
          throwOnError: false,
        });
      } catch (err) {
        if (containerRef.current) {
          containerRef.current.textContent = math;
        }
      }
    }
  }, [math, displayMode]);

  return <span ref={containerRef} className="inline-block" />;
};

export const MathFormulaCard: React.FC = () => {
  const [expanded, setExpanded] = React.useState<boolean>(true);

  return (
    <div className="bg-[#0f0f13] border border-[#1e1e24] rounded-lg p-3 shadow-xl text-slate-200">
      <div
        id="btn-toggle-math-formulas"
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5 font-semibold text-cyan-400 text-xs font-mono">
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span>물리 및 수학적 모델링 정의 (LaTeX 수식)</span>
        </div>
        <button className="text-slate-400 hover:text-white p-0.5">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5 space-y-2 text-xs text-slate-300 border-t border-[#1e1e24] pt-2.5">
          {/* Section 1: Earth Dipole Field */}
          <div className="bg-[#14141b] p-2 rounded border border-[#1e1e24]">
            <div className="font-medium text-slate-200 text-xs mb-0.5 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              1) 지구 자기 쌍극자 (Dipole Field) 근사
            </div>
            <div className="overflow-x-auto py-0.5 text-center font-mono text-cyan-200 text-[11px]">
              <LatexRenderer math="r = \sqrt{(x - x_0)^2 + (y - y_0)^2} + \epsilon" displayMode />
              <LatexRenderer math="B_{x,\text{earth}} = \frac{3 m (x - x_0)(y - y_0)}{r^5}, \quad B_{y,\text{earth}} = \frac{m [2(y - y_0)^2 - (x - x_0)^2]}{r^5}" displayMode />
            </div>
          </div>

          {/* Section 2: External Sources & Superposition */}
          <div className="bg-[#14141b] p-2 rounded border border-[#1e1e24]">
            <div className="font-medium text-slate-200 text-xs mb-0.5 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              2) 외부 자극(태양풍/단극/쌍극) 및 중첩의 원리 (Superposition)
            </div>
            <div className="overflow-x-auto py-0.5 text-center font-mono text-purple-200 text-[11px]">
              <LatexRenderer math="B_{x,\text{ext}} = \frac{q_m (x - x_{\text{ext}})}{r_{\text{ext}}^3}, \quad B_{y,\text{ext}} = \frac{q_m (y - y_{\text{ext}})}{r_{\text{ext}}^3}" displayMode />
              <LatexRenderer math="\mathbf{B}_{\text{total}} = (B_{x,\text{earth}} + B_{x,\text{ext}})\hat{i} + (B_{y,\text{earth}} + B_{y,\text{ext}})\hat{j}" displayMode />
              <LatexRenderer math="|\mathbf{B}_{\text{total}}| = \sqrt{B_{x,\text{total}}^2 + B_{y,\text{total}}^2}, \quad P_{\text{mag}} = \frac{|\mathbf{B}|^2}{2\mu_0}" displayMode />
            </div>
          </div>

          {/* Section 3: Virtual Cloud Alignment & Crustal Stress */}
          <div className="bg-[#14141b] p-2 rounded border border-[#1e1e24]">
            <div className="font-medium text-slate-200 text-xs mb-0.5 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              3) 가상 지진운(대기 입자 정렬) 및 지각 응력 모델
            </div>
            <div className="overflow-x-auto py-0.5 text-center font-mono text-emerald-200 text-[11px]">
              <LatexRenderer math="\tau_{\text{align}} = -\kappa \sin(2(\phi - \theta_B)), \quad S_{\text{nematic}} = \langle 2\cos^2(\phi - \theta_B) - 1 \rangle" displayMode />
              <LatexRenderer math="\sigma_{\text{crust}}(t) = \sigma_0 + \int [\alpha |\mathbf{B}|^2 + \beta |\nabla |\mathbf{B}|| - \gamma \sigma] dt \implies \text{Rupture if } \sigma \ge \sigma_{\text{crit}}" displayMode />
            </div>
          </div>

          {/* Section 4: Local Alignment Pattern (Sheep / Wave Clouds) */}
          <div className="bg-[#14141b] p-2 rounded border border-[#1e1e24]">
            <div className="font-medium text-slate-200 text-xs mb-0.5 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              4) 국소 정렬 패턴 (양떼구름 / Altocumulus Wave Cloud) 모델링
            </div>
            <div className="overflow-x-auto py-0.5 text-center font-mono text-sky-200 text-[11px] space-y-1">
              <LatexRenderer math="I(x, y) = |\mathbf{B}_{\text{earth}} \times \mathbf{B}_{\text{ext}}| + \alpha |\nabla |\mathbf{B}_{\text{total}}||" displayMode />
              <LatexRenderer math="M(x, y) = \frac{1}{1 + e^{-k (I(x, y) - I_{\text{th}})}}" displayMode />
              <LatexRenderer math="\hat{\mathbf{b}}_\perp = \left( -\frac{B_y}{|\mathbf{B}|}, \frac{B_x}{|\mathbf{B}|} \right), \quad \mathbf{k}_\perp = \frac{2\pi}{\lambda}\hat{\mathbf{b}}_\perp" displayMode />
              <LatexRenderer math="C(x, y) = M(x, y) \times \left[ \frac{1 + \cos(\mathbf{k}_\perp \cdot \mathbf{r} - \omega t)}{2} \right]" displayMode />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
