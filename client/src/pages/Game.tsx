import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Container, Form, Spinner } from 'react-bootstrap';
import Chat from '../common/Chat';
import { formatError } from '../common/formatError';
import SettingsMenu from '../common/SettingsMenu';
import { connector } from '../connector';
import GameMap from '../game/GameMap';
import { gameMapDataProps } from '../game/gameMapProps';
import OfflineHandoffGate from '../game/OfflineHandoffGate';
import RotateDeviceOverlay from '../game/RotateDeviceOverlay';
import { useGameLogs } from '../game/useGameLogs';
import { playSound } from '../lib/sounds';
import type {
  Ack,
  GameMeta,
  GameResults,
  GameState,
  Mission,
  PlayerResultStats,
} from '../lib/types';
import Lobby from '../lobby/Lobby';
import EndPage from './EndPage';

interface Props {
  selfId: number | null;
  joinError: string;
  needsPassword: boolean;
  onSubmitPassword: (password: string) => void;
  mapNames: string[];
  navigate: (path: string) => void;
  onRename: (name: string) => void;
}

function Game({
  selfId,
  joinError,
  needsPassword,
  onSubmitPassword,
  mapNames,
  navigate,
  onRename,
}: Props) {
  const [game, setGame] = useState<GameState | null>(null);
  const [gameMeta, setGameMeta] = useState<GameMeta | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [gamePanelOpen, setGamePanelOpen] = useState(false);
  const [endReplaying, setEndReplaying] = useState(false);
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

  function updateGameFromAction(state: GameState) {
    if (
      game?.state === 'playing' &&
      state.state === 'playing' &&
      game.turnPlayerIndex === state.turnPlayerIndex &&
      game.turnPhase !== state.turnPhase
    ) {
      playSound('phase');
    }
    setGame(state);
  }

  useEffect(() => {
    connector.on('game:state', applyGameState);
    connector.requestState();
    return () => {
      connector.off('game:state', applyGameState);
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
    connector.on('game:turnStarted', onTurnStarted);
    return () => {
      connector.off('game:turnStarted', onTurnStarted);
    };
  }, [selfId]);

  useEffect(() => {
    if (game?.name) onRename(game.name);
  }, [game?.name, onRename]);

  useEffect(() => {
    function onMission(payload: { mission: Mission }) {
      setMission(payload.mission);
    }
    connector.on('game:mission', onMission);
    return () => {
      connector.off('game:mission', onMission);
    };
  }, []);

  useEffect(() => {
    function onMeta(payload: GameMeta) {
      setGameMeta(payload);
    }
    connector.on('game:meta', onMeta);
    return () => {
      connector.off('game:meta', onMeta);
    };
  }, []);

  useEffect(() => {
    function onResults(payload: GameResults) {
      setResults(new Map(payload.stats.map((s) => [s.id, s])));
    }
    connector.on('game:results', onResults);
    connector.requestResults();
    return () => {
      connector.off('game:results', onResults);
    };
  }, []);

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
        <Alert variant="danger">{formatError(joinError)}</Alert>
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
    connector.pause((res: Ack) => {
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
      | { territoryId: number; permanent: boolean; roundsRemaining: number }
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
          roundsRemaining: number;
        } => !('remove' in c),
      );
      return {
        ...prev,
        toxinTerritories: [
          ...prev.toxinTerritories.filter((t) => !changedIds.has(t.id)),
          ...additions.map((a) => ({
            id: a.territoryId,
            permanent: a.permanent,
            roundsRemaining: a.roundsRemaining,
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
  const ended = game.state === 'ended';
  const showMap = game.state === 'playing' || (ended && endReplaying);

  return (
    <>
      <SettingsMenu
        shareUrl={window.location.href}
        hidden={showMap && gamePanelOpen}
        onOpenChange={setSettingsMenuOpen}
      />
      {game.state === 'lobby' ? (
        <Container fluid className="pt-5 pb-5 px-2 px-sm-4">
          <Lobby
            game={game}
            gameMeta={gameMeta}
            setGame={applyGameState}
            selfId={selfId}
            mapNames={mapNames}
            navigate={navigate}
          />
        </Container>
      ) : ended ? (
        <EndPage
          game={game}
          results={results}
          selfId={selfId}
          mapNames={mapNames}
          navigate={navigate}
          logs={logs}
          setChatOpen={setChatOpen}
          settingsMenuOpen={settingsMenuOpen}
          onPanelOpenChange={setGamePanelOpen}
          onViewChange={(view) => setEndReplaying(view === 'replay')}
        />
      ) : (
        <GameMap
          {...gameMapDataProps(game, game.mapName)}
          mission={mission}
          selfId={selfId}
          onTogglePause={togglePause}
          gameEnded={false}
          showReplay={false}
          logs={logs}
          setGame={updateGameFromAction}
          adjustTerritoryTroops={adjustTerritoryTroops}
          adjustToxinTerritories={adjustToxinTerritories}
          setRadiationTerritoryIds={setRadiationTerritoryIds}
          setRadiationUpcomingTerritoryIds={setRadiationUpcomingTerritoryIds}
          setChatOpen={setChatOpen}
          settingsMenuOpen={settingsMenuOpen}
          onPanelOpenChange={setGamePanelOpen}
          navigate={navigate}
        />
      )}
      {!connector.isOffline() && (
        <Chat
          nameById={nameById}
          colorById={colorById}
          transparent={showMap}
          open={chatOpen}
          setOpen={setChatOpen}
        />
      )}
      <OfflineHandoffGate game={game} />
      {game.state === 'playing' && <RotateDeviceOverlay />}
    </>
  );
}

export default Game;
