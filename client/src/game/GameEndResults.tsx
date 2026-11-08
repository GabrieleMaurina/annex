import { isPointsMode } from 'engine';
import type { ReactNode } from 'react';
import { Button, Container } from 'react-bootstrap';
import type { ResultRow } from '../common/ResultsTable';
import ResultsTable from '../common/ResultsTable';
import SharePageButton from '../common/menus/SharePageButton';
import Tip from '../common/tooltips/Tip';
import { contrastTextColor, playerColor } from '../lib/palette';
import type { GameState } from '../lib/types';
import SettingsPanel from '../lobby/settings/SettingsPanel';
import GameStatsChart from './replay/GameStatsChart';
import MapAction from './replay/MapAction';
import type { FoldedReplay } from './replay/replay';

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

interface Props {
  game: GameState;
  results: Map<number, ResultRow> | null;
  selfId: number | null;
  navigate?: (path: string) => void;
  onWatchReplay: () => void;
  onRestart?: () => void;
  showYouLabel?: boolean;
  rowClickable?: (player: GameState['players'][number]) => boolean;
  rowRef?: (playerId: number) => (el: HTMLTableRowElement | null) => void;
  nameRef?: (playerId: number) => (el: HTMLDivElement | null) => void;
  onRowClick?: (playerId: number) => void;
  belowTable?: ReactNode;
  overlay?: ReactNode;
  replay?: FoldedReplay | null;
  showMuted?: boolean;
  shareGameId?: string | null;
  mapSavable?: boolean;
}

function GameEndResults({
  game,
  results,
  selfId,
  navigate,
  onWatchReplay,
  onRestart,
  showYouLabel,
  rowClickable,
  rowRef,
  nameRef,
  onRowClick,
  belowTable,
  overlay,
  replay,
  showMuted,
  shareGameId,
  mapSavable,
}: Props) {
  const winners = game.players.filter((p) => game.winnerIds.includes(p.id));
  const draw = game.draw;
  const won = selfId !== null && game.winnerIds.includes(selfId);
  const isTeamDeathmatch = game.gameMode === 'team deathmatch';
  const isCapitals = game.gameMode === 'capitals';
  const pointsMode = isPointsMode(game.gameMode);
  const duration =
    game.startedAt !== null && game.endedAt !== null
      ? formatDuration(game.endedAt - game.startedAt)
      : null;

  return (
    <Container fluid className="pt-5 pb-5 px-2 px-sm-4 bg-body min-vh-100">
      <div className="text-center mb-4 mt-4 mt-sm-0">
        <h1 className="mb-4">
          {draw
            ? draw.reason === 'aborted'
              ? 'Aborted'
              : draw.reason === 'agreed'
                ? 'Draw'
                : 'Stalemate'
            : won
              ? 'You Win!'
              : 'Game Over'}
        </h1>
        {draw ? (
          <p className="fs-4 mb-0">
            {draw.reason === 'max rounds'
              ? `Stalemate reached after ${game.maxRounds} rounds. Nobody wins.`
              : draw.reason === 'max duration'
                ? `Stalemate reached after ${formatDuration(game.maxDuration * 60000)}. Nobody wins.`
                : draw.reason === 'capital standoff'
                  ? `Stalemate reached after ${game.capitalStandoff} rounds without a capital changing hands. Nobody wins.`
                  : draw.reason === 'aborted'
                    ? 'Every human player asked to abort the game. Nobody wins.'
                    : 'All remaining players agreed to a draw. Nobody wins.'}
          </p>
        ) : isTeamDeathmatch ? (
          <p className="fs-4 mb-0">
            Team {(winners[0]?.team ?? 0) + 1} wins:{' '}
            {winners.map((w) => w.name).join(', ')}
          </p>
        ) : (
          <p className="fs-4 mb-0">
            <span
              className="badge"
              style={{
                backgroundColor: playerColor(winners[0]?.color ?? 0),
                color: contrastTextColor(playerColor(winners[0]?.color ?? 0)),
              }}
            >
              {winners[0]?.name}
            </span>{' '}
            wins!
          </p>
        )}
        {(duration || shareGameId) && (
          <div className="d-flex justify-content-center align-items-center gap-2 mt-2">
            {duration && (
              <span className="text-body-secondary">Duration: {duration}</span>
            )}
            {shareGameId && (
              <SharePageButton
                title={game.name}
                path={`/games/replay/${shareGameId}`}
                tooltip="Share this game with friends"
                size="sm"
              />
            )}
          </div>
        )}
      </div>

      <ResultsTable
        players={game.players}
        ranking={game.finalRanking}
        drawnIds={draw?.playerIds ?? []}
        results={results}
        originalHostId={game.originalHostId}
        roundNumber={game.roundNumber}
        isCapitals={isCapitals}
        isPointsMode={pointsMode}
        selfId={selfId}
        showYouLabel={showYouLabel ?? selfId !== null}
        rowClickable={rowClickable}
        rowRef={rowRef}
        nameRef={nameRef}
        onRowClick={onRowClick}
        navigate={navigate}
        showMuted={showMuted}
      />

      {belowTable}
      {overlay}

      <div className="d-flex flex-wrap justify-content-center align-items-start gap-3 mt-3">
        <Button variant="info" onClick={onWatchReplay}>
          Watch Replay
        </Button>
        {onRestart && (
          <Tip
            text="Start a new game with the same settings, players and map"
            placement="bottom"
          >
            <Button variant="success" onClick={onRestart}>
              Restart
            </Button>
          </Tip>
        )}
        <MapAction
          game={game}
          storedGameId={shareGameId}
          mapSavable={mapSavable}
        />
      </div>

      {replay && (
        <div className="mt-4">
          <GameStatsChart
            players={game.players}
            replay={replay}
            isCapitals={isCapitals}
            isPointsMode={pointsMode}
          />
        </div>
      )}

      <div className="mt-4">
        <SettingsPanel
          game={game}
          isHost={false}
          applySettings={() => {}}
          generateMap={() => {}}
        />
      </div>
    </Container>
  );
}

export default GameEndResults;
