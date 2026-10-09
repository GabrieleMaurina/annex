import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import { isPlayerMuted } from '../../common/mutedPlayers';
import type { ResultRow } from '../../common/ResultsTable';
import { contrastTextColor, playerColor } from '../../lib/palette';
import { playSound } from '../../lib/sounds';
import type { GameState } from '../../lib/types';
import GameEndResults from '../GameEndResults';
import GameMap from '../GameMap';
import { gameMapDataProps, noopGameMapHandlers } from '../gameMapProps';
import type { FoldedReplay } from './replay';
import ReplayLoading from './ReplayLoading';

interface Props {
  game: GameState;
  results: Map<number, ResultRow> | null;
  selfId: number | null;
  mapRenderName: string;
  replay: FoldedReplay | null;
  replayFailed?: boolean;
  navigate: (path: string) => void;
  showYouLabel?: boolean;
  rowClickable?: (player: GameState['players'][number]) => boolean;
  rowRef?: (playerId: number) => (el: HTMLTableRowElement | null) => void;
  nameRef?: (playerId: number) => (el: HTMLDivElement | null) => void;
  onRowClick?: (playerId: number) => void;
  belowTable?: ReactNode;
  overlay?: ReactNode;
  setChatOpen?: Dispatch<SetStateAction<boolean>>;
  settingsMenuOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
  onViewChange?: (view: 'results' | 'replay') => void;
  showMuted?: boolean;
}

function GameReplayView({
  game,
  results,
  selfId,
  mapRenderName,
  replay,
  replayFailed,
  navigate,
  showYouLabel,
  rowClickable,
  rowRef,
  nameRef,
  onRowClick,
  belowTable,
  overlay,
  setChatOpen,
  settingsMenuOpen,
  onPanelOpenChange,
  onViewChange,
  showMuted,
}: Props) {
  const [view, setView] = useState<'results' | 'replay'>('results');
  const [replayIndex, setReplayIndex] = useState(0);
  const previousReplayIndexRef = useRef<number | null>(null);

  useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);

  useEffect(() => {
    const previous = previousReplayIndexRef.current;
    const stepped = previous !== null && replayIndex === previous + 1;
    previousReplayIndexRef.current = replayIndex;
    if (
      stepped &&
      (replay?.emoji ?? []).some(
        (e) => e.afterFrame === replayIndex && !isPlayerMuted(e.senderId),
      )
    )
      playSound('emoji');
  }, [replayIndex, replay]);

  if (view === 'results') {
    return (
      <GameEndResults
        game={game}
        results={results}
        selfId={selfId}
        navigate={navigate}
        onWatchReplay={() => {
          previousReplayIndexRef.current = null;
          setView('replay');
        }}
        showYouLabel={showYouLabel}
        rowClickable={rowClickable}
        rowRef={rowRef}
        nameRef={nameRef}
        onRowClick={onRowClick}
        belowTable={belowTable}
        overlay={overlay}
        showMuted={showMuted}
      />
    );
  }

  if (!replay)
    return replayFailed ? (
      <div className="d-flex flex-column align-items-center gap-3 py-5">
        <p>Replay unavailable.</p>
        <Button onClick={() => setView('results')}>Results</Button>
      </div>
    ) : (
      <ReplayLoading />
    );

  const nameById = new Map(game.players.map((p) => [p.id, p.name]));
  const colorById = new Map(game.players.map((p) => [p.id, p.color]));
  const shownChat = replay.chat.filter((m) => m.afterFrame <= replayIndex);
  const shownEmoji = replay.emoji.filter((e) => e.afterFrame <= replayIndex);

  return (
    <>
      <GameMap
        {...gameMapDataProps(game, mapRenderName)}
        {...noopGameMapHandlers}
        setChatOpen={setChatOpen ?? noopGameMapHandlers.setChatOpen}
        onPanelOpenChange={
          onPanelOpenChange ?? noopGameMapHandlers.onPanelOpenChange
        }
        mission={null}
        selfId={selfId}
        results={results}
        gameEnded
        showReplay
        replayData={replay.data}
        onReplayIndexChange={setReplayIndex}
        logs={[]}
        settingsMenuOpen={settingsMenuOpen ?? false}
        navigate={navigate}
      />
      <Button
        variant="secondary"
        size="sm"
        className="position-fixed bottom-0 end-0 m-3"
        style={{ zIndex: 5 }}
        onClick={() => setView('results')}
      >
        Results
      </Button>
      {(shownChat.length > 0 || shownEmoji.length > 0) && (
        <div
          className="position-fixed bottom-0 start-0 m-3 p-2 rounded small"
          style={{
            zIndex: 5,
            maxWidth: 280,
            maxHeight: '40vh',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
          }}
        >
          {shownChat.map((message, i) => (
            <div key={`c${i}`}>
              <span
                className="badge me-1"
                style={{
                  backgroundColor: playerColor(
                    colorById.get(message.senderId) ?? 0,
                  ),
                  color: contrastTextColor(
                    playerColor(colorById.get(message.senderId) ?? 0),
                  ),
                }}
              >
                {message.name}
              </span>
              {message.message}
            </div>
          ))}
          {shownEmoji.map((e, i) => (
            <div key={`e${i}`}>
              {nameById.get(e.senderId) ?? '?'} {e.emoji}
              {e.targetPlayerId !== null
                ? ` → ${nameById.get(e.targetPlayerId) ?? '?'}`
                : ''}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default GameReplayView;
