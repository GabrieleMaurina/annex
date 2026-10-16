const SPECK_AREA = 25;

function neighbors4(i: number, width: number, size: number, out: Int32Array) {
  const x = i % width;
  out[0] = x > 0 ? i - 1 : -1;
  out[1] = x + 1 < width ? i + 1 : -1;
  out[2] = i - width;
  out[3] = i + width < size ? i + width : -1;
}

export function repairSplitTerritories(
  label: ArrayLike<number>,
  seam: Uint8Array,
  width: number,
  height: number,
): void {
  const size = width * height;
  const near = new Int32Array(4);
  const around = new Int32Array(4);
  const comp = new Int32Array(size).fill(-1);
  const compArea: number[] = [];
  const compsByLabel = new Map<number, number[]>();
  const queue = new Int32Array(size);

  for (let s = 0; s < size; s++) {
    if (label[s] < 0 || seam[s] || comp[s] >= 0) continue;
    const id = compArea.length;
    const own = label[s];
    let head = 0;
    let tail = 0;
    comp[s] = id;
    queue[tail++] = s;
    while (head < tail) {
      neighbors4(queue[head++], width, size, near);
      for (const j of near) {
        if (j < 0 || comp[j] >= 0 || seam[j] || label[j] !== own) continue;
        comp[j] = id;
        queue[tail++] = j;
      }
    }
    compArea.push(tail);
    const list = compsByLabel.get(own);
    if (list) list.push(id);
    else compsByLabel.set(own, [id]);
  }

  const split = new Set<number>();
  for (const [own, ids] of compsByLabel) if (ids.length > 1) split.add(own);
  if (split.size === 0) return;

  const pixelsByLabel = new Map<number, number[]>();
  for (let i = 0; i < size; i++) {
    if (!split.has(label[i])) continue;
    const list = pixelsByLabel.get(label[i]);
    if (list) list.push(i);
    else pixelsByLabel.set(label[i], [i]);
  }

  const canCarve = (i: number, own: number, strict: boolean): boolean => {
    if (label[i] !== own) return false;
    neighbors4(i, width, size, around);
    for (const j of around) {
      if (j < 0) {
        if (strict) return false;
      } else if (label[j] !== own && (strict || !seam[j])) return false;
    }
    return true;
  };

  const visited = new Int32Array(size);
  const parent = new Int32Array(size);
  let stamp = 0;

  for (const own of split) {
    const ids = compsByLabel.get(own)!;
    const main = ids.reduce((a, b) => (compArea[b] > compArea[a] ? b : a));
    const pixels = pixelsByLabel.get(own)!;

    for (const id of ids) {
      if (id === main || compArea[id] >= SPECK_AREA) continue;
      for (const i of pixels) {
        if (comp[i] !== id) continue;
        seam[i] = 1;
        comp[i] = -1;
      }
    }

    const joined = new Set<number>([main]);
    let pending = ids.filter(
      (id) => id !== main && compArea[id] >= SPECK_AREA,
    ).length;

    for (const strict of [true, false]) {
      while (pending > 0) {
        stamp++;
        let head = 0;
        let tail = 0;
        for (const i of pixels) {
          if (seam[i] || (comp[i] >= 0 && !joined.has(comp[i]))) continue;
          visited[i] = stamp;
          parent[i] = -1;
          queue[tail++] = i;
        }
        let reached = -1;
        while (head < tail && reached < 0) {
          const i = queue[head++];
          neighbors4(i, width, size, near);
          for (const j of near) {
            if (j < 0 || visited[j] === stamp || label[j] !== own) continue;
            if (!seam[j] && comp[j] >= 0 && !joined.has(comp[j])) {
              parent[j] = i;
              reached = j;
              break;
            }
            if (!seam[j] || !canCarve(j, own, strict)) continue;
            visited[j] = stamp;
            parent[j] = i;
            queue[tail++] = j;
          }
        }
        if (reached < 0) break;

        joined.add(comp[reached]);
        pending--;
        const path: number[] = [];
        for (let p = parent[reached]; parent[p] >= 0; p = parent[p]) {
          path.push(p);
        }
        for (const p of path) {
          seam[p] = 0;
          neighbors4(p, width, size, near);
          for (const q of near) {
            if (q >= 0 && seam[q] && canCarve(q, own, true)) seam[q] = 0;
          }
        }
      }
    }
  }
}
