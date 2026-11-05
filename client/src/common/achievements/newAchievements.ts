import { httpGet } from '../../lib/http';
import type { PlayerAchievement } from '../../lib/types';

const POLL_MS = 15000;

type NewAchievementsReply =
  | { ok: true; achievements: PlayerAchievement[] }
  | { ok: false; error: string };

let listener: ((achievements: PlayerAchievement[]) => void) | null = null;

export function checkNewAchievements(): void {
  if (!listener || document.visibilityState === 'hidden') return;
  httpGet<NewAchievementsReply>('/achievements/new')
    .then((res) => {
      if (res.ok && res.achievements.length > 0) listener?.(res.achievements);
    })
    .catch(() => {});
}

export function watchNewAchievements(
  onNew: (achievements: PlayerAchievement[]) => void,
): () => void {
  listener = onNew;
  checkNewAchievements();
  const timer = setInterval(checkNewAchievements, POLL_MS);
  document.addEventListener('visibilitychange', checkNewAchievements);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', checkNewAchievements);
    if (listener === onNew) listener = null;
  };
}
