import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { formatError } from '../../common/formatError';
import WhiteIcon from '../../common/icons/WhiteIcon';
import TipSpan from '../../common/tooltips/TipSpan';
import { connector } from '../../connector';
import { isLoggedIn } from '../../lib/player';
import type { GameState } from '../../lib/types';
import MapLikeButton from '../../lobby/MapLikeButton';

interface Props {
  game: GameState;
  storedGameId: string | null | undefined;
  mapSavable?: boolean;
}

function SaveMapButton({ gameId }: { gameId: string }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');

  function save() {
    setStatus('saving');
    setError('');
    connector.saveReplayMap(gameId, (res) => {
      setStatus(res.ok ? 'saved' : 'idle');
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="d-flex flex-column align-items-center">
      <TipSpan text="Save this map to your library">
        <Button
          variant="primary"
          className="d-inline-flex align-items-center gap-1"
          disabled={status !== 'idle'}
          onClick={save}
        >
          <WhiteIcon path="/icons/save.svg" />
          {status === 'saved'
            ? 'Map saved'
            : status === 'saving'
              ? 'Saving…'
              : 'Save map'}
        </Button>
      </TipSpan>
      {error && (
        <div className="text-danger small mt-1">{formatError(error)}</div>
      )}
    </div>
  );
}

function MapAction({ game, storedGameId, mapSavable = true }: Props) {
  if (!isLoggedIn()) return null;
  if (game.playerMapId && !game.mapGeneration)
    return <MapLikeButton mapId={game.playerMapId} />;
  return storedGameId && mapSavable ? (
    <SaveMapButton key={storedGameId} gameId={storedGameId} />
  ) : null;
}

export default MapAction;
