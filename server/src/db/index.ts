import { ensureEmailConfirmations } from './emailConfirmations';
import { connect } from './mongo';
import { ensurePasswordResets } from './passwordResets';
import { ensureSessions } from './sessions';
import { ensureUsers } from './users';

export function connectDb(): Promise<void> {
  return connect()
    .then(() =>
      Promise.all([
        ensureUsers(),
        ensureSessions(),
        ensureEmailConfirmations(),
        ensurePasswordResets(),
      ]),
    )
    .then(() => {
      console.log('connected to mongodb');
    });
}

export * from './emailConfirmations';
export * from './passwordResets';
export * from './sessions';
export * from './users';
