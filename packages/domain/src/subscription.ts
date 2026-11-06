const FREE_DAY_THRESHOLD_KOBO = 400_000;
const BAND_SIZE_KOBO = 300_000;
const BAND_DEDUCTION_KOBO = 50_000;
const DAILY_DEDUCTION_CAP_KOBO = 150_000;

export function calculateDailyDeduction(grossKobo: number): number {
  if (grossKobo < FREE_DAY_THRESHOLD_KOBO) {
    return 0;
  }

  const deduction =
    BAND_DEDUCTION_KOBO * (1 + Math.floor((grossKobo - FREE_DAY_THRESHOLD_KOBO) / BAND_SIZE_KOBO));
  return Math.min(deduction, DAILY_DEDUCTION_CAP_KOBO);
}

export function remainingCapForDay(alreadyDeductedKobo: number): number {
  return Math.max(0, DAILY_DEDUCTION_CAP_KOBO - alreadyDeductedKobo);
}

export function isFreeDay(grossKobo: number): boolean {
  return grossKobo < FREE_DAY_THRESHOLD_KOBO;
}

export function calculateSubscriptionFee(grossEarnings: number): number {
  return calculateDailyDeduction(grossEarnings * 100) / 100;
}
