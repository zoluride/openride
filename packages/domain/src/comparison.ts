import { calculateDailyDeduction } from './subscription';

export interface CompetitorComparison {
  zoluFeeKobo: number;
  zoluNetKobo: number;
  uberNetKobo: number;
  boltNetKobo: number;
  savingsVsUberKobo: number;
  savingsVsBoltKobo: number;
}

export function calculateCompetitorComparison(grossKobo: number): CompetitorComparison {
  const zoluFeeKobo = calculateDailyDeduction(grossKobo);
  const zoluNetKobo = grossKobo - zoluFeeKobo;
  const uberNetKobo = Math.round(grossKobo * 0.75);
  const boltNetKobo = Math.round(grossKobo * 0.8);

  return {
    zoluFeeKobo,
    zoluNetKobo,
    uberNetKobo,
    boltNetKobo,
    savingsVsUberKobo: zoluNetKobo - uberNetKobo,
    savingsVsBoltKobo: zoluNetKobo - boltNetKobo,
  };
}