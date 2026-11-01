import { BLOCKS_COLLECTION } from './conduct/blocks';
import { PLAYER_REPORTS_COLLECTION } from './conduct/playerReports';
import { REPUTATION_EVENTS_COLLECTION } from './conduct/reputationEvents';
import { EMAIL_CONFIRMATIONS_COLLECTION } from './emailConfirmations';
import { FRIENDSHIPS_COLLECTION } from './friendships';
import { GAMES_COLLECTION } from './games';
import { MAP_LIKES_COLLECTION } from './maps/mapLikes';
import { MAP_REPORTS_COLLECTION } from './maps/mapReports';
import { PLAYER_MAPS_COLLECTION } from './maps/playerMaps';
import { REPLAY_MAPS_COLLECTION } from './maps/replayMaps';
import { MESSAGES_COLLECTION } from './messages';
import { CollectionSpec, connect, ensureCollection } from './mongo';
import { PASSWORD_RESETS_COLLECTION } from './passwordResets';
import { SESSIONS_COLLECTION } from './sessions';
import { USERS_COLLECTION } from './users/users';

export const COLLECTIONS: CollectionSpec[] = [
  USERS_COLLECTION,
  SESSIONS_COLLECTION,
  FRIENDSHIPS_COLLECTION,
  EMAIL_CONFIRMATIONS_COLLECTION,
  PASSWORD_RESETS_COLLECTION,
  REPLAY_MAPS_COLLECTION,
  PLAYER_MAPS_COLLECTION,
  MAP_LIKES_COLLECTION,
  MAP_REPORTS_COLLECTION,
  GAMES_COLLECTION,
  MESSAGES_COLLECTION,
  REPUTATION_EVENTS_COLLECTION,
  BLOCKS_COLLECTION,
  PLAYER_REPORTS_COLLECTION,
];

export function connectDb(): Promise<void> {
  return connect()
    .then(() => Promise.all(COLLECTIONS.map(ensureCollection)))
    .then(() => {
      console.log('connected to mongodb');
    });
}

export * from './conduct/blocks';
export * from './conduct/playerReports';
export * from './conduct/reputationEvents';
export * from './emailConfirmations';
export * from './friendships';
export * from './games';
export * from './maps/mapLikes';
export * from './maps/mapReports';
export * from './maps/playerMaps';
export * from './maps/replayMaps';
export * from './messages';
export * from './passwordResets';
export * from './sessions';
export * from './users/preferences';
export * from './users/users';
