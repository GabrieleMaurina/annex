import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import EmojiTableOverlay from '../common/emojiTable/EmojiTableOverlay';
import { useTableEmojiReactions } from '../common/emojiTable/useTableEmojiReactions';
import { useWhiteIcon } from '../common/icon';
import BurgerMenu from '../common/menus/BurgerMenu';
import Tip from '../common/tooltips/Tip';
import { connector } from '../connector';
import { GLOBAL_TARGET_ID } from '../game/logic/emoji';
import GameReplayView from '../game/replay/GameReplayView';
import type { FoldedReplay } from '../game/replay/replay';
import { foldStoredReplay } from '../game/replay/replay';
import type {
  Account,
  FriendsOverview,
  GameState,
  PlayerResultStats,
} from '../lib/types';
import SpectatorList from '../lobby/SpectatorList';

interface Props {
  game: GameState;
  results: Map<number, PlayerResultStats> | null;
  storedGameId: string | null;
  selfId: number | null;
  account: Account | null;
  navigate: (path: string) => void;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  settingsMenuOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  onViewChange: (view: 'results' | 'replay') => void;
}

function EndPage({
  game,
  results,
  storedGameId,
  selfId,
  account,
  navigate,
  setChatOpen,
  settingsMenuOpen,
  onPanelOpenChange,
  onViewChange,
}: Props) {
  const [view, setView] = useState<'results' | 'replay'>('results');
  const [replay, setReplay] = useState<FoldedReplay | null>(null);
  const [replayFailed, setReplayFailed] = useState(false);
  const replayRequestedRef = useRef(false);
  const whiteGlobeIcon = useWhiteIcon('/icons/globe.svg');
  const {
    emojiPickerFor,
    emojiPops,
    handleRowClick,
    handleEmojiPick,
    emojiPickerRef,
    rowRefs,
    nameCellRefs,
  } = useTableEmojiReactions(selfId);
  const tableEmojiEnabled = !connector.isOffline();
  const canSendEmoji =
    tableEmojiEnabled && game.players.some((p) => p.id === selfId);
  const [, bumpMuteVersion] = useReducer((c) => c + 1, 0);
  const gameWithAccounts = useMemo(
    () => ({
      ...game,
      players: game.players.map((p) => ({
        ...p,
        userId: results?.get(p.id)?.userId ?? p.userId,
      })),
    }),
    [game, results],
  );
  const playersWithAccounts = gameWithAccounts.players;
  const conductEnabled = tableEmojiEnabled && account !== null;
  const [friends, setFriends] = useState<FriendsOverview>();
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>();

  useEffect(() => {
    if (!conductEnabled) return;
    connector.listFriends(setFriends);
    connector.listBlocks(setBlockedUserIds);
  }, [conductEnabled]);

  function refreshConduct() {
    connector.listFriends(setFriends);
    connector.listBlocks(setBlockedUserIds);
    bumpMuteVersion();
  }

  useEffect(() => {
    if (replayRequestedRef.current) return;
    replayRequestedRef.current = true;
    connector.replay((res) => {
      if (res.ok)
        setReplay(
          foldStoredReplay(
            res.replay,
            res.serverLog,
            game.players.map((p) => p.id),
          ),
        );
      else setReplayFailed(true);
    });
  }, [game.players]);

  return (
    <>
      {view === 'results' && (
        <div
          className="position-fixed top-0 end-0 m-3"
          style={{ zIndex: 1030 }}
        >
          <BurgerMenu navigate={navigate} account={account} hideLogout />
        </div>
      )}
      <GameReplayView
        game={gameWithAccounts}
        conductFriends={friends}
        conductBlockedUserIds={blockedUserIds}
        onConductChange={refreshConduct}
        results={results}
        selfId={selfId}
        mapRenderName={game.mapName}
        replay={replay}
        replayFailed={replayFailed}
        navigate={navigate}
        setChatOpen={setChatOpen}
        settingsMenuOpen={settingsMenuOpen}
        onPanelOpenChange={onPanelOpenChange}
        onViewChange={(v) => {
          setView(v);
          onViewChange(v);
        }}
        showYouLabel={!connector.isOffline()}
        rowClickable={(p) => tableEmojiEnabled && p.id !== selfId && !p.isBot}
        rowRef={(id) => (el) => {
          if (el) rowRefs.current.set(id, el);
        }}
        nameRef={(id) => (el) => {
          if (el) nameCellRefs.current.set(id, el);
        }}
        onRowClick={handleRowClick}
        showMuted
        shareGameId={storedGameId}
        belowTable={
          <>
            {canSendEmoji && (
              <div className="d-flex justify-content-start mt-1">
                <Tip text="Everyone" placement="bottom">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="d-inline-flex align-items-center justify-content-center"
                    style={{ width: 28, height: 28, padding: 0 }}
                    onClick={() => handleRowClick(GLOBAL_TARGET_ID)}
                    ref={(el) => {
                      if (el) {
                        rowRefs.current.set(GLOBAL_TARGET_ID, el);
                        nameCellRefs.current.set(GLOBAL_TARGET_ID, el);
                      } else {
                        rowRefs.current.delete(GLOBAL_TARGET_ID);
                        nameCellRefs.current.delete(GLOBAL_TARGET_ID);
                      }
                    }}
                  >
                    <img
                      src={whiteGlobeIcon ?? '/icons/globe.svg'}
                      width={14}
                      height={14}
                      alt="Everyone"
                    />
                  </Button>
                </Tip>
              </div>
            )}
            {game.spectators.length > 0 && (
              <div className="mt-4">
                <SpectatorList spectators={game.spectators} isHost={false} />
              </div>
            )}
          </>
        }
        overlay={
          tableEmojiEnabled && (
            <EmojiTableOverlay
              emojiPickerFor={emojiPickerFor}
              emojiPops={emojiPops}
              rowRefs={rowRefs}
              nameCellRefs={nameCellRefs}
              emojiPickerRef={emojiPickerRef}
              onPick={handleEmojiPick}
              canSendEmoji={canSendEmoji}
              players={playersWithAccounts}
              navigate={navigate}
              bumpMuteVersion={bumpMuteVersion}
              conduct={
                conductEnabled
                  ? {
                      friends,
                      blockedUserIds,
                      allowReport: game.players.some((p) => p.id === selfId),
                      onChange: refreshConduct,
                    }
                  : undefined
              }
            />
          )
        }
      />
    </>
  );
}

export default EndPage;
