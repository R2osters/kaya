/**
 * Rounds to two decimals the same way the Flutter code did
 * (`double.parse(value.toStringAsFixed(2))`), so client-side previews match
 * the amounts the backend ledger records to the cent.
 */
export function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}
