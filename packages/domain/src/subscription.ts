export function calculateSubscriptionFee(grossEarnings: number): number {
  if (grossEarnings < 4000) {
    return 0;
  }
  if (grossEarnings >= 4000 && grossEarnings < 7000) {
    return 500;
  }
  if (grossEarnings >= 7000 && grossEarnings < 10000) {
    return 1000;
  }
  return 1500;
}
