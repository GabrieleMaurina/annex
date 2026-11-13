import type { Progress } from '../playerStats';

interface Props {
  progress: Progress;
  thin?: boolean;
}

function PlayerProgress({ progress, thin = false }: Props) {
  if (progress === null) return null;
  const hidden = progress === 'hidden';
  return (
    <div
      className={`player-progress overflow-hidden ${thin ? 'player-progress-thin position-absolute start-0 end-0 bottom-0' : 'rounded-pill'} ${hidden ? 'player-progress-hidden' : ''}`}
    >
      {!hidden && <i style={{ width: `${progress}%` }} />}
    </div>
  );
}

export default PlayerProgress;
