import { CernCloudAerosolConfig, CernCloudEnvironment } from '../types';

export interface CernCloudAerosolResult {
  neutralNucleationRateCm3S: number;
  ionInducedRateCm3S: number;
  totalNucleationRateCm3S: number;
  growthRateNmH: number;
  finalDryDiameterNm: number;
  ccnCriticalDryDiameterNm: number;
  ccnActivationPotential: number;
  vaporSurvivalFraction: number;
  dominantChannel: 'SA_NH3' | 'SA_DMA' | 'HIOX' | 'IP_OOM' | 'MSA' | 'inactive';
  applicabilityWarnings: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finiteNonNegative = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);

export const CERN_CLOUD_PRESETS: Record<CernCloudEnvironment, CernCloudAerosolConfig> = {
  boundary_layer: {
    enabled: true,
    environment: 'boundary_layer',
    temperatureK: 278,
    pressureHpa: 965,
    relativeHumidityPercent: 58,
    ionPairProductionCm3S: 2,
    sulfuricAcidCm3: 1e7,
    ammoniaPptv: 5,
    dimethylaminePptv: 0.2,
    iodineOxoacidCm3: 1e5,
    ipOomCm3: 0,
    msaCm3: 0,
    condensationSinkS: 0.002,
    vaporExposureSeconds: 300,
    growthHours: 12,
    ccnSupersaturationPercent: 0.2,
    hygroscopicityKappa: 0.3,
    coupleToCloudBaseline: false,
  },
  marine_polar: {
    enabled: true,
    environment: 'marine_polar',
    temperatureK: 258,
    pressureHpa: 965,
    relativeHumidityPercent: 70,
    ionPairProductionCm3S: 4,
    sulfuricAcidCm3: 1e6,
    ammoniaPptv: 1,
    dimethylaminePptv: 0,
    iodineOxoacidCm3: 1e6,
    ipOomCm3: 0,
    msaCm3: 1e6,
    condensationSinkS: 0.0005,
    vaporExposureSeconds: 600,
    growthHours: 24,
    ccnSupersaturationPercent: 0.2,
    hygroscopicityKappa: 0.45,
    coupleToCloudBaseline: false,
  },
  upper_troposphere: {
    enabled: true,
    environment: 'upper_troposphere',
    temperatureK: 223,
    pressureHpa: 300,
    relativeHumidityPercent: 40,
    ionPairProductionCm3S: 30,
    sulfuricAcidCm3: 1e6,
    ammoniaPptv: 1,
    dimethylaminePptv: 0,
    iodineOxoacidCm3: 1e5,
    ipOomCm3: 1e7,
    msaCm3: 0,
    condensationSinkS: 0.0001,
    vaporExposureSeconds: 900,
    growthHours: 8,
    ccnSupersaturationPercent: 0.2,
    hygroscopicityKappa: 0.2,
    coupleToCloudBaseline: false,
  },
};

/**
 * Bounded literature-guided screening model, not the CLOUD collaboration's
 * full fitted parameterization. It preserves reported dependencies and anchor
 * ranges without presenting invented precision as a chamber measurement.
 */
export function computeCernCloudAerosol(config: CernCloudAerosolConfig): CernCloudAerosolResult {
  if (!config.enabled) {
    return {
      neutralNucleationRateCm3S: 0,
      ionInducedRateCm3S: 0,
      totalNucleationRateCm3S: 0,
      growthRateNmH: 0,
      finalDryDiameterNm: 1.7,
      ccnCriticalDryDiameterNm: computeKappaKohlerCriticalDiameterNm(
        config.temperatureK,
        config.hygroscopicityKappa,
        config.ccnSupersaturationPercent
      ),
      ccnActivationPotential: 0,
      vaporSurvivalFraction: 0,
      dominantChannel: 'inactive',
      applicabilityWarnings: [],
    };
  }

  const temperatureK = clamp(config.temperatureK, 208, 313);
  const rh = clamp(config.relativeHumidityPercent, 0, 100);
  const condensationSink = clamp(config.condensationSinkS, 0, 0.1);
  const exposureSeconds = clamp(config.vaporExposureSeconds, 0, 3_600);
  const vaporSurvivalFraction = Math.exp(-condensationSink * exposureSeconds);
  const sa = finiteNonNegative(config.sulfuricAcidCm3) * vaporSurvivalFraction;
  const ammonia = finiteNonNegative(config.ammoniaPptv);
  const dma = finiteNonNegative(config.dimethylaminePptv);
  const hiox = finiteNonNegative(config.iodineOxoacidCm3) * vaporSurvivalFraction;
  const ipOom = finiteNonNegative(config.ipOomCm3) * vaporSurvivalFraction;
  const msa = finiteNonNegative(config.msaCm3) * vaporSurvivalFraction;

  // Dunne et al. report approximate H2SO4^3, NH3^1 and ion dependencies.
  // The coefficient is an explicit reference scaling for sensitivity only.
  const coldFactor = Math.exp(clamp((278 - temperatureK) / 25, -2, 4));
  const rhFactor = clamp(0.6 + 0.8 * rh / 100, 0.6, 1.4);
  const saNh3 = 0.01 * Math.pow(sa / 1e7, 3) * Math.max(0.02, ammonia / 5) * coldFactor * rhFactor;
  const dmaStabilization = 1 + 1_000 * dma / (dma + 3);
  const saDma = saNh3 * Math.max(0, dmaStabilization - 1);

  // He et al. report 10–10,000-fold HIOx synergy in marine/polar air.
  const hioxRatio = hiox / Math.max(1, sa + hiox);
  const hioxSynergy = Math.pow(10, 4 * hioxRatio);
  const hioxChannel = saNh3 * Math.max(0, hioxSynergy - 1) + 0.02 * Math.pow(hiox / 1e6, 2);

  // Shen et al. report IP-OOM NPF at 223/243 K, about 30 cm-3 s-1 near
  // 1e6 cm-3 trace acid, and growth of 3–60 nm h-1.
  const upperTroposphereActivation = clamp((253 - temperatureK) / 20, 0, 1);
  const acidCatalysis = 1 + 9 * sa / (sa + 1e6);
  const ipOomChannel = 3 * Math.pow(ipOom / Math.max(1, ipOom + 1e7), 2) * acidCatalysis * upperTroposphereActivation;

  // CLOUD 2026 reports MSA-NH3 below -10 C and up to 10x SA-NH3 synergy.
  const marineColdActivation = clamp((263 - temperatureK) / 15, 0, 1) * clamp((rh - 40) / 30, 0, 1);
  const msaRatio = msa / Math.max(1, msa + sa);
  const msaChannel = saNh3 * 9 * msaRatio * marineColdActivation;

  const channels = { SA_NH3: saNh3, SA_DMA: saDma, HIOX: hioxChannel, IP_OOM: ipOomChannel, MSA: msaChannel } as const;
  const neutralNucleationRateCm3S = clamp(Object.values(channels).reduce((sum, value) => sum + value, 0), 0, 1e5);

  // Each stable ion-induced particle consumes an ion pair, so this contribution
  // is capped by the supplied ion-pair production rate.
  const q = clamp(config.ionPairProductionCm3S, 0, 100);
  const warmIonSensitivity = clamp((temperatureK - 223) / 55, 0.1, 1);
  const ionInducedRateCm3S = Math.min(q, neutralNucleationRateCm3S * (q / (q + 2)) * warmIonSensitivity);
  const totalNucleationRateCm3S = neutralNucleationRateCm3S + ionInducedRateCm3S;

  const saGrowth = 0.2 * sa / 1e7;
  const iodineGrowth = 0.8 * hiox / (hiox + 1e6);
  const ipOomGrowth = upperTroposphereActivation > 0 && ipOom > 0
    ? upperTroposphereActivation * (3 + 57 * ipOom / (ipOom + 1e7))
    : 0;
  const msaGrowth = saGrowth * msaRatio * marineColdActivation;
  const growthRateNmH = clamp(saGrowth + iodineGrowth + ipOomGrowth + msaGrowth, 0, 60);
  const growthHours = clamp(config.growthHours, 0, 168);
  const finalDryDiameterNm = 1.7 + growthRateNmH * growthHours;
  const ccnCriticalDryDiameterNm = computeKappaKohlerCriticalDiameterNm(
    temperatureK,
    config.hygroscopicityKappa,
    config.ccnSupersaturationPercent
  );
  const diameterScale = Math.max(2, ccnCriticalDryDiameterNm * 0.12);
  const sizeActivation = 1 / (1 + Math.exp(-(finalDryDiameterNm - ccnCriticalDryDiameterNm) / diameterScale));
  const abundanceFactor = 1 - Math.exp(-totalNucleationRateCm3S * growthHours * 3_600 / 1e4);
  const ccnActivationPotential = clamp(sizeActivation * abundanceFactor, 0, 1);
  const dominantChannel = (Object.entries(channels) as Array<[keyof typeof channels, number]>)
    .reduce((best, current) => current[1] > best[1] ? current : best)[0];

  const applicabilityWarnings: string[] = [];
  if (config.pressureHpa < 200 || config.pressureHpa > 1_050) applicabilityWarnings.push('압력이 대류권 스크리닝 범위를 벗어났습니다.');
  if (config.environment === 'upper_troposphere' && temperatureK > 243) applicabilityWarnings.push('IP-OOM 채널은 CLOUD의 223/243 K 범위보다 따뜻합니다.');
  if (config.environment === 'marine_polar' && (temperatureK >= 263 || rh <= 40)) applicabilityWarnings.push('MSA 상승작용은 T < 263 K, RH > 40% 조건 밖입니다.');
  if (dma > 0 && config.environment !== 'boundary_layer') applicabilityWarnings.push('아민 채널은 짧은 수명 때문에 주로 경계층에 적용됩니다.');
  if (config.ionPairProductionCm3S > 75) applicabilityWarnings.push('이온쌍 생성률이 CLOUD 빔 비교 범위를 넘습니다.');

  return {
    neutralNucleationRateCm3S,
    ionInducedRateCm3S,
    totalNucleationRateCm3S,
    growthRateNmH,
    finalDryDiameterNm,
    ccnCriticalDryDiameterNm,
    ccnActivationPotential,
    vaporSurvivalFraction,
    dominantChannel,
    applicabilityWarnings,
  };
}

export function computeKappaKohlerCriticalDiameterNm(
  temperatureK: number,
  kappa: number,
  supersaturationPercent: number
): number {
  const surfaceTensionWater = 0.072;
  const molarMassWater = 0.01801528;
  const gasConstant = 8.314462618;
  const waterDensity = 997;
  const safeTemperature = clamp(temperatureK, 208, 313);
  const safeKappa = clamp(kappa, 0.01, 1.5);
  const supersaturation = clamp(supersaturationPercent / 100, 0.0001, 0.05);
  const kelvinA = (4 * surfaceTensionWater * molarMassWater) / (gasConstant * safeTemperature * waterDensity);
  return Math.pow((4 * Math.pow(kelvinA, 3)) / (27 * safeKappa * Math.pow(supersaturation, 2)), 1 / 3) * 1e9;
}

export function computeAerosolCloudBaselineMultiplier(config?: CernCloudAerosolConfig): number {
  if (!config?.enabled || !config.coupleToCloudBaseline) return 1;
  const result = computeCernCloudAerosol(config);
  // Optional sensitivity bridge only: it cannot create cloud without the
  // meteorological baseline and never enters the magnetic hypothesis term.
  return 0.7 + 0.3 * result.ccnActivationPotential;
}
