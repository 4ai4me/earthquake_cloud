[한국어 번역](#korean) · [English original](#english)

<a id="english"></a>

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

---

<a id="korean"></a>

# 물리 모델 명세 — 한국어 번역

[영문 원문으로 이동](#english)

이 시뮬레이터는 다음 두 계층을 의도적으로 구분합니다.

1. **기준선/대조군** — 확립된 방정식 또는 개략적인 근사임을 명확하게 표시한 모델입니다.
2. **가설 결합 — 반드시 가설** — 외부 자기장이 구름과 단층에 영향을 준다는 제안된 연결입니다. 명시적인 계수로 강도를 조절하며, 결합을 제거한 대조 실험도 실행할 수 있습니다.

이 프로그램은 입력 조건에 따른 결과의 변화를 비교하는 민감도 실험 도구입니다. 지진 예측 성능이 검증된 프로그램은 아닙니다.

## 좌표와 하위 호환성 (schemaVersion 2)

자기장 계산의 기준 구현은 `src/physics/fieldModel.ts`입니다. 지구 반지름은 `R_E=6,371 km`이고, 정규화된 자기장은 `B*=B/(31,200 nT)`입니다. 2D는 3D 자기장의 `z=0` 단면을 계산합니다. 쌍극자의 `fieldNt`는 자기원 중심으로부터 `1 R_E` 떨어진 자기 적도에서의 이상적인 자기장 세기입니다. 구형 입력인 `strength=1`도 이 기준을 유지합니다. IMF의 nT 값에는 시각적 증폭을 적용하지 않으며, `fieldVisualizationGain`은 구형 설정과의 호환성을 위해서만 남겨 둔 항목입니다.

문자열 입력은 임의의 nT 상한을 두지 않고 큰 지수를 보존합니다. `1e100 nT`를 초과하면 일반적인 구름·단층·Python 정량 계산은 경고와 함께 중단하지만, 자기장의 방향을 나타내는 기하 계산은 계속합니다. 무한대는 방향의 점근적 극한이지, 무한한 에너지를 가진 물리계의 해가 아닙니다. 서로 반대 방향인 무한대 성분들의 상대적인 증가율을 지정하지 않으면 합성 결과는 결정할 수 없습니다. 지수는 수치적으로 정확히 표현 가능한 정수여야 하며, 자기장 세기 이외의 조절 항목에는 유한한 안전 범위가 유지됩니다.

달의 위치와 궤도 표시는 물리적 거리인 `60.3 R_E`를 사용합니다. 기준선에서 달 전체를 나타내는 전역 쌍극자는 0이며, 선택적으로 켤 수 있는 달 전역 쌍극자는 **반드시 가설**입니다. 국소 자기 이상, 달 후류의 플라스마, 해양 및 전리층의 조석 전류는 계산하지 않습니다. 대기·단층의 자기장 진단에는 이 선택적 달 쌍극자가 포함되지 않지만, 자기장 기하 계산에는 포함됩니다.

구름 입자와 띠는 지정된 `12±1.5 km` 고도의 껍질 모양 층에 배치됩니다. 이 고도는 응결 계산으로 예측한 값이 아닙니다. 고도 표시 배율은 물리 계산을 바꾸지 않습니다. 3D도 동일한 `z=0` 입자 단면을 공유합니다. 지상 하늘 표시는 관측 방향과 물리적 구름층의 교점을 사용하며, 진단 평면 지도는 구름의 실제 배치가 아니라 함수값을 보여 줍니다.

참고 자료: [NASA의 달과 태양풍 설명](https://science.nasa.gov/moon/solar-wind/), [미국 기상청(NWS)의 구름 분류](https://www.weather.gov/lmk/cloud_classification).

## 시각화, 지정 운동과 외핵 응답

자기력선의 불투명도는 `0.01–31,200 nT`의 고정 로그 눈금을 사용합니다. 선을 따라 움직이는 펄스는 설명용 표시이며, 에너지 수송을 계산한 결과가 아닙니다. 약자기장 등치선은 이상적인 지구 자기장 성분의 크기 `|B|`가 같은 면을 나타냅니다. 기본값은 `10 nT`이며, 자기장이 0이 되는 경계가 아닙니다. RK4 적분은 수치적으로 정한 표시 영역의 경계에서 종료됩니다.

3D 자기력선은 제한된 시각적 변위로 모양만 바꾸는 방식이 아니라 실제 벡터 중첩값을 사용합니다. 다만 플라스마 전류, 유도, 차폐, 자기 재결합 또는 완전한 자기유체역학(MHD)을 푸는 것은 아닙니다. 자기원의 자체 회전과 공전은 각각 독립적으로 지정한 운동이며, 토크를 계산해 얻은 운동이 아닙니다.

외핵 유속의 기준값인 `15 km/년`은 조절 가능한 대표 규모입니다. 외핵 전체에서 균일하게 측정된 유속이라는 뜻은 아닙니다. 삽입 그림의 움직임은 설명을 위해 빠르게 표시됩니다. 선택적 응답식은 다음과 같습니다.

`Δu=κT²P_extτ/(ρL)`, `P_ext=B_ext²/(2μ₀)`

이 식은 밀도 `ρ=11,000 kg/m³`, 길이 규모 `L=2,260 km`, 전달률 `T`, 부호가 있는 결합 계수 `κ`, 응답 시간 `τ`를 가정합니다. 이 응답식은 **반드시 가설**입니다. 기능을 끄거나 `T=0` 또는 `κ=0`으로 설정하면 응답은 0입니다. 확립된 보편적인 nT 임계값을 뜻하지 않으며, 계산 결과가 지구의 자기 모멘트에 자동으로 되먹임되는 구조도 아닙니다.

참고 자료: [Livermore 외 (2017)](https://doi.org/10.1038/ngeo2859), [Landeau 외 (2022)](https://doi.org/10.1038/s43017-022-00264-1).

## 확립된 물리식 및 보정된 기준선 계층

### 쌍극자와 자기압

벡터 쌍극자 방정식은 쌍극자 축에 정렬된 좌표계에서 계산한 뒤 원래 좌표계로 회전 변환합니다. 중심의 특이점은 `r_epsilon = sqrt(r^2 + epsilon^2)`를 사용해 수치적으로 완화합니다. 자기압은 다음과 같습니다.

`P_mag = B^2 / (2 mu_0)`.

### 태양풍과 자기권계면

양성자에 의한 동압은 측정하거나 가정한 밀도와 속도로 계산합니다.

`P_dyn[nPa] = 1.67262192595e-6 n_p[cm^-3] v[km/s]^2`.

2D/3D가 공유하는 별도의 Shue 경계 표시는 태양풍 동압과 IMF의 Bz 성분에만 반응합니다. 이 경계 자체가 중첩 자기장을 휘게 만들거나, 임의의 외부 자기원에 반응하는 것은 아닙니다. 프로그램은 `0.05–100 nPa`와 `|Bz|≤50 nT`의 보호 범위를 적용하여 그 밖의 외삽을 억제합니다. 이 범위를 경험식의 보편적인 적합 범위라고 주장하는 것은 아닙니다.

`r(theta) = r0 [2/(1+cos(theta))]^alpha`.

참고 문헌: [Shue 외 (1998), JGR, doi:10.1029/98JA01103](https://doi.org/10.1029/98JA01103).

### 에어로졸·물방울 기준선

입자 궤적의 기준선은 주변 유체 흐름을 따르는 과감쇠 모델이며, Stokes 완화와 Langevin 난류 확산 증분을 포함합니다. 약한 자기장 구배 효과를 나타내는 대리항은 다음 식을 따릅니다.

`F_mag = V DeltaChi grad(B^2)/(2 mu_0)`

이는 입자를 단순히 `B` 방향으로 움직인 뒤 이를 로런츠 힘이라고 부르는 잘못된 방식과 구분됩니다. 전하에 의한 전기적 병진 운동을 다루려면 전기장이 필요합니다. 대기 물방울 연구에서는 일반적으로 항력, 중력, 정전기력 `qE`를 함께 고려합니다.

참고 자료:

- [Gijs 외의 접근과 같은 자기영동 힘 유도 및 Stokes 힘 평형](https://pmc.ncbi.nlm.nih.gov/articles/PMC3083238/)
- [입자에 작용하는 자기력·전자기력에 관한 2023년 종설](https://doi.org/10.1039/D2LC00702A)
- [Guo와 Xue (2021), 대전된 물방울과 대기 전기장](https://doi.org/10.5194/acp-21-69-2021)

지구 자기장 수준의 세기에서는 일반적인 물방울에 작용하는 이러한 힘이 매우 작을 것으로 예상됩니다. 따라서 프로그램에서 표시하는 자기장–대기 결합에 의한 이동을 측정된 효과로 제시하지 않습니다.

### CERN CLOUD 에어로졸 선별 평가 기준선

`CLOUD experiment` 탭은 에어로졸의 생성과 성장을 살펴보는 별도의 유한 범위 민감도 모델입니다. 이 모델의 출력은 자기장에 의한 지진운 가설 항에 입력되지 않습니다. 세 가지 프리셋은 하나의 보편적인 화학 반응식을 주장하는 대신, 적용할 환경을 선택합니다.

- 대기 경계층: 황산–암모니아 및 황산–디메틸아민.
- 차가운 해양·극지 대기: 요오드 산소산과 메테인설폰산(MSA)의 상승 작용.
- 상부 대류권: 저온에서의 이소프렌 유래 고산소화 유기분자(IP-OOM).

공급된 증기는 먼저 응결 싱크에 의한 제거를 고려한 잔존율 평가를 거칩니다.

`f_surv = exp(-CS t_exposure)`.

화면의 핵생성률은 각각 범위가 제한된 경로별 대리항의 합입니다.

`J* = J_SA-NH3 + J_SA-DMA + J_HIOx + J_IP-OOM + J_MSA + J_ion`,

이 중 황산–암모니아 경로는 Dunne 외의 연구에서 보고한 근사적인 의존성인 `J_SA-NH3 proportional to [H2SO4]^3 [NH3]`, 즉 황산 농도의 세제곱과 암모니아 농도에 비례하는 관계를 유지합니다. 이온에 의한 기여는 이온쌍 생성률로 제한됩니다(`J_ion <= q`). 무제한의 우주선 증폭 계수가 아닙니다. 다른 경로의 계수들은 민감도를 비교하기 위해 명시한 기준값이며, CLOUD 실험 챔버의 적합식을 재구성한 값이 아닙니다.

성장은 `D_final = 1.7 nm + GR* t_growth`로 평가하며, 성장률에는 `0 <= GR* <= 60 nm h^-1`의 범위를 적용합니다. 구름응결핵(CCN)의 활성화는 κ-Köhler 이론의 임계 건조 입경을 사용합니다.

`D_d,c = [4 A^3/(27 kappa s_c^2)]^(1/3)`, `A = 4 sigma_w M_w/(R T rho_w)`.

결과로 표시하는 `CCN activation potential`은 범위가 제한된 비교 점수입니다. CCN의 농도나 구름 예보가 아닙니다. 선택적인 기상 연동은 기존 기상 구름 대리값에 `70%–100%`의 배율만 적용합니다. 기상 기준선이 없는데 구름을 새로 만들 수 없으며, 자기장 가설의 계수 `A_h`도 바꾸지 않습니다.

참고 자료:

- [CERN CLOUD 실험 개요](https://home.cern/science/experiments/CLOUD/)
- [Dunne 외 (2016), 전 지구 대기 입자 생성](https://doi.org/10.1126/science.aaf2649)
- [Almeida 외 (2013), 황산–디메틸아민 핵생성](https://doi.org/10.1038/nature12663)
- [He 외 (2023), 요오드 산소산–황산 상승 작용](https://doi.org/10.1126/science.adh2526)
- [Shen 외 (2024), 상부 대류권 IP-OOM 핵생성](https://doi.org/10.1038/s41586-024-08196-0)
- [CLOUD 공동연구진 (2026), MSA–황산–암모니아 핵생성](https://doi.org/10.1038/s41586-026-10810-2)
- [Petters와 Kreidenweis (2007), κ-Köhler 이론](https://doi.org/10.5194/acp-7-1961-2007)

### 고체 지구 조석과 합성 파열 규모

달의 조석은 `d^-3`에 비례하는 가역적인 사중극 섭동이며, 판구조 운동에 의한 응력처럼 누적되지 않습니다. 이 모델의 보정값은 `4 kPa`로 제한되며, 비교 대상인 일반적인 지진의 응력강하는 대략 `0.1–10 MPa`입니다.

참고 문헌: [Métivier 외 (2009), Earth and Planetary Science Letters](https://doi.org/10.1016/j.epsl.2008.12.024).

합성 파열 규모는 가정한 원형 균열의 반경과 응력강하로부터 계산합니다.

`M0 = (16/7) DeltaSigma a^3`

`Mw = (2/3) [log10(M0 [N m]) - 9.1]`.

참고 문헌: [Kanamori (1977), JGR](https://doi.org/10.1029/JB082i020p02981). 파열 반경과 응력강하가 시나리오의 가정값이므로, 결과인 `Mw`는 합성 값임을 명시합니다.

## 가설 계층 — 반드시 가설

`|B_E x B_X|`와 `|grad B|`는 차원이 서로 다르므로 그대로 더할 수 없습니다. 시뮬레이터는 대신 범위가 제한된 무차원 항을 구성합니다.

- 방향 전단 지표: `s = |B_E x B_X|/(|B_E||B_X|)`
- 외부 자기장 비율: `q = |B_X|/(|B_E|+|B_X|)`
- 정규화된 구배: `g = tanh(L|grad B|/B)`
- 진단 지표: `I = q[(1-alpha)s + alpha g]`

제안된 구름 패턴의 기여 항은 다음과 같습니다.

`C_h = A_h M(I) [1 + cos(k_perp dot r - omega t)]/2`.

`A_h`는 무차원 가설 계수입니다. `hypothesisEnabled=false` 또는 `A_h=0`으로 설정하면 기상 조건과 수치 설정은 동일하게 유지하면서 가설 항의 기여만 정확히 0이 됩니다. Python 내보내기는 `coupled - control`, 즉 결합 실험에서 대조 실험을 뺀 차이를 직접 그래프로 표시합니다.

지각 가설 항도 마찬가지로 가역적입니다.

`DeltaSigma_h = K_h |B_X|/(|B_E|+|B_X|)`.

이 항은 판 운동에 의한 하중처럼 누적되지 않습니다. `K_h=0`이 단층 모델의 무결합 대조 조건입니다.

파동의 위상은 모델에서 지정합니다. 입자의 정렬, 집적, 이온 생성, CCN 활성화, 구름 형성은 서로 다른 과정입니다. 눈에 보이는 주기적 패턴만으로 자발적인 형성 기작이 입증되지는 않습니다. 내보낸 Python 코드는 내보내기 창을 연 시점의 입력 상태와 `time=0`의 진단값을 고정하며, 확률적인 입자 궤적이나 전체 기상 텍스처를 재현하는 것은 아닙니다.

## 가설을 뒷받침하는 근거의 조건

유의미한 검증을 위해서는 관측 장소, 시간 구간, 구름 패턴 지표, 자기장·전기장 측정, 기상 대조 조건, 무결합 기준 모델을 사전에 등록해야 합니다. 가설을 뒷받침하려면 모델을 맞추는 데 사용하지 않은 별도 자료에서도 기상 요인만 사용한 대조 모델보다 개선된 성능을 보여야 하며, 불확실성 구간과 독립적인 재현 검증이 필요합니다. 시뮬레이션에서 시각적으로 뚜렷한 패턴이 나타났다는 사실만으로 지진 예측 성능의 근거가 되지는 않습니다.
