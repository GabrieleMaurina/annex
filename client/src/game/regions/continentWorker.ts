import {
  continentOutlineSvg,
  type ContinentOutlineInput,
} from './continentOutline';

interface ContinentJob extends ContinentOutlineInput {
  id: number;
}

const scope = self as unknown as {
  onmessage: ((event: { data: ContinentJob }) => void) | null;
  postMessage(message: unknown): void;
};

scope.onmessage = ({ data }) => {
  const { id, ...input } = data;
  scope.postMessage({ id, svg: continentOutlineSvg(input) });
};
