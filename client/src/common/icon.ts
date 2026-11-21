import { useCallback, useEffect, useState } from 'react';

const BLACK = /#000(?:000)?\b|\bblack\b/gi;

function toWhite(svg: string): string {
  return svg.replace(BLACK, '#ffffff');
}

const whiteIconCache = new Map<string, Promise<string>>();

export function loadWhiteIcon(path: string): Promise<string> {
  let promise = whiteIconCache.get(path);
  if (!promise) {
    promise = fetch(path)
      .then((res) => res.text())
      .then((svg) => `data:image/svg+xml,${encodeURIComponent(toWhite(svg))}`);
    whiteIconCache.set(path, promise);
  }
  return promise;
}

export function useWhiteIcon(path: string): string | undefined {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    loadWhiteIcon(path).then(setSrc);
  }, [path]);
  return src;
}

export type BotIcon = (isZombie: boolean | undefined, light: boolean) => string;

export function botLabel(isZombie: boolean | undefined): string {
  return isZombie ? 'Zombies' : 'Bot';
}

export function useBotIcon(): BotIcon {
  const whiteBot = useWhiteIcon('/icons/bot.svg');
  const whiteZombie = useWhiteIcon('/icons/zombie.svg');
  return useCallback(
    (isZombie, light) => {
      const path = isZombie ? '/icons/zombie.svg' : '/icons/bot.svg';
      if (!light) return path;
      return (isZombie ? whiteZombie : whiteBot) ?? path;
    },
    [whiteBot, whiteZombie],
  );
}
