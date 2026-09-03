export function enforceContiguity(
  labelGrid: Int16Array,
  width: number,
  height: number,
): void {
  const size = width * height;
  const visited = new Uint8Array(size);
  const stack = new Int32Array(size);
  const comps: number[][] = [];
  const compLabel: number[] = [];

  for (let start = 0; start < size; start++) {
    const label = labelGrid[start];
    if (label < 0 || visited[start]) continue;
    const cells: number[] = [];
    let sp = 0;
    stack[sp++] = start;
    visited[start] = 1;
    while (sp > 0) {
      const c = stack[--sp];
      cells.push(c);
      const x = c % width;
      if (x > 0 && !visited[c - 1] && labelGrid[c - 1] === label) {
        visited[c - 1] = 1;
        stack[sp++] = c - 1;
      }
      if (x < width - 1 && !visited[c + 1] && labelGrid[c + 1] === label) {
        visited[c + 1] = 1;
        stack[sp++] = c + 1;
      }
      if (c >= width && !visited[c - width] && labelGrid[c - width] === label) {
        visited[c - width] = 1;
        stack[sp++] = c - width;
      }
      if (
        c + width < size &&
        !visited[c + width] &&
        labelGrid[c + width] === label
      ) {
        visited[c + width] = 1;
        stack[sp++] = c + width;
      }
    }
    comps.push(cells);
    compLabel.push(label);
  }

  const largest = new Map<number, number>();
  for (let ci = 0; ci < comps.length; ci++) {
    const best = largest.get(compLabel[ci]);
    if (best === undefined || comps[ci].length > comps[best].length)
      largest.set(compLabel[ci], ci);
  }

  let orphans = 0;
  for (let ci = 0; ci < comps.length; ci++) {
    if (ci === largest.get(compLabel[ci])) continue;
    for (const c of comps[ci]) {
      labelGrid[c] = -2;
      orphans++;
    }
  }
  if (orphans === 0) return;

  const queue = new Int32Array(size);
  let qt = 0;
  for (let i = 0; i < size; i++) if (labelGrid[i] >= 0) queue[qt++] = i;
  let head = 0;
  while (head < qt) {
    const c = queue[head++];
    const label = labelGrid[c];
    const x = c % width;
    if (x > 0 && labelGrid[c - 1] === -2) {
      labelGrid[c - 1] = label;
      queue[qt++] = c - 1;
    }
    if (x < width - 1 && labelGrid[c + 1] === -2) {
      labelGrid[c + 1] = label;
      queue[qt++] = c + 1;
    }
    if (c >= width && labelGrid[c - width] === -2) {
      labelGrid[c - width] = label;
      queue[qt++] = c - width;
    }
    if (c + width < size && labelGrid[c + width] === -2) {
      labelGrid[c + width] = label;
      queue[qt++] = c + width;
    }
  }

  for (let i = 0; i < size; i++) if (labelGrid[i] === -2) labelGrid[i] = -1;
}
