export function withPortalEdges(
  neighbors: number[],
  territoryId: number,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
): number[] {
  if (!portalsEnabled || portalTerritoryIds.length < 2) return neighbors;
  if (!portalTerritoryIds.includes(territoryId)) return neighbors;
  return [
    ...neighbors,
    ...portalTerritoryIds.filter((id) => id !== territoryId),
  ];
}
