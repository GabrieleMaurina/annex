import { useCallback, useEffect, useRef, useState } from 'react';
import { connector } from '../connector';
import { playerColor } from '../lib/palette';
import type { Card, GameState } from '../lib/types';

export interface LogEntry {
  id: number;
  color: string;
  text: string;
}

const NEUTRAL_LOG_COLOR = '#6c757d';

export function useGameLogs(game: GameState | null): LogEntry[] {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const gameRef = useRef<GameState | null>(null);
  useEffect(() => {
    gameRef.current = game;
  });

  const pushLog = useCallback((color: string, text: string) => {
    setLogs((prev) => [
      ...prev,
      { id: (prev.at(-1)?.id ?? 0) + 1, color, text },
    ]);
  }, []);

  const colorForPlayer = useCallback((playerId: number | undefined): string => {
    const player = gameRef.current?.players.find((p) => p.id === playerId);
    return player ? playerColor(player.color) : '#ffffff';
  }, []);

  const lastConquestAttackerIdRef = useRef<number | undefined>(undefined);
  const lastLoggedRoundNumberRef = useRef<number | null>(null);

  const logDeploy = useCallback(
    (payload: { territoryId: number; troops: number; playerId: number }) => {
      pushLog(
        colorForPlayer(payload.playerId),
        `Deployed ${payload.troops} troops to territory #${payload.territoryId + 1}`,
      );
    },
    [colorForPlayer, pushLog],
  );

  const onDeployed = logDeploy;

  const onFortified = useCallback(
    (payload: {
      territoryId: number;
      fromTerritoryId: number;
      troops: number;
      playerId: number;
    }) => {
      pushLog(
        colorForPlayer(payload.playerId),
        `Fortified ${payload.troops} troops from territory #${payload.fromTerritoryId + 1} to territory #${payload.territoryId + 1}`,
      );
    },
    [colorForPlayer, pushLog],
  );

  const onAttackMoved = useCallback(
    (payload: { territoryId: number; troops: number }) => {
      pushLog(
        colorForPlayer(lastConquestAttackerIdRef.current),
        `Moved ${payload.troops} troops into conquered territory #${payload.territoryId + 1}`,
      );
    },
    [colorForPlayer, pushLog],
  );

  const onDeployedMany = useCallback(
    (payload: {
      deposits: { territoryId: number; troops: number }[];
      playerId: number;
    }) => {
      for (const deposit of payload.deposits)
        logDeploy({ ...deposit, playerId: payload.playerId });
    },
    [logDeploy],
  );

  const onEntrenched = useCallback(
    (payload: {
      territoryId: number;
      troops: number;
      turnsRemaining: number;
      playerId: number;
    }) => {
      pushLog(
        colorForPlayer(payload.playerId),
        `Entrenched territory #${payload.territoryId + 1} with ${payload.troops} troops (now ${payload.turnsRemaining} turns)`,
      );
    },
    [colorForPlayer, pushLog],
  );

  const onToxined = useCallback(
    (payload: {
      territoryId: number;
      permanent: boolean;
      roundsRemaining: number;
      playerId: number;
    }) => {
      pushLog(
        colorForPlayer(payload.playerId),
        payload.permanent
          ? `Released toxin on territory #${payload.territoryId + 1} permanently`
          : `Released toxin on territory #${payload.territoryId + 1} for ${payload.roundsRemaining} rounds`,
      );
    },
    [colorForPlayer, pushLog],
  );

  const onRadiationChanged = useCallback(
    (payload: {
      territoryIds: number[];
      newlyRadiatedIds: number[];
      eliminatedPlayerIds: number[];
    }) => {
      if (payload.newlyRadiatedIds.length > 0)
        pushLog(
          NEUTRAL_LOG_COLOR,
          `Radiation spread to territor${payload.newlyRadiatedIds.length === 1 ? 'y' : 'ies'} ${payload.newlyRadiatedIds.map((id) => `#${id + 1}`).join(', ')}`,
        );
      for (const playerId of payload.eliminatedPlayerIds)
        pushLog(colorForPlayer(playerId), 'Eliminated by radiation');
    },
    [colorForPlayer, pushLog],
  );

  const onAttacked = useCallback(
    (payload: {
      attackingTerritoryId: number;
      defendingTerritoryId: number;
      attackerId: number;
      attackingTroops?: number;
      defendingTroops?: number;
      attackLosses?: number;
      defenceLosses?: number;
      conquered?: boolean;
    }) => {
      if (payload.conquered)
        lastConquestAttackerIdRef.current = payload.attackerId;
      let text = `${payload.conquered ? 'Conquered' : 'Attacked'} territory #${payload.defendingTerritoryId + 1} from #${payload.attackingTerritoryId + 1}`;
      if (
        payload.attackingTroops !== undefined &&
        payload.defendingTroops !== undefined
      )
        text += `: ${payload.attackingTroops} vs ${payload.defendingTroops} troops`;
      if (payload.attackLosses !== undefined)
        text += `, lost ${payload.attackLosses}`;
      if (payload.defenceLosses !== undefined)
        text += ` and killed ${payload.defenceLosses}`;
      pushLog(colorForPlayer(payload.attackerId), text);
    },
    [colorForPlayer, pushLog],
  );

  const onCardSetPlayed = useCallback(
    (payload: {
      playerId: number;
      troops: number;
      cards: Card[];
      territoryBonusCount: number;
    }) => {
      pushLog(
        colorForPlayer(payload.playerId),
        `Received ${payload.troops - payload.territoryBonusCount * 2} troops from a set`,
      );
    },
    [colorForPlayer, pushLog],
  );

  const onTurnStarted = useCallback(
    (payload: {
      playerId: number;
      roundNumber: number;
      troopsFromTerritories: number;
      troopsFromBonuses: number;
      troopsFromCapitals: number;
      troopsFromRoundTroops: number;
      troopsFromBounties: number;
    }) => {
      if (
        lastLoggedRoundNumberRef.current === null ||
        payload.roundNumber > lastLoggedRoundNumberRef.current
      ) {
        lastLoggedRoundNumberRef.current = payload.roundNumber;
        pushLog(NEUTRAL_LOG_COLOR, `Started round ${payload.roundNumber + 1}`);
      }
      const color = colorForPlayer(payload.playerId);
      if (payload.troopsFromTerritories > 0)
        pushLog(
          color,
          `Received ${payload.troopsFromTerritories} troops from territories`,
        );
      if (payload.troopsFromBonuses > 0)
        pushLog(
          color,
          `Received ${payload.troopsFromBonuses} troops from bonuses`,
        );
      if (payload.troopsFromCapitals > 0)
        pushLog(
          color,
          `Received ${payload.troopsFromCapitals} troops from capitals`,
        );
      if (payload.troopsFromRoundTroops > 0)
        pushLog(
          color,
          `Received ${payload.troopsFromRoundTroops} troops from round troops`,
        );
      if (payload.troopsFromBounties > 0)
        pushLog(
          color,
          `Received ${payload.troopsFromBounties} troops from bounties`,
        );
    },
    [colorForPlayer, pushLog],
  );

  const onCapitalPlacementStarted = useCallback(() => {
    pushLog(NEUTRAL_LOG_COLOR, 'Started capital placement');
  }, [pushLog]);

  const onAllianceFormed = useCallback(
    (payload: { withId: number }) => {
      const name =
        gameRef.current?.players.find((p) => p.id === payload.withId)?.name ??
        'a player';
      pushLog(
        colorForPlayer(payload.withId),
        `Formed an alliance with ${name}`,
      );
    },
    [colorForPlayer, pushLog],
  );

  const onAllianceTerminated = useCallback(
    (payload: { withId: number }) => {
      const name =
        gameRef.current?.players.find((p) => p.id === payload.withId)?.name ??
        'a player';
      pushLog(
        colorForPlayer(payload.withId),
        `Terminated the alliance with ${name}`,
      );
    },
    [colorForPlayer, pushLog],
  );

  const onTerritoryClaimed = useCallback(
    (payload: { territoryId: number; playerId: number }) => {
      const color = colorForPlayer(payload.playerId);
      pushLog(color, `Claimed territory #${payload.territoryId + 1}`);
      pushLog(
        color,
        `Deployed 1 troops to territory #${payload.territoryId + 1}`,
      );
    },
    [colorForPlayer, pushLog],
  );

  useEffect(() => {
    connector.on('game:deployed', onDeployed);
    connector.on('game:fortified', onFortified);
    connector.on('game:attackMoved', onAttackMoved);
    connector.on('game:deployedMany', onDeployedMany);
    connector.on('game:entrenched', onEntrenched);
    connector.on('game:toxined', onToxined);
    connector.on('game:radiationChanged', onRadiationChanged);
    connector.on('game:attacked', onAttacked);
    connector.on('game:cardSetPlayed', onCardSetPlayed);
    connector.on('game:turnStarted', onTurnStarted);
    connector.on('game:capitalPlacementStarted', onCapitalPlacementStarted);
    connector.on('game:territoryClaimed', onTerritoryClaimed);
    connector.on('game:allianceFormed', onAllianceFormed);
    connector.on('game:allianceTerminated', onAllianceTerminated);
    return () => {
      connector.off('game:deployed', onDeployed);
      connector.off('game:fortified', onFortified);
      connector.off('game:attackMoved', onAttackMoved);
      connector.off('game:deployedMany', onDeployedMany);
      connector.off('game:entrenched', onEntrenched);
      connector.off('game:toxined', onToxined);
      connector.off('game:radiationChanged', onRadiationChanged);
      connector.off('game:attacked', onAttacked);
      connector.off('game:cardSetPlayed', onCardSetPlayed);
      connector.off('game:turnStarted', onTurnStarted);
      connector.off('game:capitalPlacementStarted', onCapitalPlacementStarted);
      connector.off('game:territoryClaimed', onTerritoryClaimed);
      connector.off('game:allianceFormed', onAllianceFormed);
      connector.off('game:allianceTerminated', onAllianceTerminated);
    };
  }, [
    onDeployed,
    onFortified,
    onAttackMoved,
    onDeployedMany,
    onEntrenched,
    onToxined,
    onRadiationChanged,
    onAttacked,
    onCardSetPlayed,
    onTurnStarted,
    onCapitalPlacementStarted,
    onTerritoryClaimed,
    onAllianceFormed,
    onAllianceTerminated,
  ]);

  const applyLogEntry = useCallback(
    (entry: { type: string; payload: unknown }) => {
      switch (entry.type) {
        case 'game:deployed':
          onDeployed(entry.payload as Parameters<typeof onDeployed>[0]);
          break;
        case 'game:fortified':
          onFortified(entry.payload as Parameters<typeof onFortified>[0]);
          break;
        case 'game:attackMoved':
          onAttackMoved(entry.payload as Parameters<typeof onAttackMoved>[0]);
          break;
        case 'game:deployedMany':
          onDeployedMany(entry.payload as Parameters<typeof onDeployedMany>[0]);
          break;
        case 'game:entrenched':
          onEntrenched(entry.payload as Parameters<typeof onEntrenched>[0]);
          break;
        case 'game:toxined':
          onToxined(entry.payload as Parameters<typeof onToxined>[0]);
          break;
        case 'game:radiationChanged':
          onRadiationChanged(
            entry.payload as Parameters<typeof onRadiationChanged>[0],
          );
          break;
        case 'game:attacked':
          onAttacked(entry.payload as Parameters<typeof onAttacked>[0]);
          break;
        case 'game:cardSetPlayed':
          onCardSetPlayed(
            entry.payload as Parameters<typeof onCardSetPlayed>[0],
          );
          break;
        case 'game:turnStarted':
          onTurnStarted(entry.payload as Parameters<typeof onTurnStarted>[0]);
          break;
        case 'game:capitalPlacementStarted':
          onCapitalPlacementStarted();
          break;
        case 'game:territoryClaimed':
          onTerritoryClaimed(
            entry.payload as Parameters<typeof onTerritoryClaimed>[0],
          );
          break;
        case 'game:allianceFormed':
          onAllianceFormed(
            entry.payload as Parameters<typeof onAllianceFormed>[0],
          );
          break;
        case 'game:allianceTerminated':
          onAllianceTerminated(
            entry.payload as Parameters<typeof onAllianceTerminated>[0],
          );
          break;
      }
    },
    [
      onDeployed,
      onFortified,
      onAttackMoved,
      onDeployedMany,
      onEntrenched,
      onToxined,
      onRadiationChanged,
      onAttacked,
      onCardSetPlayed,
      onTurnStarted,
      onCapitalPlacementStarted,
      onTerritoryClaimed,
      onAllianceFormed,
      onAllianceTerminated,
    ],
  );

  const pendingLogEntriesRef = useRef<
    { type: string; payload: unknown }[] | null
  >(null);

  useEffect(() => {
    function onGameLogs(payload: {
      entries: { type: string; payload: unknown }[];
    }) {
      if (gameRef.current) {
        for (const entry of payload.entries) applyLogEntry(entry);
      } else {
        pendingLogEntriesRef.current = payload.entries;
      }
    }
    connector.on('game:logs', onGameLogs);
    return () => {
      connector.off('game:logs', onGameLogs);
    };
  }, [applyLogEntry]);

  useEffect(() => {
    if (!game || !pendingLogEntriesRef.current) return;
    const entries = pendingLogEntriesRef.current;
    pendingLogEntriesRef.current = null;
    for (const entry of entries) applyLogEntry(entry);
  }, [game, applyLogEntry]);

  return logs;
}
