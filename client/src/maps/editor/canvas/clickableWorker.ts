import {
  labelRegions,
  type RegionPoint,
} from '../../../game/regions/labelRegions';

export interface ClickableRequest {
  image: ImageData;
  points: RegionPoint[];
  borderColors: string[];
}

export interface ClickableReply {
  labels: Int16Array;
  invalidIds: number[];
}

self.addEventListener('message', (event: MessageEvent<ClickableRequest>) => {
  const { image, points, borderColors } = event.data;
  const { labels, invalidIds } = labelRegions(image, points, borderColors);
  const reply: ClickableReply = { labels, invalidIds: [...invalidIds] };
  self.postMessage(reply, { transfer: [labels.buffer] });
});
