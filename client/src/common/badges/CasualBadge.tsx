import { Badge } from 'react-bootstrap';
import type { GameType } from '../../lib/types';
import Tip from '../tooltips/Tip';

interface Props {
  gameType: GameType | undefined;
  className?: string;
}

function CasualBadge({ gameType, className }: Props) {
  if (gameType !== 'casual') return null;
  return (
    <Tip text="Casual game: ratings do not change">
      <Badge bg="info" text="dark" className={className}>
        Casual
      </Badge>
    </Tip>
  );
}

export default CasualBadge;
