import { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import { connector } from '../connector';
import GameEndResults from '../game/GameEndResults';
import GameMap from '../game/GameMap';
import { gameMapDataProps, noopGameMapHandlers } from '../game/gameMapProps';
import { formatLogEntries } from '../game/logFormat';
import { registerGeneratedMap } from '../game/mapData';
import { foldStoredReplay } from '../game/replay';
import { contrastTextColor, playerColor } from '../lib/palette';
import type { GameState, ReplayTerritory, StoredGame } from '../lib/types';

interface Props {
  navigate: (path: string) => void;
}

function countsByOwner(territories: ReplayTerritory[]) {
  const counts = new Map<number, { territories: number; troops: number }>();
  for (const t of territories) {
    const entry = counts.get(t.ownerId) ?? { territories: 0, troops: 0 };
    entry.territories += 1;
    entry.troops += t.troops;
    counts.set(t.ownerId, entry);
  }
  return counts;
}

function buildGameState(
  doc: StoredGame,
  finalTerritories: ReplayTerritory[],
): GameState {
  const counts = countsByOwner(finalTerritories);
  const resultById = new Map(doc.results.map((r) => [r.playerId, r]));
  const capitals = new Set(doc.capitalTerritoryIds ?? []);
  const s = doc.settings;
  return {
    name: doc.name,
    mapName: doc.mapName,
    mapGeneration: doc.mapGeneration,
    slots: s.slots,
    hostId: doc.originalHostId ?? -1,
    originalHostId: doc.originalHostId ?? -1,
    state: 'ended',
    alliances: s.alliances,
    allianceStates: [],
    blitz: s.blitz,
    bounties: s.bounties,
    cards: s.cards,
    defenceDice: s.defenceDice,
    disconnectBotDifficulty: s.disconnectBotDifficulty,
    disconnectBotPersonality: s.disconnectBotPersonality,
    entrenchments: s.entrenchments,
    fogOfWar: s.fogOfWar,
    fortification: s.fortification,
    gameMode: s.gameMode,
    continentId: s.continentId,
    placement: s.placement,
    portals: s.portals,
    portalTerritoryIds: [],
    portalsEnabled: false,
    radiations: s.radiations,
    radiationTerritoryIds: [],
    radiationUpcomingTerritoryIds: [],
    starvation: s.starvation,
    supplyLines: s.supplyLines,
    toxins: s.toxins,
    turnDuration: s.turnDuration,
    roundTroops: s.roundTroops,
    territoryTroopsCap: 30,
    totalTroopsCap: 9999,
    roundNumber: doc.roundNumber,
    turnPlayerIndex: 0,
    turnPhase: 'deploy',
    troopsToDeploy: 0,
    turnStartedAt: Date.now(),
    paused: false,
    selectedTerritoryId: null,
    fortifyStartTerritoryId: null,
    fortifyEndTerritoryId: null,
    attackStartTerritoryId: null,
    attackEndTerritoryId: null,
    attackConquestMinTroops: null,
    fortifyPathTerritoryIds: [],
    winnerIds: doc.winnerIds,
    finalRanking: [...doc.results]
      .sort((a, b) => a.rank - b.rank)
      .map((r) => r.playerId),
    nextSetBaseValues: { soldier: 0, humvee: 0, tank: 0, mixed: 0 },
    upcomingSetValues: [],
    players: doc.players.map((p) => {
      const result = resultById.get(p.playerId);
      return {
        id: p.playerId,
        name: p.name,
        team: p.team,
        color: p.color,
        territoryCount: counts.get(p.playerId)?.territories ?? 0,
        troopCount: counts.get(p.playerId)?.troops ?? 0,
        capitalCount: finalTerritories.filter(
          (t) => t.ownerId === p.playerId && capitals.has(t.id),
        ).length,
        troopsRemaining: 0,
        cardCount: 0,
        connected: true,
        surrendered: result?.surrendered ?? false,
        eliminated: result?.eliminated ?? false,
        playersKilled: result?.playersKilled ?? [],
        isBot: p.isBot,
        botDifficulty: p.botDifficulty,
        botPersonality: p.botPersonality,
      };
    }),
    spectators: [],
    bannedPlayers: [],
    territories: finalTerritories.map((t) => ({
      id: t.id,
      ownerId: t.ownerId,
      troops: t.troops,
      isCapital: capitals.has(t.id),
      entrenchedTurns: t.entrenchedTurns,
    })),
    toxinTerritories: [],
    visibleTerritoryIds: undefined,
  };
}

function ReplayPage({ navigate }: Props) {
  const { id = '' } = useParams();
  const [resolved, setResolved] = useState<{
    doc: StoredGame;
    mapRenderName: string;
  } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [view, setView] = useState<'results' | 'replay'>('results');
  const [replayIndex, setReplayIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    connector.getStoredGame(id, (game) => {
      if (cancelled) return;
      if (!game) {
        setNotFound(true);
        return;
      }
      connector.getStoredMap(game.mapId, (map) => {
        if (cancelled) return;
        if (map) {
          registerGeneratedMap(game.mapId, {
            territories: map.territories,
            bonuses: map.bonuses,
            imageSrc: `data:${map.imageMime};base64,${map.image}`,
          });
        }
        setNotFound(false);
        setResolved({ doc: game, mapRenderName: game.mapId });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const doc = resolved?.doc ?? null;

  const folded = useMemo(
    () => (doc ? foldStoredReplay(doc.replay) : null),
    [doc],
  );
  const logs = useMemo(
    () =>
      doc
        ? formatLogEntries(
            doc.serverLog,
            doc.players.map((p) => ({
              id: p.playerId,
              name: p.name,
              color: p.color,
            })),
          )
        : [],
    [doc],
  );

  if (notFound) {
    return (
      <div className="d-flex flex-column align-items-center gap-3 py-5">
        <p>Replay not found.</p>
        <Button onClick={() => navigate('/games')}>Games</Button>
      </div>
    );
  }

  if (!resolved || !doc || doc.id !== id || !folded) {
    return (
      <div className="position-fixed top-0 start-0 m-3 d-flex align-items-center">
        <Spinner size="sm" className="me-2" />
        Loading replay...
      </div>
    );
  }

  const finalTerritories =
    folded.data.frames.at(-1)?.territories ?? folded.data.initial;
  const game = buildGameState(doc, finalTerritories);
  const nameById = new Map(doc.players.map((p) => [p.playerId, p.name]));
  const colorById = new Map(doc.players.map((p) => [p.playerId, p.color]));
  const shownChat = folded.chat.filter((m) => m.afterFrame <= replayIndex);
  const shownEmoji = folded.emoji.filter((e) => e.afterFrame <= replayIndex);

  if (view === 'results') {
    return (
      <GameEndResults
        game={game}
        results={new Map(doc.results.map((r) => [r.playerId, r]))}
        selfId={null}
        mapNames={[]}
        onWatchReplay={() => setView('replay')}
      />
    );
  }

  return (
    <>
      <GameMap
        {...gameMapDataProps(game, resolved.mapRenderName)}
        {...noopGameMapHandlers}
        mission={null}
        selfId={null}
        gameEnded
        showReplay
        replayData={folded.data}
        onReplayIndexChange={setReplayIndex}
        logs={logs}
        settingsMenuOpen={false}
        navigate={navigate}
      />
      <Button
        variant="secondary"
        size="sm"
        className="position-fixed bottom-0 end-0 m-3"
        style={{ zIndex: 5 }}
        onClick={() => setView('results')}
      >
        Results
      </Button>
      {(shownChat.length > 0 || shownEmoji.length > 0) && (
        <div
          className="position-fixed top-0 start-0 m-3 p-2 rounded small"
          style={{
            zIndex: 5,
            maxWidth: 280,
            maxHeight: '40vh',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
          }}
        >
          {shownChat.map((message, i) => (
            <div key={`c${i}`}>
              <span
                className="badge me-1"
                style={{
                  backgroundColor: playerColor(
                    colorById.get(message.senderId) ?? 0,
                  ),
                  color: contrastTextColor(
                    playerColor(colorById.get(message.senderId) ?? 0),
                  ),
                }}
              >
                {message.name}
              </span>
              {message.message}
            </div>
          ))}
          {shownEmoji.map((e, i) => (
            <div key={`e${i}`}>
              {nameById.get(e.senderId) ?? '?'} {e.emoji}
              {e.targetPlayerId !== null
                ? ` → ${nameById.get(e.targetPlayerId) ?? '?'}`
                : ''}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default ReplayPage;
