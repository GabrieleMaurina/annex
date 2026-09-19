import { useMemo } from 'react';
import { playerColor } from '../../../../lib/palette';
import { formatLogEntriesWithFrames } from '../../../logFormat';
import { replayPlayerCounts } from '../../../replay';
import type { GameMapProps } from '../../props';
import type { useGameSocketEvents } from '../useGameSocketEvents';

type Replay = ReturnType<typeof useGameSocketEvents>['replay'];

export function useDisplayedGame({
  game,
  players,
  ownership,
  seas,
  results,
  roundNumber,
  turnPhase,
  turnPlayerIndex,
  toxinTerritories,
  radiationTerritoryIds,
  radiationUpcomingTerritoryIds,
  visibleTerritoryIds,
  logs,
  showReplay,
  replay,
}: Pick<
  GameMapProps,
  | 'game'
  | 'players'
  | 'ownership'
  | 'seas'
  | 'results'
  | 'roundNumber'
  | 'turnPhase'
  | 'turnPlayerIndex'
  | 'toxinTerritories'
  | 'radiationTerritoryIds'
  | 'radiationUpcomingTerritoryIds'
  | 'visibleTerritoryIds'
  | 'logs'
  | 'showReplay'
> & { replay: Replay }) {
  const {
    index: replayIndex,
    territories: replayTerritories,
    toxinTerritories: replayToxinTerritories,
    radiationTerritories: replayRadiationTerritories,
    radiationUpcoming: replayRadiationUpcoming,
    seas: replaySeas,
    hands: replayHands,
    playerStates: replayPlayerStates,
    log: replayLog,
    turnPhase: replayTurnPhase,
    roundNumber: replayRoundNumber,
    turnPlayerId: replayTurnPlayerId,
  } = replay;

  const currentTurnPlayer = players[turnPlayerIndex];
  const isCapitalById = new Map(ownership.map((o) => [o.id, o.isCapital]));
  const displayedOwnership = replayTerritories
    ? replayTerritories.map((t) => ({
        ...t,
        isCapital: isCapitalById.get(t.id) ?? false,
      }))
    : ownership;
  const displayedSeas = replaySeas ?? seas;
  const ownerById = useMemo(
    () => new Map(displayedOwnership.map((o) => [o.id, o])),
    [displayedOwnership],
  );
  const replayCounts =
    showReplay && replayTerritories
      ? replayPlayerCounts(
          replayTerritories,
          replayHands ?? [],
          new Set(
            displayedOwnership.filter((o) => o.isCapital).map((o) => o.id),
          ),
        )
      : null;
  const replayStateById =
    showReplay && replayPlayerStates && replayPlayerStates.length > 0
      ? new Map(replayPlayerStates.map((s) => [s.playerId, s]))
      : null;
  const displayedPlayers = replayCounts
    ? players.map((p) => {
        const state = replayStateById?.get(p.id);
        return {
          ...p,
          territoryCount: 0,
          troopCount: 0,
          capitalCount: 0,
          cardCount: 0,
          ...replayCounts.get(p.id),
          ...(state
            ? {
                eliminated: state.eliminated,
                surrendered: state.surrendered,
                playersKilled: state.killedPlayerIds,
              }
            : {}),
        };
      })
    : players;
  const playersWithAccounts = displayedPlayers.map((p) => ({
    ...p,
    userId: results?.get(p.id)?.userId ?? p.userId,
  }));
  const panelRoundNumber =
    showReplay && replayRoundNumber !== null ? replayRoundNumber : roundNumber;
  const panelTurnPhase =
    showReplay && replayTurnPhase !== null ? replayTurnPhase : turnPhase;
  const panelTurnPlayerId =
    showReplay && replayTurnPlayerId !== null
      ? replayTurnPlayerId
      : (currentTurnPlayer?.id ?? null);
  const displayedToxinTerritories = replayToxinTerritories ?? toxinTerritories;
  const toxinById = useMemo(
    () => new Set(displayedToxinTerritories.map((t) => t.id)),
    [displayedToxinTerritories],
  );
  const displayedRadiationTerritories =
    replayRadiationTerritories ?? radiationTerritoryIds;
  const radiationById = useMemo(
    () => new Set(displayedRadiationTerritories),
    [displayedRadiationTerritories],
  );
  const radiationUpcomingById = useMemo(
    () =>
      new Set(
        (showReplay
          ? (replayRadiationUpcoming ?? [])
          : radiationUpcomingTerritoryIds
        ).filter((id) => !radiationById.has(id)),
      ),
    [
      showReplay,
      replayRadiationUpcoming,
      radiationUpcomingTerritoryIds,
      radiationById,
    ],
  );
  const unusableTerritoryById = useMemo(
    () => new Set([...toxinById, ...radiationById]),
    [toxinById, radiationById],
  );
  const antiNukeById = useMemo(
    () => new Set(showReplay ? [] : game.antiNukeTerritoryIds),
    [showReplay, game.antiNukeTerritoryIds],
  );
  const visibleTerritoryById = useMemo(
    () => (visibleTerritoryIds ? new Set(visibleTerritoryIds) : null),
    [visibleTerritoryIds],
  );

  const replayPlayer = players.find((p) => p.id === replayTurnPlayerId);
  const replayPlayerColor = replayPlayer
    ? playerColor(replayPlayer.color)
    : '#ffffff';

  const replayActingId = showReplay ? replayTurnPlayerId : null;
  const replayHandCards =
    replayActingId !== null
      ? ((replayHands ?? []).find((h) => h.playerId === replayActingId)
          ?.cards ?? [])
      : [];
  const replayActingOwnedIds =
    replayActingId !== null && replayTerritories
      ? new Set(
          replayTerritories
            .filter((t) => t.ownerId === replayActingId)
            .map((t) => t.id),
        )
      : new Set<number>();
  const replayActingState =
    replayActingId !== null
      ? (replayPlayerStates ?? []).find((s) => s.playerId === replayActingId)
      : undefined;
  const replayFormattedLog = useMemo(
    () =>
      showReplay && replayLog
        ? formatLogEntriesWithFrames(
            replayLog,
            players.map((p) => ({
              id: p.id,
              name: p.name,
              color: p.color,
              isBot: p.isBot,
            })),
          )
        : null,
    [showReplay, replayLog, players],
  );
  const displayedLogs = replayFormattedLog
    ? replayFormattedLog.filter((l) => l.afterFrame <= replayIndex)
    : logs;
  const nukesGame = showReplay
    ? {
        ...game,
        arsenal: {
          nukes: replayActingState?.nukes ?? 0,
          antiNukes: replayActingState?.antiNukes ?? 0,
        },
        nukeProjects: replayActingState?.nukeProjects ?? [],
        roundNumber: panelRoundNumber,
        troopsToDeploy: 0,
      }
    : game;

  return {
    ownerById,
    displayedSeas,
    displayedPlayers,
    playersWithAccounts,
    panelRoundNumber,
    panelTurnPhase,
    panelTurnPlayerId,
    displayedToxinTerritories,
    toxinById,
    radiationById,
    radiationUpcomingById,
    unusableTerritoryById,
    antiNukeById,
    visibleTerritoryById,
    replayPlayer,
    replayPlayerColor,
    replayHandCards,
    replayActingOwnedIds,
    displayedLogs,
    nukesGame,
  };
}
