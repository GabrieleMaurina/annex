import {
  DAY_MS,
  effectiveReputation,
  REPORT_REASONS,
  ReportReason,
} from 'engine';
import { ObjectId } from 'mongodb';
import {
  clearBioIfEquals,
  consumeReports,
  countGamesPlayed,
  countReportsBy,
  findUserById,
  getGameReportInfo,
  getUserBio,
  getUserPicture,
  hasRecentProfileReport,
  insertPlayerReport,
  listOpenReports,
  markPictureDangerous,
  OpenPlayerReport,
  ReportSource,
} from '../db';
import { gameParticipants, startedGameId } from '../elo';
import { userIdByPlayerId } from '../sockets/socketRooms';
import { isInteger } from '../validate';
import { createKeyedQueue } from './keyedQueue';
import { addReputation } from './reputation';

export type ReportResult = { ok: true } | { ok: false; error: string };

const REPORT_PENALTIES: Record<ReportReason, number> = {
  collusion: 20,
  'stream sniping': 20,
  'verbal abuse': 15,
  'fake botting': 10,
  stalling: 5,
  'offensive picture': 15,
  'offensive text': 15,
};

const EVIDENCE_DAYS = 30;
const MIN_REPORTERS = 3;
const MIN_EVIDENCE = 3;
const EVIDENCE_TOLERANCE = 1e-9;
const FULL_WEIGHT_ACCOUNT_DAYS = 30;
const FULL_WEIGHT_GAMES = 20;
const FULL_WEIGHT_DAILY_REPORTS = 2;
const ZERO_WEIGHT_DAILY_REPORTS = 6;
const FULL_WEIGHT_MONTHLY_REPORTS = 30;
const ZERO_WEIGHT_MONTHLY_REPORTS = 60;
const PROFILE_REPORT_FACTOR = 0.5;
const SPAM_PENALTY = 1;

interface WeightedReport {
  id: string;
  reporterId: string;
  weight: number;
}

interface ReportGame {
  gameId: string;
  userIds: string[];
  endedAt: number | null;
}

interface ReportableGame {
  gameId: string;
  participants: Map<number, string>;
  seatIds: Set<number>;
  endedAt: number | null;
}

const enqueueFiling = createKeyedQueue();

const reportableByGame = new Map<string, ReportableGame>();

export function rememberReportableGame(game: {
  name: string;
  players: { id: number }[];
}): void {
  const gameId = startedGameId(game.name);
  if (gameId === undefined) return;
  reportableByGame.set(game.name, {
    gameId,
    participants: gameParticipants(game.name),
    seatIds: new Set(game.players.map((player) => player.id)),
    endedAt: null,
  });
}

export function endReportableGame(gameName: string): void {
  const game = reportableByGame.get(gameName);
  if (game) game.endedAt = Date.now();
}

export function reconcileReportableGames(existing: Set<string>): void {
  for (const name of [...reportableByGame.keys()]) {
    if (!existing.has(name)) reportableByGame.delete(name);
  }
}

const enqueueEvaluation = createKeyedQueue();

function volumeFactor(reports: number, full: number, zero: number): number {
  return Math.min(1, Math.max(0, (zero - reports) / (zero - full)));
}

function reporterFactor(reporterId: string, now: number): Promise<number> {
  return Promise.all([
    findUserById(reporterId),
    countGamesPlayed(reporterId),
    countReportsBy(reporterId, now - EVIDENCE_DAYS * DAY_MS, now),
  ]).then(([user, games, monthReports]) => {
    if (
      !user ||
      effectiveReputation(user.reputation, user.reputationRecoveryFrom, now) < 0
    )
      return 0;
    const ageDays = (now - user.createdAt) / DAY_MS;
    const newAccountFactor = Math.min(
      1,
      ageDays / FULL_WEIGHT_ACCOUNT_DAYS,
      games / FULL_WEIGHT_GAMES,
    );
    const monthFactor = volumeFactor(
      monthReports,
      FULL_WEIGHT_MONTHLY_REPORTS,
      ZERO_WEIGHT_MONTHLY_REPORTS,
    );
    return newAccountFactor * monthFactor;
  });
}

function isContentReason(reason: string): boolean {
  return reason === 'offensive picture' || reason === 'offensive text';
}

function sourceFactor(source: ReportSource, reason: string): number {
  return source === 'game' || isContentReason(reason)
    ? 1
    : PROFILE_REPORT_FACTOR;
}

function weighReport(
  report: OpenPlayerReport,
  reason: string,
  reporterWeight: number,
): Promise<WeightedReport> {
  const dayStart = Math.floor(report.createdAt / DAY_MS) * DAY_MS;
  return countReportsBy(report.reporterId, dayStart, dayStart + DAY_MS).then(
    (dayReports) => ({
      id: report.id,
      reporterId: report.reporterId,
      weight:
        reporterWeight *
        volumeFactor(
          dayReports,
          FULL_WEIGHT_DAILY_REPORTS,
          ZERO_WEIGHT_DAILY_REPORTS,
        ) *
        sourceFactor(report.source, reason),
    }),
  );
}

function weighReports(
  reports: OpenPlayerReport[],
  reason: string,
  now: number,
): Promise<WeightedReport[]> {
  const reporterIds = [...new Set(reports.map((report) => report.reporterId))];
  return Promise.all(reporterIds.map((id) => reporterFactor(id, now))).then(
    (factors) => {
      const factorByReporter = new Map(
        reporterIds.map((id, index) => [id, factors[index]]),
      );
      return Promise.all(
        reports.map((report) =>
          weighReport(report, reason, factorByReporter.get(report.reporterId)!),
        ),
      );
    },
  );
}

function evidenceOf(weights: WeightedReport[]): {
  reporters: number;
  evidence: number;
} {
  const bestByReporter = new Map<string, number>();
  for (const { reporterId, weight } of weights)
    bestByReporter.set(
      reporterId,
      Math.max(bestByReporter.get(reporterId) ?? 0, weight),
    );
  let evidence = 0;
  for (const weight of bestByReporter.values()) evidence += weight;
  return { reporters: bestByReporter.size, evidence };
}

function hideContent(
  targetId: string,
  reason: ReportReason,
  contentId: string,
): Promise<boolean> {
  return reason === 'offensive picture'
    ? markPictureDangerous(targetId, contentId)
    : clearBioIfEquals(targetId, contentId);
}

function confirmReports(
  targetId: string,
  reason: ReportReason,
  contentId: string | null,
  weights: WeightedReport[],
): Promise<void> {
  const eventId = new ObjectId().toString();
  const hidden =
    contentId === null
      ? Promise.resolve(true)
      : hideContent(targetId, reason, contentId);
  return hidden.then((flipped) => {
    if (!flipped) return;
    return consumeReports(
      weights.map(({ id, weight }) => ({ id, weight })),
      eventId,
    ).then(() =>
      addReputation(targetId, -REPORT_PENALTIES[reason], {
        reason: 'report',
        reportReason: reason,
        gameId: null,
        refId: contentId,
        eventId,
      }).then(
        () => undefined,
        (error) => console.error('failed to apply report penalty', error),
      ),
    );
  });
}

function evaluateReports(
  targetId: string,
  reason: ReportReason,
  contentId: string | null,
): Promise<void> {
  const now = Date.now();
  return listOpenReports(
    targetId,
    reason,
    contentId,
    now - EVIDENCE_DAYS * DAY_MS,
  ).then((reports) => {
    if (
      new Set(reports.map((report) => report.reporterId)).size < MIN_REPORTERS
    )
      return;
    return weighReports(reports, reason, now).then((weights) => {
      const { reporters, evidence } = evidenceOf(weights);
      if (
        reporters < MIN_REPORTERS ||
        evidence < MIN_EVIDENCE - EVIDENCE_TOLERANCE
      )
        return;
      return confirmReports(targetId, reason, contentId, weights);
    });
  });
}

function scheduleEvaluation(
  targetId: string,
  reason: ReportReason,
  contentId: string | null,
): void {
  enqueueEvaluation(targetId, () =>
    evaluateReports(targetId, reason, contentId),
  ).catch((error) => console.error('failed to evaluate reports', error));
}

function failure(error: string): ReportResult {
  return { ok: false, error };
}

function visiblePictureId(userId: string): Promise<string | null> {
  return getUserPicture(userId).then((picture) =>
    picture && !picture.dangerous ? picture.id : null,
  );
}

function reportedContentId(
  userId: string,
  reason: ReportReason,
): Promise<string | null> {
  if (reason === 'offensive picture') return visiblePictureId(userId);
  if (reason === 'offensive text')
    return getUserBio(userId).then((bio) => bio || null);
  return Promise.resolve(null);
}

function storeReport(
  reporterId: string,
  targetId: string,
  reason: ReportReason,
  gameId: string | null,
  contentId: string | null,
): Promise<ReportResult> {
  const report = {
    source: gameId === null ? ('profile' as const) : ('game' as const),
    gameId,
    pictureId: contentId,
    reporterId,
    targetId,
    reason,
  };
  const limited =
    gameId === null
      ? hasRecentProfileReport(reporterId, targetId, reason, contentId)
      : Promise.resolve(false);
  return limited
    .then((already) => (already ? false : insertPlayerReport(report)))
    .then((stored) => {
      if (!stored) return failure('already reported');
      return penaliseSpam(reporterId, gameId).then(() => {
        scheduleEvaluation(targetId, reason, contentId);
        return { ok: true };
      });
    });
}

function penaliseSpam(
  reporterId: string,
  gameId: string | null,
): Promise<void> {
  const now = Date.now();
  const dayEnd = Math.floor(now / DAY_MS) * DAY_MS + DAY_MS;
  return Promise.all([
    countReportsBy(reporterId, dayEnd - DAY_MS, dayEnd),
    countReportsBy(reporterId, now - EVIDENCE_DAYS * DAY_MS, dayEnd),
  ])
    .then(([dayReports, monthReports]) => {
      if (
        dayReports < ZERO_WEIGHT_DAILY_REPORTS &&
        monthReports < ZERO_WEIGHT_MONTHLY_REPORTS
      )
        return;
      return addReputation(reporterId, -SPAM_PENALTY, {
        reason: 'report spam',
        gameId,
      }).then(() => undefined);
    })
    .catch((error) =>
      console.error('failed to apply report spam penalty', error),
    );
}

function isReason(
  reason: unknown,
  gameReport: boolean,
): reason is ReportReason {
  return (
    typeof reason === 'string' &&
    REPORT_REASONS.some((value) => value === reason) &&
    !(gameReport && isContentReason(reason))
  );
}

function lookupAndStore(
  reporterId: string,
  targetId: string,
  reason: ReportReason,
  gameId: string | null,
): Promise<ReportResult> {
  return Promise.all([
    findUserById(targetId),
    reportedContentId(targetId, reason),
  ]).then(([user, contentId]) => {
    if (!user) return failure('user not found');
    if (isContentReason(reason) && contentId === null)
      return failure(reason === 'offensive picture' ? 'no picture' : 'no text');
    return storeReport(reporterId, targetId, reason, gameId, contentId);
  });
}

function submitReport(
  reporterId: string,
  rawTargetId: string | null,
  reason: unknown,
  game: ReportGame | null,
): Promise<ReportResult> {
  if (!isReason(reason, game !== null))
    return Promise.resolve(failure('invalid reason'));
  if (rawTargetId !== null && !ObjectId.isValid(rawTargetId))
    return Promise.resolve(failure('user not found'));
  const targetId =
    rawTargetId === null ? null : new ObjectId(rawTargetId).toString();
  if (targetId === reporterId)
    return Promise.resolve(failure('cannot report yourself'));
  if (
    game &&
    (!game.userIds.includes(reporterId) ||
      (targetId !== null && !game.userIds.includes(targetId)))
  )
    return Promise.resolve(failure('not in this game'));
  if (game && game.endedAt !== null && Date.now() - game.endedAt > DAY_MS)
    return Promise.resolve(failure('report window closed'));
  return enqueueFiling(reporterId, () =>
    targetId === null
      ? Promise.resolve<ReportResult>({ ok: true })
      : lookupAndStore(reporterId, targetId, reason, game?.gameId ?? null),
  );
}

export function fileReport(
  reporterId: string,
  targetId: unknown,
  reason: unknown,
  gameId: unknown,
): Promise<ReportResult> {
  const target = typeof targetId === 'string' ? targetId : '';
  if (gameId === undefined || gameId === null)
    return submitReport(reporterId, target, reason, null);
  if (typeof gameId !== 'string')
    return Promise.resolve(failure('game not found'));
  return getGameReportInfo(gameId).then((info) =>
    info
      ? submitReport(reporterId, target, reason, {
          gameId: new ObjectId(gameId).toString(),
          userIds: info.userIds,
          endedAt: info.endedAt,
        })
      : failure('game not found'),
  );
}

export function fileLiveGameReport(
  gameName: string | null,
  reporterId: string,
  targetPlayerId: unknown,
  reason: unknown,
  anonymous: boolean,
): Promise<ReportResult> {
  const game = gameName ? reportableByGame.get(gameName) : undefined;
  if (!game) return Promise.resolve(failure('game not found'));
  const seat = isInteger(targetPlayerId) ? targetPlayerId : null;
  const targetId = seat === null ? undefined : game.participants.get(seat);
  const disguised =
    anonymous &&
    targetId === undefined &&
    seat !== null &&
    game.seatIds.has(seat);
  if (targetId === undefined && !disguised)
    return Promise.resolve(
      failure(
        seat !== null && userIdByPlayerId(seat) === undefined
          ? 'not an account'
          : 'not in this game',
      ),
    );
  return submitReport(reporterId, targetId ?? null, reason, {
    gameId: game.gameId,
    userIds: [...game.participants.values()],
    endedAt: game.endedAt,
  }).then((result) =>
    anonymous && !result.ok && result.error === 'already reported'
      ? { ok: true }
      : result,
  );
}
