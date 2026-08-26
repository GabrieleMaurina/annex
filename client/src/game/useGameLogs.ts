import { useCallback, useEffect, useRef, useState } from 'react';
import { playerColor } from '../lib/palette';
import { socket } from '../lib/socket';
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

  const ownerOfTerritory = useCallback(
    (territoryId: number): number | undefined =>
      gameRef.current?.territories.find((t) => t.id === territoryId)?.ownerId,
    [],
  );

  const lastConquestAttackerIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    function logDeploy(payload: { territoryId: number; troops: number }) {
      pushLog(
        colorForPlayer(ownerOfTerritory(payload.territoryId)),
        `Deployed ${payload.troops} troops to territory #${payload.territoryId + 1}`,
      );
    }
    function onDeployed(payload: { territoryId: number; troops: number }) {
      logDeploy(payload);
    }
    function onFortified(payload: {
      territoryId: number;
      fromTerritoryId: number;
      troops: number;
    }) {
      pushLog(
        colorForPlayer(ownerOfTerritory(payload.territoryId)),
        `Fortified ${payload.troops} troops from territory #${payload.fromTerritoryId + 1} to territory #${payload.territoryId + 1}`,
      );
    }
    function onAttackMoved(payload: { territoryId: number; troops: number }) {
      pushLog(
        colorForPlayer(lastConquestAttackerIdRef.current),
        `Moved ${payload.troops} troops into conquered territory #${payload.territoryId + 1}`,
      );
    }
    function onDeployedMany(payload: {
      deposits: { territoryId: number; troops: number }[];
    }) {
      for (const deposit of payload.deposits) logDeploy(deposit);
    }
    function onEntrenched(payload: {
      territoryId: number;
      troops: number;
      turnsRemaining: number;
    }) {
      pushLog(
        colorForPlayer(ownerOfTerritory(payload.territoryId)),
        `Entrenched territory #${payload.territoryId + 1} with ${payload.troops} troops (now ${payload.turnsRemaining} turns)`,
      );
    }
    function onToxined(payload: {
      territoryId: number;
      permanent: boolean;
      turnsRemaining: number;
      playerId: number;
    }) {
      pushLog(
        colorForPlayer(payload.playerId),
        payload.permanent
          ? `Released toxins on territory #${payload.territoryId + 1} permanently`
          : `Released toxins on territory #${payload.territoryId + 1} for ${payload.turnsRemaining} turns`,
      );
    }
    function onRadiationChanged(payload: {
      territoryIds: number[];
      eliminatedPlayerIds: number[];
    }) {
      const previouslyRadiated = new Set(
        gameRef.current?.radiationTerritoryIds ?? [],
      );
      const newlyRadiated = payload.territoryIds.filter(
        (id) => !previouslyRadiated.has(id),
      );
      if (newlyRadiated.length > 0)
        pushLog(
          NEUTRAL_LOG_COLOR,
          `Radiation spread to territor${newlyRadiated.length === 1 ? 'y' : 'ies'} ${newlyRadiated.map((id) => `#${id + 1}`).join(', ')}`,
        );
      for (const playerId of payload.eliminatedPlayerIds)
        pushLog(colorForPlayer(playerId), 'Eliminated by radiation');
    }
    socket.on('game:deployed', onDeployed);
    socket.on('game:fortified', onFortified);
    socket.on('game:attackMoved', onAttackMoved);
    socket.on('game:deployedMany', onDeployedMany);
    socket.on('game:entrenched', onEntrenched);
    socket.on('game:toxined', onToxined);
    socket.on('game:radiationChanged', onRadiationChanged);
    return () => {
      socket.off('game:deployed', onDeployed);
      socket.off('game:fortified', onFortified);
      socket.off('game:attackMoved', onAttackMoved);
      socket.off('game:deployedMany', onDeployedMany);
      socket.off('game:entrenched', onEntrenched);
      socket.off('game:toxined', onToxined);
      socket.off('game:radiationChanged', onRadiationChanged);
    };
  }, [colorForPlayer, ownerOfTerritory, pushLog]);

  useEffect(() => {
    function onAttacked(payload: {
      attackingTerritoryId: number;
      defendingTerritoryId: number;
      attackerId: number;
      attackingTroops?: number;
      defendingTroops?: number;
      attackLosses?: number;
      defenceLosses?: number;
      conquered?: boolean;
    }) {
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
    }
    socket.on('game:attacked', onAttacked);
    return () => {
      socket.off('game:attacked', onAttacked);
    };
  }, [colorForPlayer, pushLog]);

  useEffect(() => {
    function onCardSetPlayed(payload: {
      playerId: number;
      troops: number;
      cards: Card[];
    }) {
      const territoryBonusCount = payload.cards.filter(
        (c) =>
          c.territoryId !== null &&
          ownerOfTerritory(c.territoryId) === payload.playerId,
      ).length;
      pushLog(
        colorForPlayer(payload.playerId),
        `Received ${payload.troops - territoryBonusCount * 2} troops from a set`,
      );
    }
    socket.on('game:cardSetPlayed', onCardSetPlayed);
    return () => {
      socket.off('game:cardSetPlayed', onCardSetPlayed);
    };
  }, [colorForPlayer, ownerOfTerritory, pushLog]);

  const lastLoggedTurnNumberRef = useRef<number | null>(null);
  useEffect(() => {
    function onTurnStarted(payload: {
      playerId: number;
      turnNumber: number;
      troopsFromTerritories: number;
      troopsFromBonuses: number;
      troopsFromCapitals: number;
      troopsFromTurnTroops: number;
      troopsFromBounties: number;
    }) {
      if (
        lastLoggedTurnNumberRef.current === null ||
        payload.turnNumber > lastLoggedTurnNumberRef.current
      ) {
        lastLoggedTurnNumberRef.current = payload.turnNumber;
        pushLog(NEUTRAL_LOG_COLOR, `Started turn ${payload.turnNumber + 1}`);
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
      if (payload.troopsFromTurnTroops > 0)
        pushLog(
          color,
          `Received ${payload.troopsFromTurnTroops} troops from turn troops`,
        );
      if (payload.troopsFromBounties > 0)
        pushLog(
          color,
          `Received ${payload.troopsFromBounties} troops from bounties`,
        );
    }
    socket.on('game:turnStarted', onTurnStarted);
    return () => {
      socket.off('game:turnStarted', onTurnStarted);
    };
  }, [colorForPlayer, pushLog]);

  useEffect(() => {
    function onCapitalPlacementStarted() {
      pushLog(NEUTRAL_LOG_COLOR, 'Started capital placement');
    }
    socket.on('game:capitalPlacementStarted', onCapitalPlacementStarted);
    return () => {
      socket.off('game:capitalPlacementStarted', onCapitalPlacementStarted);
    };
  }, [pushLog]);

  useEffect(() => {
    function onTerritoryClaimed(payload: {
      territoryId: number;
      playerId: number;
    }) {
      const color = colorForPlayer(payload.playerId);
      pushLog(color, `Claimed territory #${payload.territoryId + 1}`);
      pushLog(
        color,
        `Deployed 1 troops to territory #${payload.territoryId + 1}`,
      );
    }
    socket.on('game:territoryClaimed', onTerritoryClaimed);
    return () => {
      socket.off('game:territoryClaimed', onTerritoryClaimed);
    };
  }, [colorForPlayer, pushLog]);

  return logs;
}
