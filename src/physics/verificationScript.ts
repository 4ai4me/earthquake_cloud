import { AtmosphericCloudConfig, EarthDipoleConfig, ExternalMagneticSource, MoonConfig, SolarWindConfig } from '../types';

export function buildVerificationPython(
  earth: EarthDipoleConfig,
  sources: ExternalMagneticSource[],
  solarWind: SolarWindConfig,
  cloud: AtmosphericCloudConfig,
  moon: MoonConfig
): string {
  const state = {
    earth,
    sources: sources.filter((source) => source.active),
    solarWind,
    cloud: {
      interferenceThreshold: cloud.interferenceThreshold,
      sigmoidSteepness: cloud.sigmoidSteepness,
      waveWavelength: cloud.waveWavelength,
      gradientWeight: cloud.gradientWeight,
      externalStimulusThreshold: cloud.externalStimulusThreshold,
      hypothesisEnabled: cloud.hypothesisEnabled,
      hypothesisCoupling: cloud.hypothesisCoupling,
      weatherData: cloud.weatherData,
      aerosolExperiment: cloud.aerosolExperiment,
    },
    moon,
  };

  return `"""
Reproducible hypothesis/control analysis for earthquake_cloud.

Established baseline: dipole geometry, rho*v^2, B^2/(2*mu0), Shue (1998),
bounded solid-Earth tide, and Hanks-Kanamori Mw. The magnetic-atmospheric
coupling A_h is explicitly hypothetical. This script does not validate or
predict earthquakes.
"""
import json
import numpy as np
import matplotlib.pyplot as plt

STATE = json.loads(${JSON.stringify(JSON.stringify(state))})
MU0 = 4.0 * np.pi * 1e-7
B_EQ_NT = 31200.0
EPS = 0.05

x = np.linspace(-5.0, 5.0, 300)
y = np.linspace(-4.0, 4.0, 240)
X, Y = np.meshgrid(x, y)

def dipole_field(X, Y, x0, y0, moment, tilt_deg):
    dx, dy = X - x0, Y - y0
    r = np.sqrt(dx*dx + dy*dy + EPS*EPS)
    c, s = np.cos(np.radians(tilt_deg)), np.sin(np.radians(tilt_deg))
    xp, yp = dx*c + dy*s, -dx*s + dy*c
    bxp = 3.0*moment*xp*yp / r**5
    byp = moment*(2.0*yp*yp - xp*xp) / r**5
    return bxp*c - byp*s, bxp*s + byp*c

earth = STATE['earth']
m = earth['moment'] * (-1.0 if earth['reversed'] else 1.0)
Bx_e, By_e = dipole_field(X, Y, earth['x'], earth['y'], m, earth['tiltAngle'])
Bx, By = Bx_e.copy(), By_e.copy()

for src in STATE['sources']:
    dx, dy = X - src['x'], Y - src['y']
    r = np.sqrt(dx*dx + dy*dy + EPS*EPS)
    if src['type'] in ('monopole_n', 'monopole_s'):
        # Synthetic boundary-condition proxy; magnetic monopoles are not asserted.
        q = abs(src['strength']) * (1.0 if src['type'] == 'monopole_n' else -1.0)
        Bx += q*dx/r**3
        By += q*dy/r**3
    elif src['type'] == 'dipole':
        sx, sy = dipole_field(X, Y, src['x'], src['y'], src['strength'], src.get('angle', 0.0))
        Bx += sx
        By += sy
    elif src['type'] == 'comet':
        # Same schematic coma/tail proxy used by the interactive renderer.
        activity = src.get('cometGasActivity') or src['strength']
        Bx += -0.35*activity*dx/r**3
        By += -0.35*activity*dy/r**3

sw = STATE['solarWind']
if sw['enabled']:
    gain = max(1.0, sw.get('fieldVisualizationGain') or 1000.0)
    Bx += sw['imfBx'] / B_EQ_NT * gain
    By += sw['imfBz'] / B_EQ_NT * gain

Bmag = np.hypot(Bx, By)
B_tesla = Bmag * B_EQ_NT * 1e-9
Pmag_npa = B_tesla**2 / (2.0*MU0) * 1e9

# Dimensionless, unit-consistent perturbation diagnostic.
Bx_x, By_x = Bx - Bx_e, By - By_e
Be, Bxmag = np.hypot(Bx_e, By_e), np.hypot(Bx_x, By_x)
cross = np.abs(Bx_e*By_x - By_e*Bx_x)
shear = cross / np.maximum(1e-9, Be*Bxmag)
external_ratio = Bxmag / np.maximum(1e-9, Be + Bxmag)
grad_y, grad_x = np.gradient(Bmag, y, x)
grad_mag = np.hypot(grad_x, grad_y)
g = np.tanh(max(0.1, earth['radius']) * grad_mag / np.maximum(1e-6, Bmag))
alpha = np.clip(STATE['cloud'].get('gradientWeight') or 0.5, 0.0, 1.0)
I = np.clip(external_ratio*((1.0-alpha)*shear + alpha*g), 0.0, 1.0)

threshold = STATE['cloud'].get('interferenceThreshold') or 0.35
steepness = STATE['cloud'].get('sigmoidSteepness') or 6.0
mask = 1.0/(1.0 + np.exp(np.clip(-steepness*(I-threshold), -50.0, 50.0)))
wavelength = max(0.05, STATE['cloud'].get('waveWavelength') or 0.8)
bhat_x, bhat_y = Bx/np.maximum(Bmag, 1e-9), By/np.maximum(Bmag, 1e-9)
npx, npy = -bhat_y, bhat_x
phase = (2.0*np.pi/wavelength)*(npx*X + npy*Y)
wave = 0.5*(1.0 + np.cos(phase))

weather = STATE['cloud'].get('weatherData') or {}
cover = np.clip(weather.get('cloudCoverPercent', 50.0)/100.0, 0.0, 1.0)
humidity = np.clip(weather.get('relativeHumidity', 60.0)/100.0, 0.0, 1.0)
met_control = np.full_like(X, np.clip(0.35*cover + 0.65/(1.0 + np.exp(-16.0*(humidity-0.75))), 0.0, 1.0))

# Literature-guided CERN CLOUD aerosol screening chain. This is not the
# collaboration's full fitted parameterization and does not output measured J.
aero = STATE['cloud'].get('aerosolExperiment') or {}
aero_J, aero_GR, aero_ccn = 0.0, 0.0, 0.0
if aero.get('enabled', False):
    T = np.clip(aero.get('temperatureK', 278.0), 208.0, 313.0)
    RH = np.clip(aero.get('relativeHumidityPercent', 58.0), 0.0, 100.0)
    CS = np.clip(aero.get('condensationSinkS', 0.002), 0.0, 0.1)
    exposure = np.clip(aero.get('vaporExposureSeconds', 300.0), 0.0, 3600.0)
    survival = np.exp(-CS*exposure)
    sa = max(0.0, aero.get('sulfuricAcidCm3', 0.0))*survival
    nh3 = max(0.0, aero.get('ammoniaPptv', 0.0))
    dma = max(0.0, aero.get('dimethylaminePptv', 0.0))
    hiox = max(0.0, aero.get('iodineOxoacidCm3', 0.0))*survival
    ipoom = max(0.0, aero.get('ipOomCm3', 0.0))*survival
    msa = max(0.0, aero.get('msaCm3', 0.0))*survival
    cold = np.exp(np.clip((278.0-T)/25.0, -2.0, 4.0))
    rh_factor = np.clip(0.6 + 0.8*RH/100.0, 0.6, 1.4)
    j_sa_nh3 = 0.01*(sa/1e7)**3*max(0.02, nh3/5.0)*cold*rh_factor
    j_sa_dma = j_sa_nh3*max(0.0, 1000.0*dma/(dma+3.0))
    hiox_ratio = hiox/max(1.0, sa+hiox)
    j_hiox = j_sa_nh3*max(0.0, 10.0**(4.0*hiox_ratio)-1.0) + 0.02*(hiox/1e6)**2
    ut = np.clip((253.0-T)/20.0, 0.0, 1.0)
    acid_catalysis = 1.0 + 9.0*sa/(sa+1e6)
    j_ipoom = 3.0*(ipoom/max(1.0, ipoom+1e7))**2*acid_catalysis*ut
    marine_cold = np.clip((263.0-T)/15.0, 0.0, 1.0)*np.clip((RH-40.0)/30.0, 0.0, 1.0)
    msa_ratio = msa/max(1.0, msa+sa)
    j_msa = j_sa_nh3*9.0*msa_ratio*marine_cold
    j_neutral = np.clip(j_sa_nh3+j_sa_dma+j_hiox+j_ipoom+j_msa, 0.0, 1e5)
    ion_q = np.clip(aero.get('ionPairProductionCm3S', 2.0), 0.0, 100.0)
    warm_ion = np.clip((T-223.0)/55.0, 0.1, 1.0)
    j_ion = min(ion_q, j_neutral*(ion_q/(ion_q+2.0))*warm_ion)
    aero_J = j_neutral+j_ion
    gr_sa = 0.2*sa/1e7
    gr_hiox = 0.8*hiox/(hiox+1e6)
    gr_ipoom = ut*(3.0+57.0*ipoom/(ipoom+1e7)) if ut > 0 and ipoom > 0 else 0.0
    gr_msa = gr_sa*msa_ratio*marine_cold
    aero_GR = np.clip(gr_sa+gr_hiox+gr_ipoom+gr_msa, 0.0, 60.0)
    final_d = 1.7+aero_GR*np.clip(aero.get('growthHours', 12.0), 0.0, 168.0)
    sigma_w, mw, R, rho_w = 0.072, 0.01801528, 8.314462618, 997.0
    kelvin_A = 4.0*sigma_w*mw/(R*T*rho_w)
    kappa = np.clip(aero.get('hygroscopicityKappa', 0.3), 0.01, 1.5)
    ss = np.clip(aero.get('ccnSupersaturationPercent', 0.2)/100.0, 0.0001, 0.05)
    critical_d = (4.0*kelvin_A**3/(27.0*kappa*ss**2))**(1.0/3.0)*1e9
    size_activation = 1.0/(1.0+np.exp(-(final_d-critical_d)/max(2.0, critical_d*0.12)))
    abundance = 1.0-np.exp(-aero_J*np.clip(aero.get('growthHours', 12.0), 0.0, 168.0)*3600.0/1e4)
    aero_ccn = np.clip(size_activation*abundance, 0.0, 1.0)
    if aero.get('coupleToCloudBaseline', False):
        met_control *= 0.7+0.3*aero_ccn

A_h = np.clip(STATE['cloud'].get('hypothesisCoupling', 0.6), 0.0, 1.0)
if STATE['cloud'].get('hypothesisEnabled', True) is False:
    A_h = 0.0
hypothesis_delta = A_h * mask * wave
coupled = np.clip(met_control + hypothesis_delta, 0.0, 1.0)

# Solar-wind diagnostics and Shue et al. (1998) subsolar magnetopause.
n_cm3 = sw.get('densityCm3') or 5.0
v_kms = sw.get('speedKmS') or 400.0
pdyn_npa = 1.67262192595e-6*n_cm3*v_kms**2
bz = sw['imfBz']
r0 = (10.22 + 1.29*np.tanh(0.184*(bz+8.14))) * max(0.05, pdyn_npa)**(-1.0/6.6)

# Reversible tide and a synthetic circular-crack magnitude example.
moon = STATE['moon']
d_re = max(1.0, moon.get('physicalDistanceEarthRadii') or 60.3)
tide_kpa = 4.0*np.clip(moon.get('tidalStressWeight', 1.0), 0.0, 1.0)*(60.3/d_re)**3
rupture_radius_km, stress_drop_mpa = 10.0, 3.0
M0 = (16.0/7.0)*(stress_drop_mpa*1e6)*(rupture_radius_km*1000.0)**3
Mw = (2.0/3.0)*(np.log10(M0)-9.1)

fig, axes = plt.subplots(1, 3, figsize=(18, 6), dpi=140)
c0 = axes[0].contourf(X, Y, Bmag, 40, cmap='inferno')
axes[0].streamplot(X, Y, Bx, By, color='white', density=1.0, linewidth=0.4)
fig.colorbar(c0, ax=axes[0], label='normalized field B*')
axes[0].set_title('Normalized magnetic geometry')
c1 = axes[1].contourf(X, Y, met_control, levels=np.linspace(0,1,21), cmap='Blues', vmin=0, vmax=1)
fig.colorbar(c1, ax=axes[1], label='control cloud proxy')
axes[1].set_title('Null control: A_h = 0')
c2 = axes[2].contourf(X, Y, coupled-met_control, levels=np.linspace(0,1,21), cmap='magma', vmin=0, vmax=1)
fig.colorbar(c2, ax=axes[2], label='coupled - control')
axes[2].set_title(f'Hypothesis delta: A_h={A_h:.2f}')
for ax in axes:
    ax.set_aspect('equal')
    ax.set_xlim(-5, 5)
    ax.set_ylim(-4, 4)
plt.tight_layout()
plt.savefig('earthquake_cloud_hypothesis_control.png', dpi=300)

print(f'P_dyn={pdyn_npa:.3f} nPa, Shue r0={r0:.2f} R_E')
print(f'Peak P_mag(display-converted)={np.nanmax(Pmag_npa):.3e} nPa')
print(f'Max tide calibration={tide_kpa:.3f} kPa')
print(f'Synthetic example: M0={M0:.3e} N m, Mw={Mw:.2f}')
print(f'Hypothesis-control mean delta={np.mean(coupled-met_control):.6f}')
print(f'Aerosol screening: J*={aero_J:.3e} cm^-3 s^-1, GR*={aero_GR:.2f} nm h^-1, CCN potential*={aero_ccn:.3f}')
print('Output is a sensitivity experiment, not earthquake prediction evidence.')
`;
}
