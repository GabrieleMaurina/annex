import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import Tip from '../../common/tooltips/Tip';
import {
  contrastTextColor,
  playerColor,
  playerSwatch,
} from '../../lib/palette';
import type { GameState } from '../../lib/types';
import type { FoldedReplay } from './replay';

const MAX_PERCENT = 85;

function cellStyle(colorIndex: number, intensity: number): CSSProperties {
  const color = playerColor(colorIndex);
  return {
    backgroundColor: `color-mix(in srgb, ${color} ${intensity * MAX_PERCENT}%, transparent)`,
    color: intensity > 0.5 ? contrastTextColor(color) : undefined,
  };
}

interface Props {
  players: GameState['players'];
  replay: FoldedReplay;
}

function DamageMatrix({ players, replay }: Props) {
  const damage = useMemo(() => {
    const index = new Map(players.map((p, i) => [p.id, i]));
    const grid = players.map(() => players.map(() => 0));
    for (const { animation } of replay.data.frames) {
      if (animation.type !== 'attack' || animation.defenderId === undefined)
        continue;
      const attacker = index.get(animation.attackerId);
      const defender = index.get(animation.defenderId);
      if (attacker === undefined || defender === undefined) continue;
      grid[attacker][defender] += animation.defenceLosses;
      grid[defender][attacker] += animation.attackLosses;
    }
    return grid;
  }, [players, replay.data.frames]);

  const max = Math.max(...damage.flat());
  if (max <= 0) return null;

  const badge = (player: GameState['players'][number]) => (
    <span className="badge" style={playerSwatch(player.color, player.isZombie)}>
      {player.name}
    </span>
  );

  return (
    <div>
      <div className="text-center fw-bold">Troops destroyed</div>
      <div className="text-center text-body-secondary small mb-2">
        Each row destroyed the troops of each column. Stronger colors mean more.
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-bordered text-center align-middle mb-0">
          <thead>
            <tr>
              <th />
              {players.map((p) => (
                <th key={p.id}>{badge(p)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((attacker, i) => (
              <tr key={attacker.id}>
                <th>{badge(attacker)}</th>
                {players.map((defender, j) =>
                  i === j ? (
                    <td key={defender.id} className="text-body-secondary">
                      -
                    </td>
                  ) : (
                    <Tip
                      key={defender.id}
                      text={`${attacker.name} destroyed ${damage[i][j].toLocaleString()} of ${defender.name}'s troops. ${defender.name} destroyed ${damage[j][i].toLocaleString()} of theirs.`}
                    >
                      <td style={cellStyle(attacker.color, damage[i][j] / max)}>
                        {damage[i][j].toLocaleString()}
                      </td>
                    </Tip>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DamageMatrix;
