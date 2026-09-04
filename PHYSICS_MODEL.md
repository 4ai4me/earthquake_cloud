# Physics model contract

This simulator contains two deliberately separated layers:

1. **Baseline/control** — established equations or clearly labelled schematic approximations.
2. **Hypothesis coupling** — the proposed external-magnetic-field-to-cloud/fault connection, controlled by an explicit coefficient and removable with a null run.

The program is a sensitivity experiment. It is not a validated earthquake predictor.

## Coordinates and compatibility (schemaVersion 2)

Authoritative field: src/physics/fieldModel.ts. R_E=6,371 km, B*=B/(31,200 nT); 2D samples the 3D field at z=0. Dipole fieldNt is the ideal equatorial strength at distance 1 R_E from the source. Legacy strength=1 retains this reference. IMF nT is not amplified; fieldVisualizationGain is compatibility-only.

String input preserves large exponents without a fabricated nT ceiling. Above 1e100 nT, ordinary cloud/fault/Python quantitative solvers stop with a warning while directional geometry continues. Infinity is a directional asymptote, not a physical infinite-energy solution; opposing infinite contributions without relative growth rates are indeterminate. Exponents must be exactly representable integers; non-field controls retain finite safety ranges.

Moon geometry uses the physical distance 60.3 R_E. Baseline global lunar dipole is zero; an optional whole-Moon dipole is explicitly hypothetical. Local anomalies, wake plasma and ocean/ionospheric tidal currents are not solved. Atmospheric/fault magnetic diagnostics exclude that optional lunar dipole; magnetic geometry includes it.

Cloud particles/bands occupy a prescribed 12±1.5 km shell, not predicted condensation height. Altitude display gain does not modify physics. 3D shares the z=0 particle cross-section. Ground-sky sampling intersects the physical shell; diagnostic-plane maps show functions, not cloud placement.

References: [NASA Moon](https://science.nasa.gov/moon/solar-wind/), [NWS clouds](https://www.weather.gov/lmk/cloud_classification).

## Display, kinematics and core response

Line opacity has a fixed 0.01–31,200 nT log scale; pulses are annotations, not energy transport. The weak contour is an ideal Earth-component iso-|B| surface (10 nT default), not a zero edge. RK4 ends at numerical display bounds.

3D field lines use actual vector superposition, not bounded visual displacement. This does not solve plasma currents, induction, shielding, reconnection or full MHD. Source rotation/orbit are independently prescribed kinematics, not torque-driven motion.

Core baseline 15 km/year is a configurable representative scale, not uniform measured flow. The inset is accelerated for explanation. Optional Δu=κT²P_extτ/(ρL), P_ext=B_ext²/(2μ₀), assumes ρ=11,000 kg/m³, L=2,260 km, transmission T, signed coupling κ and response time τ. This is **반드시 가설**. OFF/T=0/κ=0 gives zero response; there is no established universal nT threshold or automatic feedback into Earth moment.

References: [Livermore et al. (2017)](https://doi.org/10.1038/ngeo2859), [Landeau et al. (2022)](https://doi.org/10.1038/s43017-022-00264-1).

## Established/calibrated layer

### Dipole and magnetic pressure

The vector dipole equation is evaluated in the dipole-aligned frame and rotated back. The singularity is numerically softened with `r_epsilon = sqrt(r^2 + epsilon^2)`. Magnetic pressure is

`P_mag = B^2 / (2 mu_0)`.

### Solar wind and magnetopause

Proton ram pressure is calculated from measured/assumed density and speed:

`P_dyn[nPa] = 1.67262192595e-6 n_p[cm^-3] v[km/s]^2`.

A separate shared Shue boundary overlay responds only to solar-wind pressure and IMF Bz. It does not bend the superposed field or respond to arbitrary external sources. The application guard 0.05–100 nPa and |Bz|≤50 nT suppresses extrapolation; this is not a claimed universal fit domain:

`r(theta) = r0 [2/(1+cos(theta))]^alpha`.

Reference: [Shue et al. (1998), JGR, doi:10.1029/98JA01103](https://doi.org/10.1029/98JA01103).

### Aerosol/droplet baseline

The baseline trajectory is an overdamped carrier-flow model with Stokes relaxation and a Langevin turbulent-diffusion increment. A weak magnetic-gradient proxy follows

`F_mag = V DeltaChi grad(B^2)/(2 mu_0)`

rather than incorrectly moving a particle along `B` and calling that a Lorentz force. Translation from charge requires an electric field; atmospheric droplet studies normally combine drag, gravity, and electrostatic force `qE`.

References:

- [Gijs et al.-style magnetophoretic force derivation and Stokes balance](https://pmc.ncbi.nlm.nih.gov/articles/PMC3083238/)
- [2023 review of magnetic/electromagnetic particle forces](https://doi.org/10.1039/D2LC00702A)
- [Guo & Xue (2021), charged droplets and atmospheric electric fields](https://doi.org/10.5194/acp-21-69-2021)

At geomagnetic field strengths these forces are expected to be extremely small for ordinary water droplets. The program therefore never presents the displayed magnetic-atmospheric drift as a measured effect.

### CERN CLOUD aerosol screening baseline

The `CLOUD experiment` tab is a separate, bounded sensitivity model for aerosol formation and growth. It does not feed the magnetic earthquake-cloud term. Three presets select the applicability region rather than claiming one universal chemistry:

- boundary layer: sulfuric acid–ammonia and sulfuric acid–dimethylamine;
- cold marine/polar air: iodine oxoacids and MSA synergy;
- upper troposphere: low-temperature isoprene-derived highly oxygenated organic molecules (IP-OOM).

The supplied vapors first undergo a condensation-sink survival screen,

`f_surv = exp(-CS t_exposure)`.

The displayed nucleation rate is a sum of bounded channel proxies,

`J* = J_SA-NH3 + J_SA-DMA + J_HIOx + J_IP-OOM + J_MSA + J_ion`,

where the sulfuric-acid/ammonia channel preserves the approximate dependencies `J_SA-NH3 proportional to [H2SO4]^3 [NH3]` reported by Dunne et al. The ion contribution is capped by ion-pair production, `J_ion <= q`; it is not an unlimited cosmic-ray multiplier. Other channel coefficients are explicit sensitivity anchors, not reconstructed CLOUD chamber fits.

Growth is screened as `D_final = 1.7 nm + GR* t_growth`, with `0 <= GR* <= 60 nm h^-1`. Cloud-condensation-nuclei activation uses the critical dry diameter from κ-Köhler theory,

`D_d,c = [4 A^3/(27 kappa s_c^2)]^(1/3)`, `A = 4 sigma_w M_w/(R T rho_w)`.

The resulting `CCN activation potential` is a bounded comparison score, not a CCN concentration or cloud forecast. Its optional weather link only scales the existing meteorological cloud proxy from 70% to 100%; it cannot create cloud without that baseline and never changes the magnetic hypothesis coefficient `A_h`.

References:

- [CERN CLOUD experiment overview](https://home.cern/science/experiments/CLOUD/)
- [Dunne et al. (2016), global atmospheric particle formation](https://doi.org/10.1126/science.aaf2649)
- [Almeida et al. (2013), sulfuric acid–dimethylamine nucleation](https://doi.org/10.1038/nature12663)
- [He et al. (2023), iodine oxoacid–sulfuric acid synergy](https://doi.org/10.1126/science.adh2526)
- [Shen et al. (2024), upper-tropospheric IP-OOM nucleation](https://doi.org/10.1038/s41586-024-08196-0)
- [CLOUD Collaboration (2026), MSA–sulfuric acid–ammonia nucleation](https://doi.org/10.1038/s41586-026-10810-2)
- [Petters and Kreidenweis (2007), κ-Köhler theory](https://doi.org/10.5194/acp-7-1961-2007)

### Solid-Earth tide and synthetic rupture size

The lunar tide is a reversible quadrupolar perturbation proportional to `d^-3`; it is not accumulated as tectonic stress. Its calibration is bounded at 4 kPa, compared with typical earthquake stress drops of roughly 0.1–10 MPa.

Reference: [Métivier et al. (2009), Earth and Planetary Science Letters](https://doi.org/10.1016/j.epsl.2008.12.024).

Synthetic rupture magnitude is obtained from an assumed circular-crack radius and stress drop:

`M0 = (16/7) DeltaSigma a^3`

`Mw = (2/3) [log10(M0 [N m]) - 9.1]`.

Reference: [Kanamori (1977), JGR](https://doi.org/10.1029/JB082i020p02981). Because rupture radius and stress drop are scenario assumptions, the resulting `Mw` is explicitly synthetic.

## Hypothesis layer

Raw `|B_E x B_X|` and `|grad B|` cannot be added because they have different dimensions. The simulator now constructs bounded dimensionless terms:

- shear: `s = |B_E x B_X|/(|B_E||B_X|)`
- external ratio: `q = |B_X|/(|B_E|+|B_X|)`
- normalized gradient: `g = tanh(L|grad B|/B)`
- diagnostic: `I = q[(1-alpha)s + alpha g]`

The proposed cloud-pattern contribution is

`C_h = A_h M(I) [1 + cos(k_perp dot r - omega t)]/2`.

`A_h` is a dimensionless hypothesis coefficient. Setting `hypothesisEnabled=false` or `A_h=0` makes the contribution exactly zero while preserving identical weather and numerical settings. The Python export plots `coupled - control` directly.

The crustal hypothesis term is likewise reversible:

`DeltaSigma_h = K_h |B_X|/(|B_E|+|B_X|)`.

It does not accumulate like plate loading. `K_h=0` is the fault-model null control.

Wave phase is imposed. Alignment, accumulation, ion production, CCN activation and cloud formation are distinct; visible periodicity does not prove a spontaneous mechanism. Exported Python fixes the opening snapshot and time=0 diagnostics, not stochastic trajectories or the complete weather texture.

## What would count as supporting evidence

A useful test must pre-register locations, time windows, cloud-pattern metrics, magnetic/electric measurements, meteorological controls, and a null model. Support would require an out-of-sample improvement over weather-only controls with uncertainty intervals and independent replication. A visually compelling simulation pattern alone is not evidence of earthquake prediction skill.
