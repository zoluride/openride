export const STABILISATION_GROSS_TARGET_KOBO = 2_000_000;
export const STABILISATION_MAX_TOP_UP_KOBO = 300_000;

export function calculateTopUp(
  grossEarningsKobo: number,
  hoursOnline: number,
  tripsCompleted: number,
): number {
  if (hoursOnline < 10 || tripsCompleted < 8 || grossEarningsKobo >= STABILISATION_GROSS_TARGET_KOBO) {
    return 0;
  }

  return Math.min(STABILISATION_GROSS_TARGET_KOBO - grossEarningsKobo, STABILISATION_MAX_TOP_UP_KOBO);
}
