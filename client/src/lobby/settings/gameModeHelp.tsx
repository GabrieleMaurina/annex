import { GAME_MODES, type GameMode } from '../../lib/types';
import { titleCase } from './gameSettings';

export const GAME_MODE_DESCRIPTIONS: Record<GameMode, string> = {
  supremacy: 'Own every territory on the map.',
  capitals:
    'Everyone places a capital at the start. Win by owning every territory, or by owning every capital from round 4 onward.',
  'team deathmatch':
    'Players are split into teams. Your team wins by owning every territory.',
  zombies:
    'A zombie horde takes the first slot, plays last each round and fights everyone. Eliminate every other player, then capture every zombie territory. With any placement other than Random the zombies appear after the first round.',
  continent:
    'The server picks one continent (at least 7 territories if the map has one, otherwise its largest) for everyone to fight over. Win by owning every territory of that continent (ignoring any currently toxined or radiated) from round 4 onward.',
  'king of the hill':
    'A few random territories are hills. At the start of each of your turns (from round 2 on), you score 1 point per hill you hold. First to Max Points wins.',
  empire:
    'At the start of each of your turns (from round 2 on), you score 1 point per territory you hold plus the bonus of every continent you hold (only with Continents on). First to Max Points wins.',
  'supremacy 3/4': "Control at least 3/4 of the map's territories.",
  'supremacy 2/3': "Control at least 2/3 of the map's territories.",
  '5-round':
    'The game ends after 5 full rounds. Whoever holds the most territories then wins.',
  '10-round':
    'The game ends after 10 full rounds. Whoever holds the most territories then wins.',
  assassin:
    'Everyone is secretly assigned another player to eliminate. Kill your target to win. If someone else eliminates them first, win instead by controlling 3/4 of the map.',
  mission:
    'Everyone secretly draws one hidden mission at the start. Complete your mission to win.',
  'player kills':
    'Play until only one player is left standing. Whoever eliminated the most opponents wins, even if it was not them.',
  'troop kills':
    'Play until only one player is left standing. Whoever destroyed the most enemy troops wins, even if it was not them.',
};

export const GAME_MODE_HELP = (
  <>
    How the game is won. In every mode except Player Kills and Troop Kills, if
    everyone else surrenders or is eliminated, the last player (or team)
    standing wins immediately, regardless of the mode.
    <ul className="mb-0 ps-3">
      {GAME_MODES.map((mode) => (
        <li key={mode}>
          {titleCase(mode)}: {GAME_MODE_DESCRIPTIONS[mode]}
        </li>
      ))}
    </ul>
  </>
);
