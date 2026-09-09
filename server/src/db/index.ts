import { ensureEmailConfirmations } from './emailConfirmations';
import { ensureFriendships } from './friendships';
import { ensureGames } from './games';
import { ensureMaps } from './maps';
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
        ensureMaps(),
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
export * from './maps';
export * from './messages';
export * from './passwordResets';
export * from './pictureReports';
export * from './sessions';
export * from './users';
