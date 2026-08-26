import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import EmojiTableOverlay from '../common/EmojiTableOverlay';
import { useTableEmojiReactions } from '../common/useTableEmojiReactions';
import { saveGameName, saveGameSettings } from '../lib/player';
import { socket } from '../lib/socket';
import type { Ack, GameSettingsInput, GameState, Player } from '../lib/types';
import BannedList from './BannedList';
import Header from './Header';
import PlayerRoster from './PlayerRoster';
import SettingsPanel from './SettingsPanel';
import SpectatorList from './SpectatorList';

interface Props {
  game: GameState;
  setGame: (game: GameState) => void;
  player: Player;
  onNameChange: (name: string) => void;
  selfId: number | null;
  mapNames: string[];
  navigate: (path: string) => void;
}

function Lobby({
  game,
  setGame,
  player,
  onNameChange,
  selfId,
  mapNames,
  navigate,
}: Props) {
  const [settingsError, setSettingsError] = useState('');
  const bannedIdsRef = useRef<number[]>([]);
  const {
    emojiPickerFor,
    emojiPops,
    handleRowClick,
    handleEmojiPick,
    emojiPickerRef,
    rowRefs,
    nameCellRefs,
  } = useTableEmojiReactions(selfId);

  useEffect(() => {
    bannedIdsRef.current = game.bannedPlayers.map((p) => p.id);
  }, [game]);

  function applySettings(settings: GameSettingsInput) {
    socket.emit('game:settings', settings, (res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        return;
      }
      setSettingsError('');
      setGame(res.game);
      if (settings.name !== undefined) saveGameName(res.game.name);
    });
  }

  const isHost = game.hostId === selfId;
  const isTeamDeathmatch = game.gameMode === 'Team Deathmatch';
  const maxTeams = game.players.length;
  const teamCount = new Set(game.players.map((p) => p.team)).size;
  const canStart =
    game.players.length >= 2 && (!isTeamDeathmatch || teamCount >= 2);

  function banId(id: number) {
    bannedIdsRef.current = [...bannedIdsRef.current, id];
    applySettings({ bannedPlayerIds: bannedIdsRef.current });
  }

  function removeSlot(index: number) {
    const player = game.players[index];
    if (player) {
      banId(player.id);
    } else {
      applySettings({ slots: game.slots - 1 });
    }
  }

  function setPlayerTeam(playerId: number, team: number) {
    applySettings({ playerTeam: { playerId, team } });
  }

  function cycleColor() {
    socket.emit('game:cycleColor', (res: Ack) => {
      if (res.ok) setGame(res.game);
    });
  }

  function addSlot() {
    applySettings({ slots: game.slots + 1 });
  }

  function unbanPlayer(id: number) {
    bannedIdsRef.current = bannedIdsRef.current.filter(
      (bannedId) => bannedId !== id,
    );
    applySettings({ bannedPlayerIds: bannedIdsRef.current });
  }

  function startGame() {
    socket.emit('game:start', (res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        return;
      }
      setSettingsError('');
      saveGameSettings(
        {
          mapName: res.game.mapName,
          gameMode: res.game.gameMode,
          blitz: res.game.blitz,
          defenceDice: res.game.defenceDice,
          cards: res.game.cards,
          placement: res.game.placement,
          fortification: res.game.fortification,
          entrenchments: res.game.entrenchments,
          toxins: res.game.toxins,
          portals: res.game.portals,
          radiations: res.game.radiations,
          starvation: res.game.starvation,
          turnTroops: res.game.turnTroops,
          bounties: res.game.bounties,
          supplyLines: res.game.supplyLines,
          fogOfWar: res.game.fogOfWar,
          turnDuration: res.game.turnDuration,
          visibility: res.game.visibility,
        },
        res.game.slots,
      );
      setGame(res.game);
    });
  }

  return (
    <>
      <Header
        game={game}
        isHost={isHost}
        applySettings={applySettings}
        player={player}
        onNameChange={onNameChange}
      />

      {settingsError && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setSettingsError('')}
        >
          {settingsError}
        </Alert>
      )}

      <div className="d-flex justify-content-between align-items-start mb-4">
        <SettingsPanel
          game={game}
          isHost={isHost}
          mapNames={mapNames}
          applySettings={applySettings}
        />

        <div className="d-flex flex-column gap-2">
          {isHost && (
            <Button disabled={!canStart} onClick={startGame}>
              Start
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate('/')}>
            Leave
          </Button>
        </div>
      </div>

      <PlayerRoster
        game={game}
        isHost={isHost}
        isTeamDeathmatch={isTeamDeathmatch}
        maxTeams={maxTeams}
        selfId={selfId}
        setPlayerTeam={setPlayerTeam}
        cycleColor={cycleColor}
        removeSlot={removeSlot}
        addSlot={addSlot}
        rowRefs={rowRefs}
        nameCellRefs={nameCellRefs}
        onEmojiRowClick={handleRowClick}
      />
      <EmojiTableOverlay
        emojiPickerFor={emojiPickerFor}
        emojiPops={emojiPops}
        rowRefs={rowRefs}
        nameCellRefs={nameCellRefs}
        emojiPickerRef={emojiPickerRef}
        onPick={handleEmojiPick}
      />

      <SpectatorList
        spectators={game.spectators}
        isHost={isHost}
        banId={banId}
      />

      <BannedList
        bannedPlayers={game.bannedPlayers}
        isHost={isHost}
        unbanPlayer={unbanPlayer}
      />
    </>
  );
}

export default Lobby;
