import { useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import BurgerMenu from '../common/BurgerMenu';
import EmojiTableOverlay from '../common/emojiTable/EmojiTableOverlay';
import { useTableEmojiReactions } from '../common/emojiTable/useTableEmojiReactions';
import { formatError } from '../common/formatError';
import { connector } from '../connector';
import {
  getGameLocalPlayers,
  getRestoredBotInput,
  saveGameSettings,
} from '../lib/player';
import type {
  Account,
  Ack,
  BotDifficulty,
  BotPersonality,
  GameMeta,
  GameSettingsInput,
  GameState,
  GenerateMapInput,
  SavedBot,
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
  selfId: number | null;
  account: Account | null;
  navigate: (path: string) => void;
}

function Lobby({ game, gameMeta, setGame, selfId, account, navigate }: Props) {
  const [settingsError, setSettingsError] = useState('');
  const bannedIdsRef = useRef<number[]>([]);
  const botInputsRef = useRef<Map<number, SavedBot>>(new Map());
  const [, bumpMuteVersion] = useReducer((c) => c + 1, 0);
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

  function selectPlayerMap(mapId: string) {
    connector.selectPlayerMap({ mapId }, (res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        return;
      }
      setSettingsError('');
      setGame(res.game);
    });
  }

  const isHost = game.hostId === selfId;
  const isTeamDeathmatch = game.gameMode === 'Team Deathmatch';
  const maxTeams = game.players.length;
  const teamCount = new Set(game.players.map((p) => p.team)).size;
  const hasMap = !!game.mapGeneration || !!game.playerMapId;
  const canStart =
    hasMap &&
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
      if (connector.isOffline()) connector.removeLocalPlayer(player.id);
      else banId(player.id);
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

  function savedBots(state: GameState): SavedBot[] {
    return state.players
      .filter((p) => p.isBot)
      .map(
        (p) =>
          botInputsRef.current.get(p.id) ??
          getRestoredBotInput(p.id) ?? {
            difficulty: p.botDifficulty ?? 'easy',
            personality: p.botPersonality ?? 'balanced',
          },
      );
  }

  function addBot() {
    const lastBot = [...game.players].reverse().find((p) => p.isBot);
    const difficulty = lastBot?.botDifficulty ?? 'easy';
    const personality = lastBot?.botPersonality ?? 'balanced';
    const knownBotIds = new Set(game.players.map((p) => p.id));
    connector.addBot({ difficulty, personality }, (res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        return;
      }
      setSettingsError('');
      const added = res.game.players.find(
        (p) => p.isBot && !knownBotIds.has(p.id),
      );
      if (added)
        botInputsRef.current.set(added.id, { difficulty, personality });
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
        botInputsRef.current.set(botPlayerId, { difficulty, personality });
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

  function persistSettings(state: GameState) {
    saveGameSettings(
      {
        ...(state.mapGeneration
          ? { mapGeneration: state.mapGeneration }
          : state.playerMapId
            ? { playerMapId: state.playerMapId, mapName: state.mapName }
            : { mapName: state.mapName }),
        gameMode: state.gameMode,
        blitz: state.blitz,
        defenceDice: state.defenceDice,
        cards: state.cards,
        placement: state.placement,
        fortification: state.fortification,
        entrenchments: state.entrenchments,
        toxins: state.toxins,
        portals: state.portals,
        radiations: state.radiations,
        nukes: state.nukes,
        starvation: state.starvation,
        roundTroops: state.roundTroops,
        bounties: state.bounties,
        supplyLines: state.supplyLines,
        fogOfWar: state.fogOfWar,
        alliances: state.alliances,
        turnDuration: state.turnDuration,
        disconnectBotDifficulty: state.disconnectBotDifficulty,
        disconnectBotPersonality: state.disconnectBotPersonality,
        ...(gameMeta ? { visibility: gameMeta.visibility } : {}),
      },
      state.slots,
      savedBots(state),
      connector.isOffline()
        ? state.players
            .filter((p) => !p.isBot && p.id !== state.hostId)
            .map((p) => p.name)
        : getGameLocalPlayers(),
    );
  }

  function startGame() {
    if (
      !connector.isOffline() &&
      game.players.filter((p) => !p.isBot).length < 2
    ) {
      persistSettings(game);
      connector.convertToOffline(game);
      navigate('/games/offline');
      return;
    }
    connector.startGame((res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        return;
      }
      setSettingsError('');
      persistSettings(res.game);
      setGame(res.game);
    });
  }

  return (
    <>
      <div className="position-fixed top-0 end-0 m-3" style={{ zIndex: 1030 }}>
        <BurgerMenu navigate={navigate} />
      </div>
      <div className="text-center mb-2">
        <span
          className={`badge ${connector.isOffline() ? 'bg-secondary' : 'bg-success'}`}
        >
          {connector.isOffline() ? 'Offline' : 'Online'}
        </span>
      </div>
      <Header game={game} isHost={isHost} applySettings={applySettings} />

      {settingsError && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setSettingsError('')}
        >
          {formatError(settingsError)}
        </Alert>
      )}

      <div className="mb-1">
        <SettingsPanel
          game={game}
          gameMeta={gameMeta}
          isHost={isHost}
          account={account}
          applySettings={applySettings}
          generateMap={generateMap}
          selectPlayerMap={selectPlayerMap}
          headerActions={
            isHost && (
              <Button disabled={!canStart} onClick={startGame}>
                Start
              </Button>
            )
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
          bumpMuteVersion={bumpMuteVersion}
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
