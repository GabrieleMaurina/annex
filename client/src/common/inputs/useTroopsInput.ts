import { useSyncExternalStore, type ChangeEvent, type RefObject } from 'react';
import {
  isTroopsPercentage,
  subscribeTroopsPercentage,
} from '../../lib/player';
import { useNumberInput } from './useNumberInput';

const PERCENTAGE_THRESHOLD = 100;

interface Options {
  value: number;
  min: number;
  max: number;
  onChange: (troops: number) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function canUsePercentage(max: number): boolean {
  return max > PERCENTAGE_THRESHOLD;
}

export function useTroopsPercentage(): boolean {
  return useSyncExternalStore(subscribeTroopsPercentage, isTroopsPercentage);
}

function troopsScale(min: number, max: number, percentage: boolean) {
  if (!percentage || !canUsePercentage(max))
    return {
      min,
      max,
      toShown: (troops: number) => troops,
      toTroops: (shown: number) => shown,
    };
  const shownMin = Math.ceil((min * 100) / max);
  return {
    min: shownMin,
    max: 100,
    toShown: (troops: number) =>
      troops <= min
        ? shownMin
        : troops >= max
          ? 100
          : Math.min(
              99,
              Math.max(shownMin + 1, Math.round((troops * 100) / max)),
            ),
    toTroops: (shown: number) =>
      shown <= shownMin ? min : Math.min(max, Math.round((shown * max) / 100)),
  };
}

export function stepTroops(
  troops: number,
  delta: number,
  min: number,
  max: number,
): number {
  const scale = troopsScale(min, max, isTroopsPercentage());
  return scale.toTroops(
    Math.min(scale.max, Math.max(scale.min, scale.toShown(troops) + delta)),
  );
}

export function useTroopsInput({
  value,
  min,
  max,
  onChange,
  inputRef,
}: Options) {
  const scale = troopsScale(min, max, useTroopsPercentage());
  const shown = scale.toShown(value);
  const numberInput = useNumberInput({
    value: shown,
    min: scale.min,
    max: scale.max,
    onChange: (next) => onChange(scale.toTroops(next)),
    inputRef,
  });
  return {
    min: scale.min,
    max: scale.max,
    value: shown,
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      onChange(
        scale.toTroops(
          Math.min(
            scale.max,
            Math.max(scale.min, Number(e.target.value) || scale.min),
          ),
        ),
      ),
    ...numberInput,
  };
}
