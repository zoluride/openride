export function calculateTopUp(
  grossEarnings: number,
  hoursOnline: number,
  tripsCompleted: number,
): number {
  if (hoursOnline < 10 || tripsCompleted < 8 || grossEarnings >= 20000) {
    return 0;
  }

  return Math.min(20000 - grossEarnings, 3000);
}
