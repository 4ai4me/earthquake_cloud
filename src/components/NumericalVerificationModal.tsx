import React, { useState } from 'react';
import { EarthDipoleConfig, ExternalMagneticSource, SolarWindConfig } from '../types';
import { Code, Copy, Check, Download, FileCode, Sparkles, X, Terminal } from 'lucide-react';

interface NumericalVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  earthConfig: EarthDipoleConfig;
  sources: ExternalMagneticSource[];
  solarWind: SolarWindConfig;
}

export const NumericalVerificationModal: React.FC<NumericalVerificationModalProps> = ({
  isOpen,
  onClose,
  earthConfig,
  sources,
  solarWind,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingAICode, setIsGeneratingAICode] = useState<boolean>(false);
  const [customRequest, setCustomRequest] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  // Generate Python numerical code based on current simulation state
  const basePythonCode = `"""
Numerical Simulation of Planetary Multipolar Magnetic Field Interactions,
Atmospheric Particle Streamline Alignment, and Crustal Stress Modeling.
Validated using NumPy and Matplotlib (streamplot, contourf).
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize

# 1. Simulation Domain Grid Setup
x = np.linspace(-5.0, 5.0, 300)
y = np.linspace(-4.0, 4.0, 240)
X, Y = np.meshgrid(x, y)
EPSILON = 0.05

# 2. Earth Magnetic Dipole Model
# Parameters:
m_earth = ${(earthConfig.reversed ? -1 : 1) * earthConfig.moment}  # Magnetic moment
tilt_deg = ${earthConfig.tiltAngle}
x0, y0 = ${earthConfig.x}, ${earthConfig.y}
r_earth_radius = ${earthConfig.radius}

# Transform coordinates for tilt angle
tilt_rad = np.radians(tilt_deg)
cos_t = np.cos(tilt_rad)
sin_t = np.sin(tilt_rad)

dx = X - x0
dy = Y - y0
r = np.sqrt(dx**2 + dy**2) + EPSILON

x_prime = dx * cos_t + dy * sin_t
y_prime = -dx * sin_t + dy * cos_t

bx_prime = (3.0 * m_earth * x_prime * y_prime) / (r**5)
by_prime = (m_earth * (2.0 * y_prime**2 - x_prime**2)) / (r**5)

Bx_earth = bx_prime * cos_t - by_prime * sin_t
By_earth = bx_prime * sin_t + by_prime * cos_t

# 3. Superposition of External Magnetic Sources
Bx_total = np.copy(Bx_earth)
By_total = np.copy(By_earth)

# External active sources:
sources_config = ${JSON.stringify(
    sources.filter((s) => s.active).map((s) => ({ type: s.type, x: s.x, y: s.y, strength: s.strength, angle: s.angle || 0 })),
    null,
    2
  )}

for s in sources_config:
    sdx = X - s['x']
    sdy = Y - s['y']
    sr = np.sqrt(sdx**2 + sdy**2) + EPSILON
    
    if s['type'] in ['monopole_n', 'monopole_s']:
        qm = s['strength'] if s['type'] == 'monopole_n' else -s['strength']
        Bx_total += (qm * sdx) / (sr**3)
        By_total += (qm * sdy) / (sr**3)
    elif s['type'] == 'dipole':
        rad = np.radians(s['angle'])
        cos_a, sin_a = np.cos(rad), np.sin(rad)
        sx_p = sdx * cos_a + sdy * sin_a
        sy_p = -sdx * sin_a + sdy * cos_a
        sbx_p = (3.0 * s['strength'] * sx_p * sy_p) / (sr**5)
        sby_p = (s['strength'] * (2.0 * sy_p**2 - sx_p**2)) / (sr**5)
        Bx_total += sbx_p * cos_a - sby_p * sin_a
        By_total += sbx_p * sin_a + sby_p * cos_a

# 4. Solar Wind & Interplanetary Magnetic Field (IMF)
${
  solarWind.enabled
    ? `Bx_total += ${solarWind.imfBx * 0.15}
By_total += ${solarWind.imfBz * 0.15}`
    : '# Solar wind disabled'
}

# 5. Composite Field Magnitude & Energy Density
B_mag = np.sqrt(Bx_total**2 + By_total**2)
Magnetic_Pressure = 0.5 * (B_mag**2)

# 6. Crustal Fault Stress Computation (Circumference Nodes)
num_nodes = 48
angles = np.linspace(0, 2*np.pi, num_nodes, endpoint=False)
node_x = x0 + r_earth_radius * np.cos(angles)
node_y = y0 + r_earth_radius * np.sin(angles)

# Interpolate magnetic magnitude at fault nodes
from scipy.interpolate import RegularGridInterpolator
interp_b = RegularGridInterpolator((y, x), B_mag, bounds_error=False, fill_value=0)
node_b_values = interp_b(np.column_stack([node_y, node_x]))
crust_stress = 0.08 * (node_b_values**2)

# 7. Local Interference & Wave Cloud (양떼구름) Hotspot Model
# 1) Interference Intensity: I(x, y) = |B_earth x B_ext| + alpha * |grad |B||
cross_prod = np.abs(Bx_earth * (By_total - By_earth) - By_earth * (Bx_total - Bx_earth))
grad_y, grad_x = np.gradient(B_mag, y, x)
grad_mag = np.sqrt(grad_x**2 + grad_y**2)
I_xy = cross_prod + 0.5 * grad_mag

# 2) Hotspot Sigmoid Mask: M(x, y) = 1 / (1 + exp(-k * (I - I_th)))
I_th, k_steepness = 0.85, 6.0
M_xy = 1.0 / (1.0 + np.exp(-k_steepness * (I_xy - I_th)))

# 3) Orthogonal Wave Pattern: C(x, y) = M(x, y) * [(1 + cos(k_perp . r)) / 2]
b_hat_x = Bx_total / (B_mag + 1e-5)
b_hat_y = By_total / (B_mag + 1e-5)
n_perp_x, n_perp_y = -b_hat_y, b_hat_x
k_wave = (2.0 * np.pi) / 0.8
k_dot_r = (n_perp_x * X + n_perp_y * Y) * k_wave
Wave_Cloud_C = M_xy * (0.5 * (1.0 + np.cos(k_dot_r)))

# 8. Visualization Plotting (Composite Layout)
fig, axes = plt.subplots(1, 2, figsize=(16, 7), dpi=150)
plt.style.use('dark_background')

# Subplot 1: Field Streamlines & Crustal Stress
cf1 = axes[0].contourf(X, Y, B_mag, levels=40, cmap='inferno', alpha=0.65)
fig.colorbar(cf1, ax=axes[0], label='Field Magnitude $|\\mathbf{B}_{\\mathrm{total}}|$ (Tesla)')
axes[0].streamplot(X, Y, Bx_total, By_total, color=B_mag, cmap='cool', density=1.4, linewidth=1.1)
earth_c1 = plt.Circle((x0, y0), r_earth_radius, color='#0284c7', ec='#38bdf8', lw=2, zorder=5)
axes[0].add_patch(earth_c1)
axes[0].scatter(node_x, node_y, c=crust_stress, cmap='autumn', s=40, edgecolors='black', zorder=7)
axes[0].set_title('1. Magnetic Field Streamlines & Fault Stress', fontsize=12)
axes[0].set_aspect('equal')

# Subplot 2: Local Interference & Wave Cloud (양떼구름) Hotspot Density
cf2 = axes[1].contourf(X, Y, Wave_Cloud_C, levels=40, cmap='viridis', alpha=0.85)
fig.colorbar(cf2, ax=axes[1], label='Wave Cloud Density $C(x,y)$')
axes[1].contour(X, Y, M_xy, levels=[0.5], colors=['#f43f5e'], linewidths=[1.8], linestyles=['--'])
earth_c2 = plt.Circle((x0, y0), r_earth_radius, color='#0284c7', ec='#38bdf8', lw=2, zorder=5)
axes[1].add_patch(earth_c2)
axes[1].set_title('2. Wave Cloud (양떼구름) Pattern $C(x,y)$ with Hotspot Mask $M(x,y)$', fontsize=12)
axes[1].set_aspect('equal')

for ax in axes:
    for s in sources_config:
        color = '#ef4444' if s['type'] == 'monopole_n' else ('#3b82f6' if s['type'] == 'monopole_s' else '#a855f7')
        ax.scatter([s['x']], [s['y']], c=color, s=100, edgecolors='white', zorder=10)
    ax.set_xlim(-5.0, 5.0)
    ax.set_ylim(-4.0, 4.0)
    ax.grid(True, linestyle='--', alpha=0.3)

plt.tight_layout()
plt.savefig('magnetic_wave_cloud_simulation.png', dpi=300)
plt.show()
print("Numerical validation plot successfully generated: magnetic_wave_cloud_simulation.png")
`;

  const currentCode = generatedCode || basePythonCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPy = () => {
    const blob = new Blob([currentCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'multipolar_magnetic_simulation.py';
    document.body.appendChild(a);
    a.click();
    document.body.appendChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadIpynb = () => {
    const notebook = {
      cells: [
        {
          cell_type: 'markdown',
          metadata: {},
          source: [
            '# Multipolar Magnetic Field & Virtual Earthquake Cloud Simulation\n',
            'Numerical analysis script generated from Google AI Studio physical simulator.\n',
          ],
        },
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: currentCode.split('\n').map((line) => line + '\n'),
        },
      ],
      metadata: {
        language_info: { name: 'python' },
      },
      nbformat: 4,
      nbformat_minor: 2,
    };

    const blob = new Blob([JSON.stringify(notebook, null, 2)], { type: 'application/x-ipynb+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'magnetic_simulation.ipynb';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateAICode = async () => {
    setIsGeneratingAICode(true);
    try {
      const res = await fetch('/api/gemini/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulationState: {
            earthMoment: earthConfig.moment,
            earthTilt: earthConfig.tiltAngle,
            sources,
            imfBx: solarWind.imfBx,
            imfBz: solarWind.imfBz,
          },
          customizationRequest: customRequest,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.code) {
          setGeneratedCode(data.code);
        }
      } else {
        // Fallback note on static hosting
        setGeneratedCode(`# [알림] 정적 호스팅(GitHub Pages) 환경에서는 실시간 커스텀 AI 코드 생성이 제한됩니다.\n# 상단 탭의 '기본 수치 해석 스크립트'를 복사하거나 .py 파일로 다운로드하여 바로 실행하실 수 있습니다.\n\n` + basePythonCode);
      }
    } catch {
      // Fallback
      setGeneratedCode(`# [알림] 서버 연결이 원활하지 않습니다. 기본 수치 모델링 코드를 제공합니다.\n\n` + basePythonCode);
    } finally {
      setIsGeneratingAICode(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-[#0f0f13] rounded-lg border border-[#1e1e24] shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Header - High Density */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e1e24] bg-[#09090c]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/30">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-xs font-mono">
                Python 기반 수치 검증 코드 (NumPy & Matplotlib)
              </h3>
              <p className="text-[10px] text-slate-400">
                수학적 모델링 수식 기반 2D/3D streamplot, contourf 검증 스크립트
              </p>
            </div>
          </div>
          <button
            id="btn-close-verification-modal"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#1a1a24] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* AI Customization input bar */}
        <div className="px-4 py-2 bg-[#0c0c10] border-b border-[#1e1e24] flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <input
            id="input-custom-python-request"
            type="text"
            placeholder="AI 추가 요청 (예: 3D Mayavi 렌더링 추가, 지진파 P/S파 시간 적분 추가 등)..."
            value={customRequest}
            onChange={(e) => setCustomRequest(e.target.value)}
            className="flex-1 bg-[#14141b] border border-[#1e1e24] rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60 font-mono text-[11px]"
          />
          <button
            id="btn-generate-ai-python-code"
            onClick={handleGenerateAICode}
            disabled={isGeneratingAICode}
            className="px-2.5 py-1 text-xs font-mono font-medium bg-purple-600/90 hover:bg-purple-600 text-white rounded transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {isGeneratingAICode ? '생성 중...' : 'Gemini 코드 커스텀'}
          </button>
        </div>

        {/* Code Content Box */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#070709] font-mono text-[11px] text-emerald-400">
          <pre className="whitespace-pre overflow-x-auto leading-relaxed">{currentCode}</pre>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1e1e24] bg-[#09090c]">
          <span className="text-[10px] text-slate-500 font-mono">Ready to execute in Jupyter Notebook or VSCode</span>
          <div className="flex items-center gap-1.5 font-mono">
            <button
              id="btn-copy-python-code"
              onClick={handleCopy}
              className="px-2.5 py-1 text-xs font-medium rounded bg-[#14141b] hover:bg-[#1a1a24] text-slate-200 transition-colors flex items-center gap-1 border border-[#1e1e24]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '복사됨' : '코드 복사'}
            </button>
            <button
              id="btn-download-python-script"
              onClick={handleDownloadPy}
              className="px-2.5 py-1 text-xs font-medium rounded bg-[#14141b] hover:bg-[#1a1a24] text-slate-200 transition-colors flex items-center gap-1 border border-[#1e1e24]"
            >
              <Download className="w-3.5 h-3.5" />
              .py 다운로드
            </button>
            <button
              id="btn-download-jupyter-notebook"
              onClick={handleDownloadIpynb}
              className="px-2.5 py-1 text-xs font-medium rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors flex items-center gap-1 shadow-sm"
            >
              <FileCode className="w-3.5 h-3.5" />
              .ipynb 다운로드
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
