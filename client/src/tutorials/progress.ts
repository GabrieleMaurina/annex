import { checkNewAchievements } from '../common/achievements/newAchievements';
import { httpGet, httpSend } from '../lib/http';
import type { Account } from '../lib/types';

const GUEST_KEY = 'annex.tutorialsCompleted';

type TutorialsReply =
  { ok: true; completed: string[] } | { ok: false; error: string };

function guestCompleted(): string[] {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function loadCompletedTutorials(
  account: Account | null,
): Promise<string[]> {
  if (!account) return Promise.resolve(guestCompleted());
  return httpGet<TutorialsReply>('/tutorials')
    .then((res) => (res.ok ? res.completed : []))
    .catch(() => []);
}

export function markTutorialCompleted(
  id: string,
  account: Account | null,
): void {
  if (account) {
    httpSend<TutorialsReply>('POST', '/tutorials', { id })
      .then(checkNewAchievements)
      .catch(() => {});
    return;
  }
  try {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify([...new Set([...guestCompleted(), id])]),
    );
  } catch {}
}
