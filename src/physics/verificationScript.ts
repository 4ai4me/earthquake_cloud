import { DEFAULT_RESEARCH, MODEL_SCHEMA_VERSION, ResearchConfig } from './fieldModel';
import { AtmosphericCloudConfig, EarthDipoleConfig, ExternalMagneticSource, MoonConfig, SolarWindConfig } from '../types';

export function buildVerificationPython(
  earth: EarthDipoleConfig,
  sources: ExternalMagneticSource[],
  solarWind: SolarWindConfig,
  cloud: AtmosphericCloudConfig,
  moon: MoonConfig,
  research: ResearchConfig = DEFAULT_RESEARCH
): string {
  const state = {
    schemaVersion: MODEL_SCHEMA_VERSION, research,
    earth,
    sources: sources.filter((source) => source.active),
    solarWind,
    cloud: {
      cloudAltitudeKm: cloud.cloudAltitudeKm ?? 12,
      cloudLayerHalfWidthKm: cloud.cloudLayerHalfWidthKm ?? 1.5,
      altitudeDisplayGain: cloud.altitudeDisplayGain ?? 1,
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

from decimal import Decimal, InvalidOperation

def source_scale(src):
    if 'fieldNt' not in src:
        return src['strength']
    raw = str(src['fieldNt']).replace('∞', 'Infinity')
    try:
        value = Decimal(raw)
    except InvalidOperation as exc:
        raise ValueError('Invalid fieldNt input') from exc
    if not value.is_finite() or value < 0 or value > Decimal('1e100'):
        raise ValueError('Extreme/log-direction mode: ordinary Python cloud/pressure calculations are unavailable; input is preserved in STATE.')
    return float(value) / B_EQ_NT

def dipole_field(X, Y, x0, y0, moment, tilt_deg, z0=0.0):
    dx, dy, dz = X-x0, Y-y0, -z0
    r2 = dx*dx+dy*dy+dz*dz
    mx, my = -np.sin(np.radians(tilt_deg)), np.cos(np.radians(tilt_deg))
    dot = mx*dx+my*dy
    r5 = (r2+EPS*EPS)**2.5
    return moment*(3*dx*dot-mx*r2)/r5, moment*(3*dy*dot-my*r2)/r5, moment*3*dz*dot/r5

earth, sw, moon = STATE['earth'], STATE['solarWind'], STATE['moon']
m = earth['moment'] * (-1.0 if earth['reversed'] else 1.0)
# Validate even sources not sampled by a particular plot.
for src in STATE['sources']:
    if src['type'] != 'comet':
        source_scale(src)

def total_field(X, Y, include_moon=True):
    bx, by, bz = dipole_field(X,Y,earth['x'],earth['y'],m,earth['tiltAngle'])
    for src in STATE['sources']:
        dx,dy,dz = X-src['x'],Y-src['y'],-src.get('z',0.0)
        r3 = (dx*dx+dy*dy+dz*dz+EPS*EPS)**1.5
        scale = source_scale(src) if src['type'] != 'comet' else 0.0
        if src['type'] in ('monopole_n','monopole_s'):
            q = scale*(-1 if src['type']=='monopole_s' else 1)
            bx,by,bz = bx+q*dx/r3,by+q*dy/r3,bz+q*dz/r3
        elif src['type']=='dipole':
            sx,sy,sz = dipole_field(X,Y,src['x'],src['y'],scale,src.get('angle',0.0),src.get('z',0.0))
            bx,by,bz = bx+sx,by+sy,bz+sz
        elif src['type']=='uniform':
            a = np.radians(src.get('angle',0.0))
            bx,by = bx-scale*np.sin(a),by+scale*np.cos(a)
        elif src['type']=='comet':
            activity = src.get('cometGasActivity',src['strength'])
            length = src.get('cometTailLength',3.0)
            width = 0.35+np.maximum(0,dx)*0.18
            tail = np.where((dx>0)&(dx<length),np.exp(-(dy*dy+dz*dz)/(2*width*width))*np.exp(-np.maximum(0,dx)/max(length,1e-9)),0)
            bx += -0.35*activity*dx/r3+activity*0.15*tail
            by += -0.35*activity*dy/r3+np.sign(dy)*activity*0.08*tail
            bz += -0.35*activity*dz/r3+np.sign(dz)*activity*0.08*tail
    if sw['enabled']:
        bx,by = bx+sw['imfBx']/B_EQ_NT,by+sw['imfBz']/B_EQ_NT
    if include_moon and moon['enabled'] and moon.get('hypothesisDipoleEnabled',False):
        angle = np.radians(moon['phaseAngleDeg'])
        distance = moon.get('physicalDistanceEarthRadii',60.3)
        sx,sy,sz = dipole_field(X,Y,earth['x']+distance*np.cos(angle),earth['y']+distance*np.sin(angle),
                              moon['remanentMoment'],moon['remanentAngle']+moon['phaseAngleDeg'])
        bx,by,bz = bx+sx,by+sy,bz+sz
    return bx,by,bz

Bx_e, By_e, Bz_e = dipole_field(X,Y,earth['x'],earth['y'],m,earth['tiltAngle'])
Bx, By, Bz = total_field(X,Y)

Bmag = np.sqrt(Bx*Bx+By*By+Bz*Bz)
B_tesla = Bmag * B_EQ_NT * 1e-9
Pmag_npa = B_tesla**2 / (2.0*MU0) * 1e9

# Dimensionless, unit-consistent perturbation diagnostic.
# Atmospheric diagnostic currently excludes the optional lunar dipole, matching the app.
cloud_bx, cloud_by, cloud_bz = total_field(X,Y,include_moon=False)
cloud_bmag = np.sqrt(cloud_bx**2+cloud_by**2+cloud_bz**2)
Bx_x, By_x = cloud_bx - Bx_e, cloud_by - By_e
Be, Bxmag = np.hypot(Bx_e, By_e), np.hypot(Bx_x, By_x)
cross = np.abs(Bx_e*By_x - By_e*Bx_x)
shear = cross / np.maximum(1e-9, Be*Bxmag)
external_ratio = Bxmag / np.maximum(1e-9, Be + Bxmag)
def magnitude_at(x,y):
    b = total_field(x,y,include_moon=False)
    return np.sqrt(b[0]**2+b[1]**2+b[2]**2)
h = 0.05
grad_x = (magnitude_at(X+h,Y)-magnitude_at(X-h,Y))/(2*h)
grad_y = (magnitude_at(X,Y+h)-magnitude_at(X,Y-h))/(2*h)
grad_mag = np.hypot(grad_x, grad_y)
g = np.tanh(max(0.1, earth['radius']) * grad_mag / np.maximum(1e-6, np.hypot(cloud_bx,cloud_by)))
alpha = np.clip(STATE['cloud'].get('gradientWeight',0.5), 0.0, 1.0)
I = np.clip(external_ratio*((1.0-alpha)*shear + alpha*g), 0.0, 1.0)

threshold = STATE['cloud'].get('interferenceThreshold',0.35)
steepness = STATE['cloud'].get('sigmoidSteepness',10.0)
mask = 1.0/(1.0 + np.exp(np.clip(-steepness*(I-threshold), -50.0, 50.0)))
wavelength = max(0.05, STATE['cloud'].get('waveWavelength',0.3))
driver = min(1.0,0.5*sw['pressure']/5+0.5*max(0,-sw['imfBz'])/20) if sw['enabled'] else 0.0
stimulus = np.minimum(1.0,0.7*external_ratio+0.2*shear+0.1*driver)
minimum = STATE['cloud'].get('externalStimulusThreshold',0.3)
mask *= np.where(stimulus<minimum,np.clip(stimulus/max(0.01,minimum),0,1)**2,1.0)
bhat_x, bhat_y = cloud_bx/np.maximum(cloud_bmag,1e-9), cloud_by/np.maximum(cloud_bmag,1e-9)
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
hypothesis_delta = np.where(cloud_bmag<1e-4,0.0,A_h * mask * wave)
coupled = np.clip(met_control + hypothesis_delta, 0.0, 1.0)

# Solar-wind diagnostics and Shue et al. (1998) subsolar magnetopause.
n_cm3 = sw.get('densityCm3') or 5.0
v_kms = sw.get('speedKmS') or 400.0
pdyn_npa = 1.67262192595e-6*n_cm3*v_kms**2
bz = sw['imfBz']
pressure = sw['pressure']
r0 = (10.22 + 1.29*np.tanh(0.184*(bz+8.14))) * pressure**(-1.0/6.6) if sw['enabled'] and 0.05<=pressure<=100 and abs(bz)<=50 else np.nan

# Reversible tide and a synthetic circular-crack magnitude example.
moon = STATE['moon']
d_re = max(1.0, moon.get('physicalDistanceEarthRadii') or 60.3)
tide_kpa = min(4.0,4.0*np.clip(moon.get('tidalStressWeight',1.0),0.0,1.0)*(60.3/d_re)**3) if moon['enabled'] else 0.0
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
fig.suptitle('Planar diagnostic functions, not physical cloud placement; time=0 snapshot. Cloud layer in app: '+str(STATE['cloud']['cloudAltitudeKm'])+' km')
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
