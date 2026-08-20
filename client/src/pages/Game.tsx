import { useEffect, useState } from 'react';
import { Alert, Button, Container, Spinner } from 'react-bootstrap';
import Chat from '../common/Chat';
import SettingsMenu from '../common/SettingsMenu';
import GameMap from '../game/GameMap';
import { socket } from '../lib/socket';
import type { GameState, Player } from '../lib/types';
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

  useEffect(() => {
    function onState(state: GameState) {
      setGame(state);
    }
    socket.on('game:state', onState);
    return () => {
      socket.off('game:state', onState);
    };
  }, []);

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

  const nameById = new Map(
    [...game.players, ...game.spectators].map((p) => [p.id, p.name]),
  );
  const colorById = new Map(game.players.map((p) => [p.id, p.color]));

  return (
    <>
      <SettingsMenu shareUrl={window.location.href} />
      {game.state === 'playing' ? (
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
          selectedTerritoryId={game.selectedTerritoryId}
          fortifyStartTerritoryId={game.fortifyStartTerritoryId}
          fortifyEndTerritoryId={game.fortifyEndTerritoryId}
          attackStartTerritoryId={game.attackStartTerritoryId}
          attackEndTerritoryId={game.attackEndTerritoryId}
          attackConquestMinTroops={game.attackConquestMinTroops}
          nextSetBaseValues={game.nextSetBaseValues}
          setGame={setGame}
          setChatOpen={setChatOpen}
          navigate={navigate}
        />
      ) : game.state === 'ended' ? (
        <EndPage game={game} selfId={selfId} navigate={navigate} />
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
      <Chat
        nameById={nameById}
        colorById={colorById}
        transparent={game.state === 'playing'}
        open={chatOpen}
        setOpen={setChatOpen}
      />
    </>
  );
}

export default Game;
