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
      <button
        type="button"
        id="btn-toggle-math-formulas"
        aria-expanded={expanded}
        aria-controls="math-formula-content"
        className="flex w-full items-center justify-between rounded-sm text-left select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5 font-semibold text-cyan-400 text-xs font-mono">
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span>물리 및 수학적 모델링 정의 (LaTeX 수식)</span>
        </div>
        <span aria-hidden="true" className="text-slate-400 p-0.5">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {expanded && (
        <div id="math-formula-content" className="mt-2.5 space-y-2 text-xs text-slate-300 border-t border-[#1e1e24] pt-2.5">
          {/* Section 1: Earth Dipole Field */}
          <div className="bg-[#14141b] p-2 rounded border border-[#1e1e24]">
            <div className="font-medium text-slate-200 text-xs mb-0.5 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              1) 지구 자기 쌍극자 (Dipole Field) 근사
            </div>
            <div className="overflow-x-auto py-0.5 text-center font-mono text-cyan-200 text-[11px]">
              <LatexRenderer math="r_\epsilon = \sqrt{(x-x_0)^2+(y-y_0)^2+\epsilon^2}" displayMode />
              <LatexRenderer math="\mathbf B^*(\mathbf r)=m^*\left[3\hat{\mathbf r}(\hat{\mathbf m}\cdot\hat{\mathbf r})-\hat{\mathbf m}\right]/r^3,\quad B=B^*B_{\mathrm{eq}}" displayMode />
              <div className="text-[10px] text-slate-400">B*는 화면용 무차원 장이며 B_eq = 31,200 nT를 기준으로 환산합니다.</div>
            </div>
          </div>

          {/* Section 2: External Sources & Superposition */}
          <div className="bg-[#14141b] p-2 rounded border border-[#1e1e24]">
            <div className="font-medium text-slate-200 text-xs mb-0.5 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              2) 태양풍 동압과 자기권계면 (Shue 1998)
            </div>
            <div className="overflow-x-auto py-0.5 text-center font-mono text-purple-200 text-[11px]">
              <LatexRenderer math="P_{dyn}=m_p n_p v_{sw}^2,\quad P_{mag}=\frac{B^2}{2\mu_0}" displayMode />
              <LatexRenderer math="r(\theta)=r_0\left(\frac{2}{1+\cos\theta}\right)^\alpha,\quad r_0=[10.22+1.29\tanh(0.184(B_z+8.14))]P_{dyn}^{-1/6.6}" displayMode />
              <div className="text-[10px] text-slate-400">단극자는 실제 자기 단극자가 아니라 외부장 경계조건을 탐색하는 합성 프록시입니다.</div>
            </div>
          </div>

          {/* Section 3: Virtual Cloud Alignment & Crustal Stress */}
          <div className="bg-[#14141b] p-2 rounded border border-[#1e1e24]">
            <div className="font-medium text-slate-200 text-xs mb-0.5 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              3) 대기 입자 기준선과 자기 결합 가설
            </div>
            <div className="overflow-x-auto py-0.5 text-center font-mono text-emerald-200 text-[11px]">
              <LatexRenderer math="m_p\dot{\mathbf v}=6\pi\eta a(\mathbf u-\mathbf v)+\mathbf F_{mag}+\mathbf F_h+\mathbf F_{turb}" displayMode />
              <LatexRenderer math="\mathbf F_{mag}=\frac{V\Delta\chi}{2\mu_0}\nabla B^2,\quad d\mathbf r=\mathbf v\,dt+\sqrt{2D_tdt}\,d\mathbf W" displayMode />
              <LatexRenderer math="\mathbf F_h=A_h f_q M\sin\Phi\,\hat{\mathbf n}_{\perp},\quad A_h=0\;\text{for null control}" displayMode />
            </div>
          </div>

          {/* Section 4: Local Alignment Pattern (Sheep / Wave Clouds) */}
          <div className="bg-[#14141b] p-2 rounded border border-[#1e1e24]">
            <div className="font-medium text-slate-200 text-xs mb-0.5 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              4) 국소 정렬 패턴 (양떼구름 / Altocumulus Wave Cloud) 모델링
            </div>
            <div className="overflow-x-auto py-0.5 text-center font-mono text-sky-200 text-[11px] space-y-1">
              <LatexRenderer math="s=\frac{|\mathbf B_E\times\mathbf B_X|}{|\mathbf B_E||\mathbf B_X|},\quad q=\frac{|\mathbf B_X|}{|\mathbf B_E|+|\mathbf B_X|},\quad g=\tanh\left(\frac{L|\nabla B|}{B}\right)" displayMode />
              <LatexRenderer math="I=q[(1-\alpha)s+\alpha g]" displayMode />
              <LatexRenderer math="M(x, y) = \frac{1}{1 + e^{-k (I(x, y) - I_{\text{th}})}}" displayMode />
              <LatexRenderer math="\hat{\mathbf{b}}_\perp = \left( -\frac{B_y}{|\mathbf{B}|}, \frac{B_x}{|\mathbf{B}|} \right), \quad \mathbf{k}_\perp = \frac{2\pi}{\lambda}\hat{\mathbf{b}}_\perp" displayMode />
              <LatexRenderer math="C_h(x,y)=A_hM(x,y)\left[\frac{1+\cos(\mathbf k_\perp\cdot\mathbf r-\omega t)}{2}\right]" displayMode />
            </div>
          </div>

          <div className="bg-[#14141b] p-2 rounded border border-[#1e1e24]">
            <div className="font-medium text-slate-200 text-xs mb-0.5 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              5) 조석 섭동·합성 파열 규모
            </div>
            <div className="overflow-x-auto py-0.5 text-center font-mono text-red-200 text-[11px]">
              <LatexRenderer math="\Delta\sigma_{tide}\propto d_M^{-3}\cos 2(\phi-\phi_M),\quad |\Delta\sigma_{tide}|\le 4\,\mathrm{kPa}" displayMode />
              <LatexRenderer math="M_0=\frac{16}{7}\Delta\sigma a^3,\quad M_w=\frac{2}{3}[\log_{10}(M_0\,[\mathrm{N\,m}])-9.1]" displayMode />
              <div className="text-[10px] text-slate-400">파열 반경과 응력강하는 가정값이므로 출력 규모는 관측 예측값이 아닌 합성 시나리오입니다.</div>
            </div>
          </div>

          <div className="bg-[#14141b] p-2 rounded border border-[#1e1e24]">
            <div className="font-medium text-slate-200 text-xs mb-0.5 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              6) CERN CLOUD 에어로졸 스크리닝 기준선
            </div>
            <div className="overflow-x-auto py-0.5 text-center font-mono text-violet-200 text-[11px]">
              <LatexRenderer math="f_{surv}=e^{-CS\,t},\quad J^*=J_{SA-NH_3}+J_{SA-DMA}+J_{HIOx}+J_{IP-OOM}+J_{MSA}+J_{ion}" displayMode />
              <LatexRenderer math="J_{ion}\le q,\quad D_f=D_0+GR^*t_g" displayMode />
              <LatexRenderer math="D_{d,c}=\left[\frac{4A^3}{27\kappa s_c^2}\right]^{1/3},\quad A=\frac{4\sigma_wM_w}{RT\rho_w}" displayMode />
              <div className="text-[10px] text-slate-400">J*와 GR*은 논문 의존성과 범위를 반영한 민감도 출력이며 CLOUD 측정값·완전 적합식이 아닙니다.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
