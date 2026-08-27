import type { GameState } from '../lib/types';
import type { Territory } from './mapData';
import { buildWrappedPathSegments, type Point } from './mapMath';
import { withPortalEdges } from './portals';

type OwnerById = Map<number, GameState['territories'][number]>;

export interface RailEdge {
  fromId: number;
  toId: number;
}

function wrappedDistance(
  a: Territory,
  b: Territory,
  mapW: number,
  mapH: number,
): number {
  const dxRaw = Math.abs(a.x - b.x);
  const dyRaw = Math.abs(a.y - b.y);
  const dx = Math.min(dxRaw, mapW - dxRaw);
  const dy = Math.min(dyRaw, mapH - dyRaw);
  return Math.hypot(dx, dy);
}

function territoryClusters(
  ownedIds: number[],
  territoryById: Map<number, Territory>,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
): number[][] {
  const ownedSet = new Set(ownedIds);
  const visited = new Set<number>();
  const clusters: number[][] = [];
  for (const start of ownedIds) {
    if (visited.has(start)) continue;
    const cluster: number[] = [];
    const queue = [start];
    visited.add(start);
    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);
      const neighbors = withPortalEdges(
        territoryById.get(current)?.neighbors ?? [],
        current,
        portalTerritoryIds,
        portalsEnabled,
      );
      for (const n of neighbors) {
        if (visited.has(n) || !ownedSet.has(n)) continue;
        visited.add(n);
        queue.push(n);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function largestClusterHubId(
  clusters: number[][],
  ownerById: OwnerById,
): number {
  let best: {
    totalTroops: number;
    size: number;
    maxTroops: number;
    minId: number;
    hubId: number;
  } | null = null;
  for (const cluster of clusters) {
    let totalTroops = 0;
    let maxTroops = -Infinity;
    let minId = Infinity;
    let hubId = -1;
    for (const id of cluster) {
      const troops = ownerById.get(id)?.troops ?? 0;
      totalTroops += troops;
      minId = Math.min(minId, id);
      if (troops > maxTroops || (troops === maxTroops && id < hubId)) {
        maxTroops = troops;
        hubId = id;
      }
    }
    if (
      best === null ||
      totalTroops > best.totalTroops ||
      (totalTroops === best.totalTroops &&
        (cluster.length > best.size ||
          (cluster.length === best.size &&
            (maxTroops > best.maxTroops ||
              (maxTroops === best.maxTroops && minId < best.minId)))))
    ) {
      best = { totalTroops, size: cluster.length, maxTroops, minId, hubId };
    }
  }
  return best!.hubId;
}

function supplyHubIds(
  ownedIds: number[],
  ownerById: OwnerById,
  territoryById: Map<number, Territory>,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
): number[] {
  const capitals = ownedIds.filter((id) => ownerById.get(id)?.isCapital);
  if (capitals.length > 0) return capitals;
  const clusters = territoryClusters(
    ownedIds,
    territoryById,
    portalTerritoryIds,
    portalsEnabled,
  );
  if (clusters.length === 0) return [];
  return [largestClusterHubId(clusters, ownerById)];
}

function primMST(
  nodeIds: number[],
  rootId: number,
  territoryById: Map<number, Territory>,
  adjacency: Map<number, number[]>,
  mapW: number,
  mapH: number,
): RailEdge[] {
  if (nodeIds.length <= 1) return [];
  const inTree = new Set<number>();
  const key = new Map<number, number>();
  const parent = new Map<number, number>();
  for (const id of nodeIds) key.set(id, Infinity);
  key.set(rootId, 0);

  const edges: RailEdge[] = [];
  while (inTree.size < nodeIds.length) {
    let bestId = -1;
    let bestKey = Infinity;
    for (const id of nodeIds) {
      if (inTree.has(id)) continue;
      const k = key.get(id)!;
      if (k < bestKey) {
        bestKey = k;
        bestId = id;
      }
    }
    if (bestId === -1) break;
    inTree.add(bestId);
    const parentId = parent.get(bestId);
    if (parentId !== undefined) edges.push({ fromId: parentId, toId: bestId });

    const bestTerritory = territoryById.get(bestId)!;
    for (const neighborId of adjacency.get(bestId) ?? []) {
      if (inTree.has(neighborId)) continue;
      const d = wrappedDistance(
        bestTerritory,
        territoryById.get(neighborId)!,
        mapW,
        mapH,
      );
      if (d < key.get(neighborId)!) {
        key.set(neighborId, d);
        parent.set(neighborId, bestId);
      }
    }
  }
  return edges;
}

export function computeSupplyLineEdges(
  territories: Territory[],
  ownerById: OwnerById,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
  mapW: number,
  mapH: number,
): Map<number, RailEdge[]> {
  const territoryById = new Map(territories.map((t) => [t.id, t]));
  const ownedByPlayer = new Map<number, number[]>();
  for (const [id, owner] of ownerById) {
    const list = ownedByPlayer.get(owner.ownerId);
    if (list) list.push(id);
    else ownedByPlayer.set(owner.ownerId, [id]);
  }

  const result = new Map<number, RailEdge[]>();
  for (const [playerId, ownedIds] of ownedByPlayer) {
    const ownedSet = new Set(ownedIds);
    const hubIds = supplyHubIds(
      ownedIds,
      ownerById,
      territoryById,
      portalTerritoryIds,
      portalsEnabled,
    );
    const globalVisited = new Set<number>();
    const edges: RailEdge[] = [];
    for (const hubId of hubIds) {
      if (globalVisited.has(hubId)) continue;
      const component: number[] = [hubId];
      const adjacency = new Map<number, number[]>();
      const visited = new Set<number>([hubId]);
      const queue = [hubId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        const ownedNeighbors = withPortalEdges(
          territoryById.get(current)?.neighbors ?? [],
          current,
          portalTerritoryIds,
          portalsEnabled,
        ).filter((n) => ownedSet.has(n));
        adjacency.set(current, ownedNeighbors);
        for (const n of ownedNeighbors) {
          if (visited.has(n)) continue;
          visited.add(n);
          component.push(n);
          queue.push(n);
        }
      }
      for (const id of component) globalVisited.add(id);
      edges.push(
        ...primMST(component, hubId, territoryById, adjacency, mapW, mapH),
      );
    }
    result.set(playerId, edges);
  }
  return result;
}

export function computeSupplyConnectedTerritoryIds(
  territories: Territory[],
  ownerById: OwnerById,
  playerId: number,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
): Set<number> {
  const territoryById = new Map(territories.map((t) => [t.id, t]));
  const ownedIds: number[] = [];
  for (const [id, owner] of ownerById) {
    if (owner.ownerId === playerId) ownedIds.push(id);
  }
  const ownedSet = new Set(ownedIds);
  const hubIds = supplyHubIds(
    ownedIds,
    ownerById,
    territoryById,
    portalTerritoryIds,
    portalsEnabled,
  );

  const visited = new Set<number>(hubIds);
  const queue = [...hubIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = withPortalEdges(
      territoryById.get(current)?.neighbors ?? [],
      current,
      portalTerritoryIds,
      portalsEnabled,
    );
    for (const n of neighbors) {
      if (visited.has(n) || !ownedSet.has(n)) continue;
      visited.add(n);
      queue.push(n);
    }
  }
  return visited;
}

const RAIL_OFFSET = 2;
const RAIL_WIDTH = 0.8;
const RAIL_OUTLINE_COLOR = '#4a4d52';
const RAIL_COLOR = '#c9cdd2';
const SLEEPER_SPACING = 6;
const SLEEPER_HALF_LENGTH = 4;
const SLEEPER_HALF_THICKNESS = 0.9;
const SLEEPER_COLOR = '#7a4a26';
const SLEEPER_STROKE = '#4a2c16';

function drawSleeper(
  ctx: CanvasRenderingContext2D,
  center: Point,
  ux: number,
  uy: number,
  px: number,
  py: number,
  halfLength: number,
  halfThickness: number,
) {
  ctx.beginPath();
  ctx.moveTo(
    center.x + px * halfLength - ux * halfThickness,
    center.y + py * halfLength - uy * halfThickness,
  );
  ctx.lineTo(
    center.x + px * halfLength + ux * halfThickness,
    center.y + py * halfLength + uy * halfThickness,
  );
  ctx.lineTo(
    center.x - px * halfLength + ux * halfThickness,
    center.y - py * halfLength + uy * halfThickness,
  );
  ctx.lineTo(
    center.x - px * halfLength - ux * halfThickness,
    center.y - py * halfLength - uy * halfThickness,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawRailwaySegment(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  zoom: number,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const offset = RAIL_OFFSET * zoom;
  const spacing = SLEEPER_SPACING * zoom;
  const sleeperHalfLength = SLEEPER_HALF_LENGTH * zoom;
  const sleeperHalfThickness = SLEEPER_HALF_THICKNESS * zoom;

  ctx.save();
  ctx.fillStyle = SLEEPER_COLOR;
  ctx.strokeStyle = SLEEPER_STROKE;
  ctx.lineWidth = Math.max(1, zoom);
  const sleeperCount = Math.max(1, Math.round(len / spacing));
  for (let i = 0; i <= sleeperCount; i++) {
    const t = i / sleeperCount;
    drawSleeper(
      ctx,
      { x: a.x + dx * t, y: a.y + dy * t },
      ux,
      uy,
      px,
      py,
      sleeperHalfLength,
      sleeperHalfThickness,
    );
  }

  for (const [color, width] of [
    [RAIL_OUTLINE_COLOR, RAIL_WIDTH * zoom + zoom],
    [RAIL_COLOR, RAIL_WIDTH * zoom],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(a.x + px * offset * side, a.y + py * offset * side);
      ctx.lineTo(b.x + px * offset * side, b.y + py * offset * side);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawSupplyLines(
  ctx: CanvasRenderingContext2D,
  edgesByPlayer: Map<number, RailEdge[]>,
  territoryById: Map<number, Territory>,
  toScreen: (p: Point) => Point,
  mapW: number,
  mapH: number,
  zoom: number,
) {
  for (const edges of edgesByPlayer.values()) {
    for (const edge of edges) {
      const from = territoryById.get(edge.fromId);
      const to = territoryById.get(edge.toId);
      if (!from || !to) continue;
      const segments = buildWrappedPathSegments(
        [from, to],
        toScreen,
        mapW,
        mapH,
      );
      for (const { a, b } of segments) drawRailwaySegment(ctx, a, b, zoom);
    }
  }
}
