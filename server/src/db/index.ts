import { ensureEmailConfirmations } from './emailConfirmations';
import { ensureFriendships } from './friendships';
import { ensureGames } from './games';
import { ensureMapLikes } from './maps/mapLikes';
import { ensureMapReports } from './maps/mapReports';
import { ensurePlayerMaps } from './maps/playerMaps';
import { ensureReplayMaps } from './maps/replayMaps';
import { ensureMessages } from './messages';
import { connect, getDb } from './mongo';
import { ensurePasswordResets } from './passwordResets';
import { ensurePictureReports } from './pictureReports';
import { ensureSessions } from './sessions';
import { ensureUsers } from './users';

function renameLegacyCollections(): Promise<void> {
  const db = getDb();
  return db
    .listCollections({}, { nameOnly: true })
    .toArray()
    .then((infos) => {
      const names = new Set(infos.map((info) => info.name));
      if (!names.has('maps')) return undefined;
      if (names.has('replay_maps')) {
        console.log('maps rename skipped: replay_maps already exists');
        return undefined;
      }
      return db
        .renameCollection('maps', 'replay_maps')
        .then(() => console.log('renamed maps collection to replay_maps'))
        .catch(() =>
          db
            .listCollections({ name: 'replay_maps' }, { nameOnly: true })
            .toArray()
            .then((found) => {
              if (found.length === 0) throw new Error('maps rename failed');
              console.log('maps rename skipped: replay_maps already exists');
            }),
        );
    });
}

export function connectDb(): Promise<void> {
  return connect()
    .then(renameLegacyCollections)
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
