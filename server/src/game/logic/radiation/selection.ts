import { Territory } from '../../../types';

export function selectRadiationTerritories(
  territories: Territory[],
  n: number,
): number[] {
  const totalCount = territories.length;
  const idToIndex = new Map(territories.map((t, i) => [t.id, i]));

  const adjacency: Int32Array[] = territories.map((t) => {
    const neighborIndices = new Set(
      t.neighbors.map((nb) => idToIndex.get(nb)!),
    );
    return Int32Array.from(neighborIndices);
  });

  const continentOf = new Int32Array(territories.map((t) => t.continentId));

  const removed = new Uint8Array(totalCount);
  const dist = new Int16Array(totalCount);
  const queue = new Int32Array(totalCount);
  const fullDist = new Int16Array(totalCount * totalCount);
  const isInternal = new Uint8Array(totalCount * totalCount);

  function rebuildRow(startIdx: number): void {
    dist.fill(-1);
    dist[startIdx] = 0;
    queue[0] = startIdx;
    let head = 0;
    let tail = 1;
    const base = startIdx * totalCount;
    isInternal.fill(0, base, base + totalCount);
    while (head < tail) {
      const current = queue[head++];
      const currentDist = dist[current];
      const neighbors = adjacency[current];
      for (let k = 0; k < neighbors.length; k++) {
        const next = neighbors[k];
        if (removed[next] || dist[next] !== -1) continue;
        dist[next] = currentDist + 1;
        isInternal[base + current] = 1;
        queue[tail++] = next;
      }
    }
    fullDist.set(dist, base);
  }

  function bfsSumExcluding(
    startIdx: number,
    extraExcluded: number,
    activeCount: number,
  ): number {
    dist.fill(-1);
    dist[startIdx] = 0;
    queue[0] = startIdx;
    let head = 0;
    let tail = 1;
    let sum = 0;
    while (head < tail) {
      const current = queue[head++];
      const currentDist = dist[current];
      const neighbors = adjacency[current];
      for (let k = 0; k < neighbors.length; k++) {
        const next = neighbors[k];
        if (removed[next] || next === extraExcluded || dist[next] !== -1)
          continue;
        const d = currentDist + 1;
        dist[next] = d;
        if (next > startIdx) sum += d;
        queue[tail++] = next;
      }
    }
    const expectedReachable = activeCount - 2;
    return tail - 1 < expectedReachable ? -1 : sum;
  }

  function computeNC(v: number): number {
    const neighborContinents = new Set<number>();
    for (const nb of adjacency[v]) {
      if (removed[nb]) continue;
      const c = continentOf[nb];
      if (c !== continentOf[v]) neighborContinents.add(c);
    }
    return neighborContinents.size;
  }

  function minMaxNormalize(values: number[]): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return values.map((v) => (max === min ? 0 : (v - min) / (max - min)));
  }

  function weightedRandomPick(candidates: number[], weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0)
      return candidates[Math.floor(Math.random() * candidates.length)];
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  for (let i = 0; i < totalCount; i++) rebuildRow(i);
  const ncCache = new Int32Array(totalCount);
  for (let i = 0; i < totalCount; i++) ncCache[i] = computeNC(i);

  const selectedIndices: number[] = [];

  for (let iter = 0; iter < n; iter++) {
    const active: number[] = [];
    for (let i = 0; i < totalCount; i++) if (!removed[i]) active.push(i);
    const m = active.length;

    const upperRowSum = new Float64Array(totalCount);
    const fullRowSum = new Float64Array(totalCount);
    let baselineTotalSum = 0;
    for (const i of active) {
      let upper = 0;
      let full = 0;
      for (const j of active) {
        if (j === i) continue;
        const d = fullDist[i * totalCount + j];
        full += d;
        if (j > i) upper += d;
      }
      upperRowSum[i] = upper;
      fullRowSum[i] = full;
      baselineTotalSum += upper;
    }
    const baselineTotalCount = (m * (m - 1)) / 2;

    const rawVV = new Map<number, number>();

    for (const v of active) {
      const baselineCount = baselineTotalCount - (m - 1);
      const baseline =
        baselineCount === 0
          ? 0
          : (baselineTotalSum - fullRowSum[v]) / baselineCount;

      let sum = 0;
      let disconnected = false;
      for (const i of active) {
        if (i === v) continue;
        if (!isInternal[i * totalCount + v]) {
          sum += upperRowSum[i] - (v > i ? fullDist[i * totalCount + v] : 0);
          continue;
        }
        const rowSumWithoutV = bfsSumExcluding(i, v, m);
        if (rowSumWithoutV === -1) {
          disconnected = true;
          break;
        }
        sum += rowSumWithoutV;
      }

      const pairCount = ((m - 1) * (m - 2)) / 2;
      rawVV.set(v, disconnected ? -1 : sum / pairCount - baseline);
    }

    const candidates = active.filter((v) => {
      const vv = rawVV.get(v)!;
      return vv !== -1 && vv !== 0;
    });
    if (candidates.length === 0) break;

    const vvNorm = minMaxNormalize(candidates.map((v) => rawVV.get(v)!));
    const ncNorm = minMaxNormalize(candidates.map((v) => ncCache[v]));
    const weights = candidates.map((_, i) => vvNorm[i] + ncNorm[i]);

    const chosen = weightedRandomPick(candidates, weights);

    selectedIndices.push(chosen);
    removed[chosen] = 1;

    for (const i of active) {
      if (i === chosen) continue;
      if (isInternal[i * totalCount + chosen]) rebuildRow(i);
    }
    for (const nb of adjacency[chosen]) {
      if (!removed[nb]) ncCache[nb] = computeNC(nb);
    }
  }

  return selectedIndices.map((idx) => territories[idx].id);
}
