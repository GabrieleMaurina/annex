import { borderDistance, fillEnclosedGaps } from './regionPixels';
import { traceOutlineSvgs } from './traceRegions';

export interface ContinentOutlineInput {
  fills: Int16Array;
  width: number;
  height: number;
  isMember: Uint8Array;
  isLand: Uint8Array;
  reach: number;
}

export function continentOutlineSvg({
  fills,
  width,
  height,
  isMember,
  isLand,
  reach,
}: ContinentOutlineInput): string | null {
  const size = width * height;
  const belongs = (p: number) => fills[p] >= 0 && isMember[fills[p]] === 1;
  const memberDistance = borderDistance((p) => !belongs(p), width, size);
  const nearMember = (p: number) =>
    belongs(p) || (fills[p] < 0 && memberDistance[p] <= reach);
  const farDistance = borderDistance(nearMember, width, size);
  const labels = new Int16Array(size);
  for (let p = 0; p < size; p++) {
    if (belongs(p) || (nearMember(p) && farDistance[p] > reach)) labels[p] = 0;
    else labels[p] = fills[p] >= 0 && isLand[fills[p]] ? -2 : -1;
  }
  fillEnclosedGaps(labels, width);
  return traceOutlineSvgs(labels, width, height, Infinity).get(0) ?? null;
}
