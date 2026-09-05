import type { Dispatch, SetStateAction } from 'react';
import { useReducer } from 'react';
import { Button } from 'react-bootstrap';
import BurgerMenu from '../common/BurgerMenu';
import EmojiTableOverlay from '../common/emojiTable/EmojiTableOverlay';
import { useTableEmojiReactions } from '../common/emojiTable/useTableEmojiReactions';
import { useWhiteIcon } from '../common/icon';
import Tip from '../common/Tip';
import { connector } from '../connector';
import GameReplayView from '../game/GameReplayView';
import { GLOBAL_TARGET_ID } from '../game/logic/emoji';
import type { LogEntry } from '../game/useGameLogs';
import type { GameState, PlayerResultStats } from '../lib/types';

interface Props {
  game: GameState;
  results: Map<number, PlayerResultStats> | null;
  selfId: number | null;
  mapNames: string[];
  navigate: (path: string) => void;
  logs: LogEntry[];
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  settingsMenuOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  onViewChange: (view: 'results' | 'replay') => void;
}

function EndPage({
  game,
  results,
  selfId,
  mapNames,
  navigate,
  logs,
  setChatOpen,
  settingsMenuOpen,
  onPanelOpenChange,
  onViewChange,
}: Props) {
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
  const [, bumpMuteVersion] = useReducer((c) => c + 1, 0);
  const playersWithAccounts = game.players.map((p) => ({
    ...p,
    userId: results?.get(p.id)?.userId ?? p.userId,
  }));

  return (
    <>
      <div className="position-fixed top-0 end-0 m-3" style={{ zIndex: 1030 }}>
        <BurgerMenu navigate={navigate} />
      </div>
      <GameReplayView
        game={game}
        results={results}
        selfId={selfId}
        mapNames={mapNames}
        mapRenderName={game.mapName}
        logs={logs}
        navigate={navigate}
        setChatOpen={setChatOpen}
        settingsMenuOpen={settingsMenuOpen}
        onPanelOpenChange={onPanelOpenChange}
        onViewChange={onViewChange}
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
        belowTable={
          tableEmojiEnabled && (
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
          )
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
              players={playersWithAccounts}
              navigate={navigate}
              bumpMuteVersion={bumpMuteVersion}
            />
          )
        }
      />
    </>
  );
}

export default EndPage;
