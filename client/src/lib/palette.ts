export const PLAYER_COLORS = [
  '#E35B41',
  '#5B7CAF',
  '#38A064',
  '#F4CE4E',
  '#814C8B',
  '#F59327',
  '#3B3B3B',
  '#E8E4DF',
  '#FE9B9F',
  '#7ABCC6',
  '#966F5D',
  '#8BD37F',
  '#475AA1',
  '#C3A762',
  '#D7769D',
  '#2F6B4F',
  '#2E98A8',
  '#AC88B8',
  '#A0312F',
  '#938A34',
];

export function playerColor(colorIndex: number): string {
  return PLAYER_COLORS[colorIndex];
}

export function contrastTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

const lightenedByAmount = new Map<number, Map<string, string>>();

export function lighten(hex: string, amount: number): string {
  let lightened = lightenedByAmount.get(amount);
  if (!lightened) {
    lightened = new Map();
    lightenedByAmount.set(amount, lightened);
  }
  let result = lightened.get(hex);
  if (result === undefined) {
    result = `#${[1, 3, 5]
      .map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16);
        return Math.round(c + (255 - c) * amount)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')}`;
    lightened.set(hex, result);
  }
  return result;
}
