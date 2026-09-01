# Physics model contract

This simulator contains two deliberately separated layers:

1. **Baseline/control** — established equations or clearly labelled schematic approximations.
2. **Hypothesis coupling** — the proposed external-magnetic-field-to-cloud/fault connection, controlled by an explicit coefficient and removable with a null run.

The program is a sensitivity experiment. It is not a validated earthquake predictor.

## Coordinates and units

- The 2-D canvas uses normalized display coordinates. `B* = 1` is calibrated to an equatorial surface reference field of 31,200 nT only when a physical conversion is requested.
- External pole and comet strengths remain dimensionless scenario inputs. A “monopole” is a synthetic boundary-condition proxy, not a claim that magnetic monopoles have been observed.
- Solar-wind `imfBx` and `imfBz` are nT. `fieldVisualizationGain` is an explicit display-only amplification and must not be interpreted as a measured field.
- The Moon's 3.5 world-unit display orbit is independent of its physical mean center distance, 60.3 Earth radii.

## Established/calibrated layer

### Dipole and magnetic pressure

The vector dipole equation is evaluated in the dipole-aligned frame and rotated back. The singularity is numerically softened with `r_epsilon = sqrt(r^2 + epsilon^2)`. Magnetic pressure is

`P_mag = B^2 / (2 mu_0)`.

### Solar wind and magnetopause

Proton ram pressure is calculated from measured/assumed density and speed:

`P_dyn[nPa] = 1.67262192595e-6 n_p[cm^-3] v[km/s]^2`.

The 3-D dayside response uses the Shue et al. magnetopause model:

`r(theta) = r0 [2/(1+cos(theta))]^alpha`.

Reference: [Shue et al. (1998), JGR, doi:10.1029/98JA01103](https://doi.org/10.1029/98JA01103).

### Aerosol/droplet baseline

The baseline trajectory is an overdamped carrier-flow model with Stokes relaxation and a Langevin turbulent-diffusion increment. A weak magnetic-gradient proxy follows

`F_mag = V DeltaChi grad(B^2)/(2 mu_0)`

rather than incorrectly moving a particle along `B` and calling that a Lorentz force. Translation from charge requires an electric field; atmospheric droplet studies normally combine drag, gravity, and electrostatic force `qE`.

References:

- [Gijs et al.-style magnetophoretic force derivation and Stokes balance](https://pmc.ncbi.nlm.nih.gov/articles/PMC3083238/)
- [2023 review of magnetic/electromagnetic particle forces](https://doi.org/10.1039/D2LC00702A)
- [Khain et al. (2021), charged droplets and atmospheric electric fields](https://doi.org/10.5194/acp-21-69-2021)

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

## What would count as supporting evidence

A useful test must pre-register locations, time windows, cloud-pattern metrics, magnetic/electric measurements, meteorological controls, and a null model. Support would require an out-of-sample improvement over weather-only controls with uncertainty intervals and independent replication. A visually compelling simulation pattern alone is not evidence of earthquake prediction skill.
