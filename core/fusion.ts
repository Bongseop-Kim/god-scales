export function canFuse(
  favor: Record<string, number>,
  uses: Record<string, number>,
  pair: readonly [string, string],
): boolean {
  return pair.every((god) => (favor[god] ?? 0) >= 70 && (uses[god] ?? 0) >= 2);
}
