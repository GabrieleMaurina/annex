import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Container, Form, Spinner } from 'react-bootstrap';
import Chat from '../common/Chat';
import SettingsMenu from '../common/SettingsMenu';
import GameMap from '../game/GameMap';
import { useGameLogs } from '../game/useGameLogs';
import { socket } from '../lib/socket';
import { playSound } from '../lib/sounds';
import type { Ack, GameState, Mission, Player } from '../lib/types';
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
  const receivedFirstStateRef = useRef(false);
  const prevStateRef = useRef<GameState['state'] | null>(null);
  const logs = useGameLogs(game);

  useEffect(() => {
    function onState(state: GameState) {
      if (!receivedFirstStateRef.current) {
        receivedFirstStateRef.current = true;
        if (state.state === 'ended') setEndView('stats');
      } else {
        if (prevStateRef.current === 'lobby' && state.state === 'playing')
          playSound('start');
        if (prevStateRef.current === 'playing' && state.state === 'ended')
          playSound('end');
      }
      prevStateRef.current = state.state;
      setGame(state);
    }
    socket.on('game:state', onState);
    return () => {
      socket.off('game:state', onState);
    };
  }, []);

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
          gameMode={game.gameMode}
          isTeamDeathmatch={game.gameMode === 'Team Deathmatch'}
          isCapitals={game.gameMode === 'Capitals'}
          mission={mission}
          selfId={selfId}
          turnNumber={game.turnNumber}
          turnPlayerIndex={game.turnPlayerIndex}
          turnPhase={game.turnPhase}
          turnDuration={game.turnDuration}
          fortification={game.fortification}
          entrenchment={game.entrenchment}
          portalTerritoryIds={game.portalTerritoryIds}
          portalsEnabled={game.portalsEnabled}
          troopsToDeploy={game.troopsToDeploy}
          turnStartedAt={game.turnStartedAt}
          paused={game.paused}
          hostId={game.hostId}
          onTogglePause={togglePause}
          selectedTerritoryId={game.selectedTerritoryId}
          fortifyStartTerritoryId={game.fortifyStartTerritoryId}
          fortifyEndTerritoryId={game.fortifyEndTerritoryId}
          attackStartTerritoryId={game.attackStartTerritoryId}
          attackEndTerritoryId={game.attackEndTerritoryId}
          attackConquestMinTroops={game.attackConquestMinTroops}
          nextSetBaseValues={game.nextSetBaseValues}
          upcomingSetValues={game.upcomingSetValues}
          gameEnded={game.state === 'ended'}
          showReplay={endView === 'map'}
          logs={logs}
          setGame={setGame}
          setChatOpen={setChatOpen}
          navigate={navigate}
        />
      ) : game.state === 'ended' ? (
        <EndPage
          game={game}
          selfId={selfId}
          navigate={navigate}
          onViewMap={() => setEndView('map')}
        />
      ) : (
        <Container fluid className="pt-3 pb-5 px-4">
          <Lobby
            game={game}
            setGame={setGame}
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
