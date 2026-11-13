import { useEffect, useState } from 'react';
import { connector } from '../../connector';
import type { GameState } from '../../lib/types';
import { fetchPlayerProfile } from './playerProfile';

interface PlayerProfile {
  hasProfile: boolean;
  picture: string | null;
  bio: string;
}

export function usePlayerProfile(
  player: GameState['players'][number],
  live: boolean,
  enabled = true,
): PlayerProfile {
  const [picture, setPicture] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const userId = player.userId ?? null;
  const hasProfile =
    enabled && !player.isBot && (!live || !connector.isOffline());
  useEffect(() => {
    if (!hasProfile) return;
    let stale = false;
    if (live) {
      connector.getPlayerProfileInGame(player.id, (res) => {
        if (stale || !res.ok) return;
        setPicture(res.picture);
        setBio(res.bio);
      });
    } else if (userId !== null) {
      fetchPlayerProfile(userId, (storedPicture, storedBio) => {
        if (stale) return;
        setPicture(storedPicture);
        setBio(storedBio);
      });
    }
    return () => {
      stale = true;
    };
  }, [hasProfile, live, player.id, userId]);
  return hasProfile
    ? { hasProfile, picture, bio }
    : { hasProfile, picture: null, bio: '' };
}
