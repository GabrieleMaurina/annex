import { ensureEmailConfirmations } from './emailConfirmations';
import { ensureFriendships } from './friendships';
import { ensureGames } from './games';
import { ensureMapLikes } from './maps/mapLikes';
import { ensureMapReports } from './maps/mapReports';
import { ensurePlayerMaps } from './maps/playerMaps';
import { ensureReplayMaps } from './maps/replayMaps';
import { ensureMessages } from './messages';
import { connect } from './mongo';
import { ensurePasswordResets } from './passwordResets';
import { ensurePictureReports } from './pictureReports';
import { ensureSessions } from './sessions';
import { ensureUsers } from './users';

export function connectDb(): Promise<void> {
  return connect()
    .then(() =>
      Promise.all([
        ensureUsers(),
        ensureSessions(),
        ensureFriendships(),
        ensureEmailConfirmations(),
        ensurePasswordResets(),
        ensureReplayMaps(),
        ensurePlayerMaps(),
        ensureMapLikes(),
        ensureMapReports(),
        ensureGames(),
        ensureMessages(),
        ensurePictureReports(),
      ]),
    )
    .then(() => {
      console.log('connected to mongodb');
    });
}

export * from './emailConfirmations';
export * from './friendships';
export * from './games';
export * from './maps/mapLikes';
export * from './maps/mapReports';
export * from './maps/playerMaps';
export * from './maps/replayMaps';
export * from './messages';
export * from './passwordResets';
export * from './pictureReports';
export * from './sessions';
export * from './users';
