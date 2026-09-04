import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import type { ResultRow } from '../common/ResultsTable';
import { contrastTextColor, playerColor } from '../lib/palette';
import type { GameState } from '../lib/types';
import GameEndResults from './GameEndResults';
import GameMap from './GameMap';
import { gameMapDataProps, noopGameMapHandlers } from './gameMapProps';
import type { ReplayChatMessage, ReplayData, ReplayEmoji } from './replay';
import type { LogEntry } from './useGameLogs';

interface Props {
  game: GameState;
  results: Map<number, ResultRow> | null;
  selfId: number | null;
  mapNames: string[];
  mapRenderName: string;
  replayData?: ReplayData | null;
  logs: LogEntry[];
  navigate: (path: string) => void;
  showYouLabel?: boolean;
  rowClickable?: (player: GameState['players'][number]) => boolean;
  rowRef?: (playerId: number) => (el: HTMLTableRowElement | null) => void;
  nameRef?: (playerId: number) => (el: HTMLDivElement | null) => void;
  onRowClick?: (playerId: number) => void;
  belowTable?: ReactNode;
  overlay?: ReactNode;
  chatLog?: ReplayChatMessage[];
  emojiLog?: ReplayEmoji[];
  setChatOpen?: Dispatch<SetStateAction<boolean>>;
  settingsMenuOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
  onViewChange?: (view: 'results' | 'replay') => void;
}

function GameReplayView({
  game,
  results,
  selfId,
  mapNames,
  mapRenderName,
  replayData,
  logs,
  navigate,
  showYouLabel,
  rowClickable,
  rowRef,
  nameRef,
  onRowClick,
  belowTable,
  overlay,
  chatLog,
  emojiLog,
  setChatOpen,
  settingsMenuOpen,
  onPanelOpenChange,
  onViewChange,
}: Props) {
  const [view, setView] = useState<'results' | 'replay'>('results');
  const [replayIndex, setReplayIndex] = useState(0);

  useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);

  if (view === 'results') {
    return (
      <GameEndResults
        game={game}
        results={results}
        selfId={selfId}
        mapNames={mapNames}
        onWatchReplay={() => setView('replay')}
        showYouLabel={showYouLabel}
        rowClickable={rowClickable}
        rowRef={rowRef}
        nameRef={nameRef}
        onRowClick={onRowClick}
        belowTable={belowTable}
        overlay={overlay}
      />
    );
  }

  const nameById = new Map(game.players.map((p) => [p.id, p.name]));
  const colorById = new Map(game.players.map((p) => [p.id, p.color]));
  const shownChat = (chatLog ?? []).filter((m) => m.afterFrame <= replayIndex);
  const shownEmoji = (emojiLog ?? []).filter(
    (e) => e.afterFrame <= replayIndex,
  );

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
        gameEnded
        showReplay
        replayData={replayData}
        onReplayIndexChange={setReplayIndex}
        logs={logs}
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
          className="position-fixed top-0 start-0 m-3 p-2 rounded small"
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
