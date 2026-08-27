import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Container, Form, Spinner } from 'react-bootstrap';
import Chat from '../common/Chat';
import SettingsMenu from '../common/SettingsMenu';
import GameMap from '../game/GameMap';
import { useGameLogs } from '../game/useGameLogs';
import { socket } from '../lib/socket';
import { playSound } from '../lib/sounds';
import type {
  Ack,
  GameResults,
  GameState,
  Mission,
  Player,
  PlayerResultStats,
} from '../lib/types';
import Lobby from '../lobby/Lobby';
import EndPage from './EndPage';

interface Props {
  player: Player;
  onNameChange: (name: string) => void;
  selfId: number | null;
  joinError: string;
  needsPassword: boolean;
  onSubmitPassword: (password: string) => void;
  mapNames: string[];
  navigate: (path: string) => void;
  onRename: (name: string) => void;
}

function Game({
  player,
  onNameChange,
  selfId,
  joinError,
  needsPassword,
  onSubmitPassword,
  mapNames,
  navigate,
  onRename,
}: Props) {
  const [game, setGame] = useState<GameState | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [endView, setEndView] = useState<'auto' | 'map' | 'stats'>('auto');
  const [mission, setMission] = useState<Mission | null>(null);
  const [results, setResults] = useState<Map<number, PlayerResultStats> | null>(
    null,
  );
  const receivedFirstStateRef = useRef(false);
  const prevStateRef = useRef<GameState['state'] | null>(null);
  const prevTurnPhaseRef = useRef<GameState['turnPhase'] | null>(null);
  const logs = useGameLogs(game);

  function applyGameState(state: GameState) {
    if (!receivedFirstStateRef.current) {
      receivedFirstStateRef.current = true;
      if (state.state === 'ended') setEndView('stats');
    } else if (prevStateRef.current === 'lobby' && state.state === 'playing') {
      playSound('start');
    } else if (prevStateRef.current === 'playing' && state.state === 'ended') {
      playSound('end');
    } else if (
      state.state === 'playing' &&
      prevTurnPhaseRef.current !== null &&
      prevTurnPhaseRef.current !== state.turnPhase
    ) {
      playSound('phase');
    }
    prevStateRef.current = state.state;
    if (state.state === 'playing') prevTurnPhaseRef.current = state.turnPhase;
    setGame(state);
  }

  useEffect(() => {
    socket.on('game:state', applyGameState);
    socket.emit('game:requestState');
    return () => {
      socket.off('game:state', applyGameState);
    };
  }, []);

  useEffect(() => {
    function onTurnStarted(payload: { playerId: number }) {
      const isGameStart = prevStateRef.current !== 'playing';
      prevTurnPhaseRef.current = 'deploy';
      if (!isGameStart) {
        playSound(payload.playerId === selfId ? 'turn' : 'phase');
      }
    }
    socket.on('game:turnStarted', onTurnStarted);
    return () => {
      socket.off('game:turnStarted', onTurnStarted);
    };
  }, [selfId]);

  useEffect(() => {
    if (game?.name) onRename(game.name);
  }, [game?.name, onRename]);

  useEffect(() => {
    function onMission(payload: { mission: Mission }) {
      setMission(payload.mission);
    }
    socket.on('game:mission', onMission);
    return () => {
      socket.off('game:mission', onMission);
    };
  }, []);

  useEffect(() => {
    function onResults(payload: GameResults) {
      setResults(new Map(payload.stats.map((s) => [s.id, s])));
    }
    socket.on('game:results', onResults);
    socket.emit('game:requestResults');
    return () => {
      socket.off('game:results', onResults);
    };
  }, []);

  useEffect(() => {
    if (game?.state !== 'ended') return;
    const timer = setTimeout(
      () => setEndView((v) => (v === 'auto' ? 'stats' : v)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [game?.state]);

  if (needsPassword) {
    return (
      <Container
        fluid
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: '100vh' }}
      >
        <Form
          className="d-flex align-items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitPassword(passwordInput);
          }}
        >
          <span>Game Password</span>
          <Form.Control
            type="password"
            autoFocus
            className="w-auto"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
          />
          <Button type="submit">Join</Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Home
          </Button>
        </Form>
      </Container>
    );
  }

  if (joinError) {
    return (
      <Container fluid className="py-5 px-4">
        <Alert variant="danger">{joinError}</Alert>
        <Button onClick={() => navigate('/')}>Home</Button>
      </Container>
    );
  }

  if (!game) {
    return (
      <div className="position-fixed top-0 start-0 m-3 d-flex align-items-center">
        <Spinner size="sm" className="me-2" />
        Loading...
      </div>
    );
  }

  function togglePause() {
    setGame((prev) => (prev ? { ...prev, paused: !prev.paused } : prev));
    socket.emit('game:pause', (res: Ack) => {
      if (res.ok) setGame(res.game);
      else setGame((prev) => (prev ? { ...prev, paused: !prev.paused } : prev));
    });
  }

  function adjustTerritoryTroops(
    deltas: { territoryId: number; delta: number; ownerId?: number }[],
  ) {
    setGame((prev) => {
      if (!prev) return prev;
      const deltaById = new Map(deltas.map((d) => [d.territoryId, d]));
      const existingIds = new Set(prev.territories.map((t) => t.id));
      const additions = deltas
        .filter(
          (d) => d.ownerId !== undefined && !existingIds.has(d.territoryId),
        )
        .map((d) => ({
          id: d.territoryId,
          ownerId: d.ownerId!,
          troops: Math.max(0, d.delta),
          isCapital: false,
          entrenchedTurns: 0,
        }));
      return {
        ...prev,
        territories: [
          ...prev.territories.map((t) => {
            const d = deltaById.get(t.id);
            if (!d) return t;
            return {
              ...t,
              troops: t.troops + d.delta,
              ownerId: d.ownerId ?? t.ownerId,
            };
          }),
          ...additions,
        ],
      };
    });
  }

  function adjustToxinTerritories(
    changes: (
      | { territoryId: number; remove: true }
      | { territoryId: number; permanent: boolean; turnsRemaining: number }
    )[],
  ) {
    setGame((prev) => {
      if (!prev) return prev;
      const changedIds = new Set(changes.map((c) => c.territoryId));
      const additions = changes.filter(
        (
          c,
        ): c is {
          territoryId: number;
          permanent: boolean;
          turnsRemaining: number;
        } => !('remove' in c),
      );
      return {
        ...prev,
        toxinTerritories: [
          ...prev.toxinTerritories.filter((t) => !changedIds.has(t.id)),
          ...additions.map((a) => ({
            id: a.territoryId,
            permanent: a.permanent,
            turnsRemaining: a.turnsRemaining,
          })),
        ],
      };
    });
  }

  function setRadiationTerritoryIds(territoryIds: number[]) {
    setGame((prev) =>
      prev ? { ...prev, radiationTerritoryIds: territoryIds } : prev,
    );
  }

  function setRadiationUpcomingTerritoryIds(territoryIds: number[]) {
    setGame((prev) =>
      prev ? { ...prev, radiationUpcomingTerritoryIds: territoryIds } : prev,
    );
  }

  const nameById = new Map(
    [...game.players, ...game.spectators].map((p) => [p.id, p.name]),
  );
  const colorById = new Map(game.players.map((p) => [p.id, p.color]));
  const showMap =
    game.state === 'playing' || (game.state === 'ended' && endView !== 'stats');

  return (
    <>
      <SettingsMenu shareUrl={window.location.href} />
      {showMap ? (
        <GameMap
          mapName={game.mapName}
          players={game.players}
          spectators={game.spectators}
          ownership={game.territories}
          visibleTerritoryIds={game.visibleTerritoryIds}
          gameMode={game.gameMode}
          isTeamDeathmatch={game.gameMode === 'Team Deathmatch'}
          isCapitals={game.gameMode === 'Capitals'}
          continentId={game.continentId}
          mission={mission}
          selfId={selfId}
          turnNumber={game.turnNumber}
          turnPlayerIndex={game.turnPlayerIndex}
          turnPhase={game.turnPhase}
          turnDuration={game.turnDuration}
          fortification={game.fortification}
          entrenchments={game.entrenchments}
          toxins={game.toxins}
          toxinTerritories={game.toxinTerritories}
          cards={game.cards}
          portalTerritoryIds={game.portalTerritoryIds}
          portalsEnabled={game.portalsEnabled}
          radiationTerritoryIds={game.radiationTerritoryIds}
          radiationUpcomingTerritoryIds={game.radiationUpcomingTerritoryIds}
          starvation={game.starvation}
          bounties={game.bounties}
          supplyLines={game.supplyLines}
          alliances={game.alliances}
          allianceStates={game.allianceStates}
          territoryTroopsCap={game.territoryTroopsCap}
          totalTroopsCap={game.totalTroopsCap}
          troopsToDeploy={game.troopsToDeploy}
          turnStartedAt={game.turnStartedAt}
          paused={game.paused}
          hostId={game.hostId}
          onTogglePause={togglePause}
          selectedTerritoryId={game.selectedTerritoryId}
          fortifyStartTerritoryId={game.fortifyStartTerritoryId}
          fortifyEndTerritoryId={game.fortifyEndTerritoryId}
          fortifyPathTerritoryIds={game.fortifyPathTerritoryIds}
          attackStartTerritoryId={game.attackStartTerritoryId}
          attackEndTerritoryId={game.attackEndTerritoryId}
          attackConquestMinTroops={game.attackConquestMinTroops}
          nextSetBaseValues={game.nextSetBaseValues}
          upcomingSetValues={game.upcomingSetValues}
          gameEnded={game.state === 'ended'}
          showReplay={endView === 'map'}
          logs={logs}
          setGame={setGame}
          adjustTerritoryTroops={adjustTerritoryTroops}
          adjustToxinTerritories={adjustToxinTerritories}
          setRadiationTerritoryIds={setRadiationTerritoryIds}
          setRadiationUpcomingTerritoryIds={setRadiationUpcomingTerritoryIds}
          setChatOpen={setChatOpen}
          navigate={navigate}
        />
      ) : game.state === 'ended' ? (
        <EndPage
          game={game}
          results={results}
          selfId={selfId}
          navigate={navigate}
          onViewMap={() => setEndView('map')}
        />
      ) : (
        <Container fluid className="pt-3 pb-5 px-4">
          <Lobby
            game={game}
            setGame={applyGameState}
            player={player}
            onNameChange={onNameChange}
            selfId={selfId}
            mapNames={mapNames}
            navigate={navigate}
          />
        </Container>
      )}
      {game.state === 'ended' && endView === 'map' && (
        <Button
          variant="secondary"
          size="sm"
          className="position-fixed bottom-0 end-0 m-3"
          onClick={() => setEndView('stats')}
        >
          Results
        </Button>
      )}
      <Chat
        nameById={nameById}
        colorById={colorById}
        transparent={showMap}
        open={chatOpen}
        setOpen={setChatOpen}
      />
    </>
  );
}

export default Game;
