import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Container, Spinner } from 'react-bootstrap';
import Chat from '../common/Chat';
import SettingsMenu from '../common/SettingsMenu';
import GameMap from '../game/GameMap';
import { socket } from '../lib/socket';
import type { Ack, GameState, Player } from '../lib/types';
import Lobby from '../lobby/Lobby';
import EndPage from './EndPage';

interface Props {
  player: Player;
  onNameChange: (name: string) => void;
  selfId: number | null;
  joinError: string;
  mapNames: string[];
  navigate: (path: string) => void;
}

function Game({
  player,
  onNameChange,
  selfId,
  joinError,
  mapNames,
  navigate,
}: Props) {
  const [game, setGame] = useState<GameState | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [endView, setEndView] = useState<'auto' | 'map' | 'stats'>('auto');
  const receivedFirstStateRef = useRef(false);

  useEffect(() => {
    function onState(state: GameState) {
      if (!receivedFirstStateRef.current) {
        receivedFirstStateRef.current = true;
        // Joining a game that's already over (spectating, navigating
        // straight to its URL) should land on the results page immediately
        // — batched with setGame below so it's there on the very first
        // render, with no frame of the map showing first. The brief map
        // peek before results is only for someone who was already watching
        // it play out — see the effect below.
        if (state.state === 'ended') setEndView('stats');
      }
      setGame(state);
    }
    socket.on('game:state', onState);
    return () => {
      socket.off('game:state', onState);
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

  if (joinError) {
    return (
      <Container fluid className="py-5 px-4">
        <Alert variant="danger">{joinError}</Alert>
        <Button onClick={() => navigate('/')}>Back to Home</Button>
      </Container>
    );
  }

  if (!game) {
    return (
      <Container fluid className="py-5 px-4">
        <Spinner size="sm" className="me-2" />
        Loading...
      </Container>
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
          isTeamDeathmatch={game.gameMode === 'Team Deathmatch'}
          isCapitals={game.gameMode === 'Capitals'}
          selfId={selfId}
          turnNumber={game.turnNumber}
          turnPlayerIndex={game.turnPlayerIndex}
          turnPhase={game.turnPhase}
          turnDuration={game.turnDuration}
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
