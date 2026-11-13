import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Container, Form, Spinner } from 'react-bootstrap';
import Chat from '../common/Chat';
import { formatError } from '../common/formatError';
import WhiteIcon from '../common/icons/WhiteIcon';
import SettingsMenu from '../common/menus/SettingsMenu';
import { useUiHidden } from '../common/menus/shortcuts/uiHidden';
import { connector } from '../connector';
import { END_CARD_SHOWN_MS } from '../game/endCard/endCard';
import GameMap from '../game/GameMap';
import { gameMapDataProps } from '../game/gameMapProps';
import { useLocalColors } from '../game/logic/colorOverrides';
import { useGameLogs } from '../game/logs/useGameLogs';
import OfflineHandoffGate from '../game/OfflineHandoffGate';
import RotateDeviceOverlay from '../game/RotateDeviceOverlay';
import type { TurnFlash } from '../game/turnStart/turnStart';
import { changeMusic, playSound, setMusicMapType } from '../lib/sounds';
import type {
  Account,
  Ack,
  BotSpeed,
  GameMeta,
  GameResults,
  GameState,
  Mission,
  PlayerResultStats,
} from '../lib/types';
import Lobby from '../lobby/Lobby';
import TutorialOverlay from '../tutorials/TutorialOverlay';
import type { Tutorial } from '../tutorials/tutorials';
import { Gate } from '../ui/containers/PageGate';
import EndPage from './EndPage';

interface PlayerStatus {
  state: GameState['state'];
  eliminated: Set<number>;
  surrendered: Set<number>;
  connected: Set<number>;
}

function playerStatus(state: GameState): PlayerStatus {
  function idsWhere(test: (p: GameState['players'][number]) => boolean) {
    return new Set(state.players.filter(test).map((p) => p.id));
  }
  return {
    state: state.state,
    eliminated: idsWhere((p) => p.eliminated),
    surrendered: idsWhere((p) => p.surrendered),
    connected: idsWhere((p) => p.connected),
  };
}

function hasNewId(ids: Set<number>, previous: Set<number>): boolean {
  return [...ids].some((id) => !previous.has(id));
}

interface Props {
  selfId: number | null;
  joinError: string;
  needsPassword: boolean;
  passwordError: boolean;
  onSubmitPassword: (password: string) => void;
  account: Account | null;
  navigate: (path: string) => void;
  onRename: (name: string) => void;
  onMapOpenChange: (open: boolean) => void;
  tutorial: Tutorial | null;
}

function Game({
  selfId: identifiedSelfId,
  joinError,
  needsPassword,
  passwordError,
  onSubmitPassword,
  account,
  navigate,
  onRename,
  onMapOpenChange,
  tutorial,
}: Props) {
  const [game, setGame] = useState<GameState | null>(null);
  const uiHidden = useUiHidden();
  const selfId = game?.selfId ?? identifiedSelfId;
  const [gameMeta, setGameMeta] = useState<GameMeta | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [gamePanelOpen, setGamePanelOpen] = useState(false);
  const [endReplaying, setEndReplaying] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [mission, setMission] = useState<Mission | null>(null);
  const [results, setResults] = useState<Map<number, PlayerResultStats> | null>(
    null,
  );
  const [storedGameId, setStoredGameId] = useState<string | null>(null);
  const [startGates, setStartGates] = useState(0);
  const [turnFlash, setTurnFlash] = useState<TurnFlash | null>(null);
  const showMap =
    game?.state === 'playing' ||
    celebrating ||
    (game?.state === 'ended' && endReplaying);
  const receivedFirstStateRef = useRef(false);
  const prevStateRef = useRef<GameState['state'] | null>(null);
  const prevTurnPhaseRef = useRef<GameState['turnPhase'] | null>(null);
  const playerStatusRef = useRef<PlayerStatus | null>(null);
  const localColors = useLocalColors(game);
  const logs = useGameLogs(localColors.shownGame);

  const playPlayerStatusSounds = useCallback((state: GameState) => {
    const status = playerStatus(state);
    const previous = playerStatusRef.current;
    if (previous && state.state !== 'ended') {
      if (hasNewId(status.eliminated, previous.eliminated)) playSound('bell');
      if (hasNewId(status.surrendered, previous.surrendered))
        playSound('surrender');
      if (state.state === 'playing' && previous.state === 'playing') {
        if (hasNewId(status.connected, previous.connected))
          playSound('connect');
        if (hasNewId(previous.connected, status.connected))
          playSound('disconnect');
      }
    }
    playerStatusRef.current = status;
  }, []);

  const applyGameState = useCallback(
    (state: GameState) => {
      playPlayerStatusSounds(state);
      setMusicMapType(
        state.state === 'playing' ? (state.mapGeneration?.type ?? null) : null,
      );
      if (!receivedFirstStateRef.current) {
        receivedFirstStateRef.current = true;
        if (state.state === 'lobby') playSound('join');
        if (state.state === 'lobby' || state.state === 'playing') changeMusic();
      } else if (
        prevStateRef.current === 'lobby' &&
        state.state === 'playing'
      ) {
        playSound('start');
        changeMusic();
        setStartGates((n) => n + 1);
      } else if (
        prevStateRef.current === 'playing' &&
        state.state === 'ended'
      ) {
        playSound('end');
        setCelebrating(true);
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
    },
    [playPlayerStatusSounds],
  );

  function updateGameFromAction(state: GameState) {
    playPlayerStatusSounds(state);
    if (prevStateRef.current === 'playing' && state.state === 'ended') {
      playSound('end');
      setCelebrating(true);
    }
    prevStateRef.current = state.state;
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
      setMusicMapType(null);
      if (receivedFirstStateRef.current) changeMusic();
    };
  }, [applyGameState]);

  useEffect(() => {
    function onTurnStarted(payload: { playerId: number }) {
      const isGameStart = prevStateRef.current !== 'playing';
      prevTurnPhaseRef.current = 'deploy';
      if (!isGameStart) {
        const isOwnTurn = payload.playerId === selfId;
        playSound(isOwnTurn ? 'turn' : 'phase');
        if (isOwnTurn) setTurnFlash({ playerId: payload.playerId });
      }
    }
    connector.on('game:turnStarted', onTurnStarted);
    return () => {
      connector.off('game:turnStarted', onTurnStarted);
    };
  }, [selfId]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = setTimeout(() => setCelebrating(false), END_CARD_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [celebrating]);

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
      setStoredGameId(payload.gameId ?? null);
    }
    connector.on('game:results', onResults);
    connector.requestResults();
    return () => {
      connector.off('game:results', onResults);
    };
  }, []);

  useEffect(() => {
    function onRestarted() {
      prevStateRef.current = 'lobby';
      setMission(null);
      setResults(null);
      setStoredGameId(null);
      setEndReplaying(false);
    }
    connector.on('offline:restarted', onRestarted);
    return () => {
      connector.off('offline:restarted', onRestarted);
    };
  }, []);

  useEffect(() => {
    onMapOpenChange(showMap);
    return () => onMapOpenChange(false);
  }, [showMap, onMapOpenChange]);

  if (needsPassword) {
    return (
      <Container
        fluid
        className="d-flex flex-column justify-content-center align-items-center gap-2"
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
          <Button
            className="d-inline-flex align-items-center justify-content-center gap-1"
            type="submit"
          >
            <WhiteIcon path="/icons/lock.svg" />
            Join
          </Button>
          <Button
            className="d-inline-flex align-items-center justify-content-center gap-1"
            variant="secondary"
            onClick={() => navigate('/')}
          >
            <WhiteIcon path="/icons/step-back.svg" />
            Back to home
          </Button>
        </Form>
        {passwordError && (
          <Alert variant="danger" className="mb-0 py-2">
            Incorrect password
          </Alert>
        )}
      </Container>
    );
  }

  if (joinError) {
    return (
      <Container fluid className="py-5 px-4">
        <Alert variant="danger">{formatError(joinError)}</Alert>
        <Button
          className="d-inline-flex align-items-center justify-content-center gap-1"
          onClick={() => navigate('/')}
        >
          <WhiteIcon path="/icons/step-back.svg" />
          Back to home
        </Button>
      </Container>
    );
  }

  if (!game) {
    return (
      <div className="position-fixed top-0 start-50 translate-middle-x mt-3 d-flex align-items-center">
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

  function cycleBotSpeed() {
    const order: BotSpeed[] = ['slow', 'medium', 'fast'];
    const next = (speed: BotSpeed) => order[(order.indexOf(speed) + 1) % 3];
    let previousSpeed: BotSpeed | null = null;
    setGame((prev) => {
      if (!prev) return prev;
      previousSpeed = prev.botSpeed;
      return { ...prev, botSpeed: next(prev.botSpeed) };
    });
    connector.cycleBotSpeed((res: Ack) => {
      if (res.ok) setGame(res.game);
      else if (previousSpeed !== null) {
        const reverted = previousSpeed;
        setGame((prev) => (prev ? { ...prev, botSpeed: reverted } : prev));
      }
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
  const shownGame = localColors.shownGame ?? game;
  const colorById = new Map(shownGame.players.map((p) => [p.id, p.color]));
  const ended = game.state === 'ended';

  return (
    <>
      {startGates > 0 && <Gate key={startGates} silent />}
      <SettingsMenu
        hidden={(showMap && gamePanelOpen) || uiHidden}
        onOpenChange={setSettingsMenuOpen}
        lockScrollOnFullscreen={showMap}
      />
      {game.state === 'lobby' ? (
        <Container fluid className="pt-5 pb-5 px-2 px-sm-4">
          <Lobby
            game={game}
            gameMeta={gameMeta}
            setGame={applyGameState}
            selfId={selfId}
            account={account}
            navigate={navigate}
          />
        </Container>
      ) : ended && !celebrating ? (
        <EndPage
          game={shownGame}
          results={results}
          storedGameId={storedGameId}
          selfId={selfId}
          account={account}
          navigate={navigate}
          setChatOpen={setChatOpen}
          settingsMenuOpen={settingsMenuOpen}
          onPanelOpenChange={setGamePanelOpen}
          onViewChange={(view) => setEndReplaying(view === 'replay')}
        />
      ) : (
        <GameMap
          key={startGates}
          {...gameMapDataProps(shownGame, game.mapName)}
          mission={mission}
          selfId={selfId}
          onTogglePause={togglePause}
          onCycleBotSpeed={cycleBotSpeed}
          results={results}
          gameEnded={ended}
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
          tutorialHighlight={tutorial?.highlight}
          recoloredIds={localColors.recoloredIds}
          onCycleColor={localColors.cycleColor}
          turnFlash={turnFlash}
        />
      )}
      {!connector.isOffline() && (
        <Chat
          key={
            game.anonymous === 'on' && game.state !== 'lobby' ? 'anon' : 'open'
          }
          nameById={nameById}
          colorById={colorById}
          open={chatOpen}
          setOpen={setChatOpen}
          hidden={uiHidden}
        />
      )}
      <OfflineHandoffGate game={shownGame} />
      {tutorial && game.state !== 'lobby' && (
        <TutorialOverlay
          tutorial={tutorial}
          account={account}
          navigate={navigate}
        />
      )}
      {game.state === 'playing' && <RotateDeviceOverlay />}
    </>
  );
}

export default Game;
