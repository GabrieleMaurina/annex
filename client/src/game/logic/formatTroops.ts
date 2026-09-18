export function formatTroops(troops: number): string {
  if (troops < 1000) return String(troops);
  if (troops < 10000) return `${(Math.floor(troops / 100) / 10).toFixed(1)}K`;
  if (troops < 1000000) return `${Math.floor(troops / 1000)}K`;
  return `${Math.floor(troops / 1000000)}M`;
}
