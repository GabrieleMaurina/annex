import type { ReactNode } from 'react';
import { Button, Container } from 'react-bootstrap';
import type { ResultRow } from '../common/ResultsTable';
import ResultsTable from '../common/ResultsTable';
import { playerColor } from '../lib/palette';
import type { GameState } from '../lib/types';
import SettingsPanel from '../lobby/SettingsPanel';

interface Props {
  game: GameState;
  results: Map<number, ResultRow> | null;
  selfId: number | null;
  mapNames: string[];
  navigate?: (path: string) => void;
  onWatchReplay: () => void;
  showYouLabel?: boolean;
  rowClickable?: (player: GameState['players'][number]) => boolean;
  rowRef?: (playerId: number) => (el: HTMLTableRowElement | null) => void;
  nameRef?: (playerId: number) => (el: HTMLDivElement | null) => void;
  onRowClick?: (playerId: number) => void;
  belowTable?: ReactNode;
  overlay?: ReactNode;
  showMuted?: boolean;
}

function GameEndResults({
  game,
  results,
  selfId,
  mapNames,
  navigate,
  onWatchReplay,
  showYouLabel,
  rowClickable,
  rowRef,
  nameRef,
  onRowClick,
  belowTable,
  overlay,
  showMuted,
}: Props) {
  const winners = game.players.filter((p) => game.winnerIds.includes(p.id));
  const won = selfId !== null && game.winnerIds.includes(selfId);
  const isTeamDeathmatch = game.gameMode === 'Team Deathmatch';

  return (
    <Container fluid className="pt-5 pb-5 px-2 px-sm-4 bg-body min-vh-100">
      <div className="text-center mb-4 mt-4 mt-sm-0">
        <h1 className="mb-4">{won ? 'You Win!' : 'Game Over'}</h1>
        {isTeamDeathmatch ? (
          <p className="fs-4 mb-0">
            Team {(winners[0]?.team ?? 0) + 1} wins:{' '}
            {winners.map((w) => w.name).join(', ')}
          </p>
        ) : (
          <p
            className="fs-4 mb-0"
            style={{ color: playerColor(winners[0]?.color ?? 0) }}
          >
            {winners[0]?.name} wins!
          </p>
        )}
      </div>

      <ResultsTable
        players={game.players}
        ranking={game.finalRanking}
        results={results}
        originalHostId={game.originalHostId}
        roundNumber={game.roundNumber}
        isCapitals={game.gameMode === 'Capitals'}
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

      <div className="d-flex justify-content-center mt-3">
        <Button variant="primary" onClick={onWatchReplay}>
          Watch Replay
        </Button>
      </div>

      <div className="mt-4">
        <SettingsPanel
          game={game}
          isHost={false}
          mapNames={mapNames}
          applySettings={() => {}}
          generateMap={() => {}}
        />
      </div>
    </Container>
  );
}

export default GameEndResults;
