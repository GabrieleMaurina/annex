import { rankForElo } from '../../lib/ranks';
import Tip from '../tooltips/Tip';

function RankIcon({
  elo,
  size = 20,
}: {
  elo: number | null | undefined;
  size?: number;
}) {
  if (elo == null) return null;
  const rank = rankForElo(elo);
  return (
    <Tip text={rank.name}>
      <img
        src={`/ranks/${rank.image}.svg`}
        width={size}
        height={size}
        alt={rank.name}
        className="flex-shrink-0 align-middle"
      />
    </Tip>
  );
}

export default RankIcon;
