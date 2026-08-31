import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import EmojiTableOverlay from '../common/emojiTable/EmojiTableOverlay';
import { useTableEmojiReactions } from '../common/emojiTable/useTableEmojiReactions';
import { connector } from '../connector';
import { saveGameName, saveGameSettings } from '../lib/player';
import type {
  Ack,
  BotDifficulty,
  BotPersonality,
  GameMeta,
  GameSettingsInput,
  GameState,
  GenerateMapInput,
  Player,
} from '../lib/types';
import BannedList from './BannedList';
import Header from './Header';
import PlayerRoster from './PlayerRoster';
import SettingsPanel from './SettingsPanel';
import SpectatorList from './SpectatorList';

interface Props {
  game: GameState;
  gameMeta: GameMeta | null;
  setGame: (game: GameState) => void;
  player: Player;
  onNameChange: (name: string) => void;
  selfId: number | null;
  mapNames: string[];
  navigate: (path: string) => void;
}

function Lobby({
  game,
  gameMeta,
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
    connector.updateSettings(settings, (res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        return;
      }
      setSettingsError('');
      setGame(res.game);
      if (settings.name !== undefined) saveGameName(res.game.name);
    });
  }

  function generateMap(
    input: GenerateMapInput,
    onSettled?: (ok: boolean, mapName?: string) => void,
  ) {
    connector.generateMap(input, (res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        onSettled?.(false);
        return;
      }
      setSettingsError('');
      setGame(res.game);
      onSettled?.(true, res.game.mapName);
    });
  }

  const isHost = game.hostId === selfId;
  const isTeamDeathmatch = game.gameMode === 'Team Deathmatch';
  const maxTeams = game.players.length;
  const teamCount = new Set(game.players.map((p) => p.team)).size;
  const canStart =
    game.players.length >= 2 &&
    (!isTeamDeathmatch || teamCount >= 2) &&
    !(isTeamDeathmatch && game.alliances === 'on');

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
    connector.cycleColor((res: Ack) => {
      if (res.ok) setGame(res.game);
    });
  }

  function cycleBotColor(botPlayerId: number) {
    connector.cycleBotColor({ botPlayerId }, (res: Ack) => {
      if (res.ok) setGame(res.game);
    });
  }

  function addSlot() {
    applySettings({ slots: game.slots + 1 });
  }

  function addBot() {
    const lastBot = [...game.players].reverse().find((p) => p.isBot);
    const difficulty = lastBot?.botDifficulty ?? 'easy';
    const personality = lastBot?.botPersonality ?? 'balanced';
    connector.addBot({ difficulty, personality }, (res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        return;
      }
      setSettingsError('');
      setGame(res.game);
    });
  }

  function setBotProfile(
    botPlayerId: number,
    difficulty: BotDifficulty | 'random',
    personality: BotPersonality | 'random',
  ) {
    connector.setBotProfile(
      { botPlayerId, difficulty, personality },
      (res: Ack) => {
        if (!res.ok) {
          setSettingsError(res.error);
          return;
        }
        setSettingsError('');
        setGame(res.game);
      },
    );
  }

  function removeBot(botPlayerId: number) {
    connector.removeBot({ botPlayerId }, (res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        return;
      }
      setSettingsError('');
      setGame(res.game);
    });
  }

  function unbanPlayer(id: number) {
    bannedIdsRef.current = bannedIdsRef.current.filter(
      (bannedId) => bannedId !== id,
    );
    applySettings({ bannedPlayerIds: bannedIdsRef.current });
  }

  function startGame() {
    connector.startGame((res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        return;
      }
      setSettingsError('');
      saveGameSettings(
        {
          ...(res.game.mapGeneration
            ? { mapGeneration: res.game.mapGeneration }
            : { mapName: res.game.mapName }),
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
          alliances: res.game.alliances,
          turnDuration: res.game.turnDuration,
          ...(gameMeta ? { visibility: gameMeta.visibility } : {}),
        },
        res.game.slots,
      );
      setGame(res.game);
    });
  }

  return (
    <>
      <div className="text-center mb-2">
        <span
          className={`badge ${connector.isOffline() ? 'bg-secondary' : 'bg-success'}`}
        >
          {connector.isOffline() ? 'Offline' : 'Online'}
        </span>
      </div>
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

      <div className="mb-1">
        <SettingsPanel
          game={game}
          gameMeta={gameMeta}
          isHost={isHost}
          mapNames={mapNames}
          applySettings={applySettings}
          generateMap={generateMap}
          headerActions={
            <div className="d-flex flex-column flex-sm-row align-items-start gap-2">
              {isHost && (
                <Button disabled={!canStart} onClick={startGame}>
                  Start
                </Button>
              )}
              <Button variant="secondary" onClick={() => navigate('/')}>
                Leave
              </Button>
            </div>
          }
        />
      </div>

      <PlayerRoster
        game={game}
        isHost={isHost}
        isTeamDeathmatch={isTeamDeathmatch}
        maxTeams={maxTeams}
        selfId={selfId}
        setPlayerTeam={setPlayerTeam}
        cycleColor={cycleColor}
        cycleBotColor={cycleBotColor}
        removeSlot={removeSlot}
        addSlot={addSlot}
        addBot={addBot}
        addLocalPlayer={
          connector.isOffline() ? () => connector.addLocalPlayer('') : undefined
        }
        setLocalPlayerName={
          connector.isOffline()
            ? (playerId, name) => connector.setLocalPlayerName(playerId, name)
            : undefined
        }
        setBotProfile={setBotProfile}
        removeBot={removeBot}
        rowRefs={rowRefs}
        nameCellRefs={nameCellRefs}
        onEmojiRowClick={handleRowClick}
      />
      {!connector.isOffline() && (
        <EmojiTableOverlay
          emojiPickerFor={emojiPickerFor}
          emojiPops={emojiPops}
          rowRefs={rowRefs}
          nameCellRefs={nameCellRefs}
          emojiPickerRef={emojiPickerRef}
          onPick={handleEmojiPick}
        />
      )}

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
