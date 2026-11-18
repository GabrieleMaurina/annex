import { MAX_BLITZ_OFF_TROOPS } from 'engine';
import type { CSSProperties, MouseEvent } from 'react';
import Help from '../../common/tooltips/Help';
import type { GameState, PlayerOdds } from '../../lib/types';
import Selector from '../../ui/forms/Selector';
import { scaled } from '../../ui/uiScale';
import SettingOdometer from '../settings/SettingOdometer';
import {
  INITIAL_TROOPS_ODDS_HELP,
  MIN_TROOPS_ODDS_HELP,
  TERRITORIES_ODDS_HELP,
} from '../settings/settingsHelp';

type Player = GameState['players'][number];

const TERRITORY_ODDS = [25, 50, 75, 100, 125, 150, 200, 300, 400];
const CHANGED_CLASS = 'border-primary';

interface Props {
  game: GameState;
  player: Player | null;
  isHost: boolean;
  style?: CSSProperties;
  setPlayerOdds: (playerId: number, odds: PlayerOdds) => void;
}

function stopRowClick(e: MouseEvent) {
  e.stopPropagation();
}

export function OddsHeaders() {
  return (
    <>
      <th className="text-nowrap">
        <Help tip={TERRITORIES_ODDS_HELP}>Territories</Help>
      </th>
      <th className="text-nowrap">
        <Help tip={INITIAL_TROOPS_ODDS_HELP}>Initial Troops</Help>
      </th>
      <th className="text-nowrap">
        <Help tip={MIN_TROOPS_ODDS_HELP}>Min Troops</Help>
      </th>
    </>
  );
}

export function OddsCells({
  game,
  player,
  isHost,
  style,
  setPlayerOdds,
}: Props) {
  if (!player)
    return (
      <>
        <td style={style} />
        <td style={style} />
        <td style={style} />
      </>
    );

  const { id, odds } = player;
  const troops = odds.troops ?? game.initialTroops;
  const minTroops = odds.minTroops ?? game.minTroops;
  const maxTroops = game.blitz === 'off' ? MAX_BLITZ_OFF_TROOPS : 100;
  const territoryOptions = [...new Set([...TERRITORY_ODDS, odds.territories])]
    .sort((a, b) => a - b)
    .map(String);

  function update(change: Partial<PlayerOdds>) {
    setPlayerOdds(id, { ...odds, ...change });
  }

  return (
    <>
      <td className="align-middle text-nowrap" style={style}>
        {isHost ? (
          <span className="d-inline-block" onClick={stopRowClick}>
            <Selector
              size="sm"
              className={`w-auto ${odds.territories !== 100 ? CHANGED_CLASS : ''}`}
              value={String(odds.territories)}
              onChange={(value) => update({ territories: Number(value) })}
            >
              {territoryOptions.map((value) => (
                <option key={value} value={value}>
                  {value}%
                </option>
              ))}
            </Selector>
          </span>
        ) : (
          `${odds.territories}%`
        )}
      </td>
      <td className="align-middle text-nowrap" style={style}>
        {isHost ? (
          <span
            className="d-inline-block"
            style={{ width: scaled(80) }}
            onClick={stopRowClick}
          >
            <SettingOdometer
              className={odds.troops !== null ? CHANGED_CLASS : undefined}
              value={troops}
              min={1}
              max={maxTroops}
              onChange={(next) =>
                update({ troops: next === game.initialTroops ? null : next })
              }
            />
          </span>
        ) : (
          troops
        )}
      </td>
      <td className="align-middle text-nowrap" style={style}>
        {isHost ? (
          <span
            className="d-inline-block"
            style={{ width: scaled(80) }}
            onClick={stopRowClick}
          >
            <SettingOdometer
              className={odds.minTroops !== null ? CHANGED_CLASS : undefined}
              value={minTroops}
              min={0}
              max={maxTroops}
              onChange={(next) =>
                update({
                  minTroops: next === game.minTroops ? null : next,
                })
              }
            />
          </span>
        ) : (
          minTroops
        )}
      </td>
    </>
  );
}
