import { playerColor } from '../../lib/palette';
import type { PlaceNames } from '../mapData';
import type { LogEntry } from './useGameLogs';

const NEUTRAL_LOG_COLOR = '#6c757d';

export interface FormatPlayer {
  id: number;
  name: string;
  color: number;
  isBot: boolean;
}

export interface LogColorRange {
  start: number;
  end: number;
  color?: string;
  badge?: boolean;
  isBot?: boolean;
}

interface LogPart {
  color: string;
  text: string;
  colorRanges?: LogColorRange[];
}

type LogHighlight = { color?: string; badge?: boolean; isBot?: boolean };

function buildText() {
  let text = '';
  const colorRanges: LogColorRange[] = [];
  const append = (piece: string, highlight?: LogHighlight) => {
    if (highlight)
      colorRanges.push({
        start: text.length,
        end: text.length + piece.length,
        ...highlight,
      });
    text += piece;
  };
  return { append, finish: () => ({ text, colorRanges }) };
}

export function createLogFormatter() {
  let lastConquestAttackerId: number | undefined;
  let lastLoggedRound: number | null = null;

  return function format(
    entry: { type: string; payload: unknown },
    players: FormatPlayer[],
    placeNames: PlaceNames,
  ): LogPart[] {
    const playerById = new Map(players.map((p) => [p.id, p]));
    const colorFor = (id: number | undefined) => {
      const player = id === undefined ? undefined : playerById.get(id);
      return player ? playerColor(player.color) : '#ffffff';
    };
    const nameFor = (id: number | undefined) =>
      (id === undefined ? undefined : playerById.get(id)?.name) ?? 'a player';
    const isBotFor = (id: number | undefined) =>
      (id === undefined ? undefined : playerById.get(id)?.isBot) ?? false;
    const botHighlight = (id: number | undefined): LogHighlight | undefined =>
      isBotFor(id) ? { isBot: true } : undefined;
    const place = (id: number, prefix: string) =>
      placeNames.territories.get(id) ?? `${prefix}#${id + 1}`;
    const appendPlace = (
      b: ReturnType<typeof buildText>,
      id: number,
      prefix: string,
      highlight?: LogHighlight,
    ) => {
      const name = placeNames.territories.get(id);
      if (name) {
        b.append(name, highlight);
      } else {
        b.append(prefix);
        b.append(`#${id + 1}`, highlight);
      }
    };

    const parts: LogPart[] = [];
    const push = (color: string, text: string, colorRanges?: LogColorRange[]) =>
      parts.push({ color, text, colorRanges });
    const p = entry.payload as Record<string, unknown>;
    const n = (key: string) => p[key] as number;
    const moved = (added: string, removed: string) =>
      (p[added] ?? p[removed]) as number;
    const logRound = (round: number) => {
      if (lastLoggedRound !== null && round <= lastLoggedRound) return;
      lastLoggedRound = round;
      push(NEUTRAL_LOG_COLOR, `Started round ${round + 1}`);
    };
    const deploy = (playerId: number, territoryId: number, troops: number) =>
      push(
        colorFor(playerId),
        `${nameFor(playerId)} deployed ${troops} troops to ${place(territoryId, 'territory ')}`,
      );

    switch (entry.type) {
      case 'game:deployed':
        deploy(n('playerId'), n('territoryId'), n('troops'));
        break;
      case 'game:deployedMany':
        for (const deposit of p.deposits as {
          territoryId: number;
          troops: number;
        }[])
          deploy(n('playerId'), deposit.territoryId, deposit.troops);
        break;
      case 'game:fortified':
        push(
          colorFor(n('playerId')),
          `${nameFor(n('playerId'))} fortified ${moved('troopsAdded', 'troopsRemoved')} troops from ${place(n('fromTerritoryId'), 'territory ')} to ${place(n('territoryId'), 'territory ')}`,
        );
        break;
      case 'game:attackMoved':
        push(
          colorFor(lastConquestAttackerId),
          `${nameFor(lastConquestAttackerId)} moved ${moved('troopsAdded', 'troopsRemoved')} troops into conquered ${place(n('territoryId'), 'territory ')}`,
        );
        if (p.troopsRefunded !== undefined)
          push(
            colorFor(lastConquestAttackerId),
            `${nameFor(lastConquestAttackerId)} got ${n('troopsRefunded')} troops back from ${place(n('territoryId'), 'capital ')}`,
          );
        break;
      case 'game:entrenched':
        push(
          colorFor(n('playerId')),
          `${nameFor(n('playerId'))} entrenched ${place(n('territoryId'), 'territory ')} with ${n('troops')} troops (now ${n('turnsRemaining')} turns)`,
        );
        break;
      case 'game:toxined':
        push(
          colorFor(n('playerId')),
          p.permanent
            ? `${nameFor(n('playerId'))} released toxin on ${place(n('territoryId'), 'territory ')} permanently`
            : `${nameFor(n('playerId'))} released toxin on ${place(n('territoryId'), 'territory ')} for ${n('roundsRemaining')} rounds`,
        );
        break;
      case 'game:unlocked':
        push(
          colorFor(n('playerId')),
          `${nameFor(n('playerId'))} unlocked tile #${n('tileId') + 1} from ${place(n('fromTerritoryId'), 'territory ')} for ${n('cost')} troops`,
        );
        break;
      case 'game:nukeLaunched': {
        const launcherId = n('playerId');
        if (p.intercepted)
          push(
            colorFor(launcherId),
            `${nameFor(launcherId)}'s nuke aimed at ${place(n('targetTerritoryId'), 'territory ')} was intercepted`,
          );
        else
          push(
            colorFor(launcherId),
            `${nameFor(launcherId)} nuked ${place(n('targetTerritoryId'), 'territory ')}`,
          );
        for (const id of (p.eliminatedPlayerIds as number[]) ?? [])
          push(colorFor(id), `${nameFor(id)} was eliminated by a nuke`);
        break;
      }
      case 'game:radiationChanged': {
        const newly = p.newlyRadiatedIds as number[];
        if (newly.length > 0)
          push(
            NEUTRAL_LOG_COLOR,
            `Radiation spread to territor${newly.length === 1 ? 'y' : 'ies'} ${newly.map((id) => place(id, '')).join(', ')}`,
          );
        for (const id of p.eliminatedPlayerIds as number[])
          push(colorFor(id), `${nameFor(id)} was eliminated by radiation`);
        break;
      }
      case 'game:attacked': {
        if (p.conquered) lastConquestAttackerId = n('attackerId');
        const attackerId = n('attackerId');
        const defenderId = p.defenderId as number | undefined;
        const defenderColor = colorFor(defenderId);
        const defenderHighlight =
          defenderId !== undefined
            ? { color: defenderColor, badge: true }
            : undefined;

        const b = buildText();
        b.append(nameFor(attackerId), botHighlight(attackerId));
        b.append(p.conquered ? ' conquered' : ' attacked');
        if (defenderId !== undefined) {
          b.append(' ');
          b.append(nameFor(defenderId), {
            ...defenderHighlight!,
            isBot: isBotFor(defenderId),
          });
          b.append("'s");
        }
        b.append(' ');
        appendPlace(
          b,
          n('defendingTerritoryId'),
          'territory ',
          defenderHighlight,
        );
        b.append(` from ${place(n('attackingTerritoryId'), '')}`);
        if (
          p.attackingTroops !== undefined &&
          p.defendingTroops !== undefined
        ) {
          b.append(`: ${n('attackingTroops')} vs `);
          b.append(String(n('defendingTroops')), defenderHighlight);
          b.append(' troops');
        }
        if (p.attackLosses !== undefined)
          b.append(`, lost ${n('attackLosses')}`);
        if (p.defenceLosses !== undefined) {
          b.append(' and killed ');
          b.append(String(n('defenceLosses')), defenderHighlight);
        }

        const { text, colorRanges } = b.finish();
        push(colorFor(attackerId), text, colorRanges);

        if (p.eliminated && defenderId !== undefined) {
          const kill = buildText();
          kill.append(nameFor(attackerId), botHighlight(attackerId));
          kill.append(' eliminated ');
          kill.append(nameFor(defenderId), {
            ...defenderHighlight!,
            isBot: isBotFor(defenderId),
          });
          const killed = kill.finish();
          push(colorFor(attackerId), killed.text, killed.colorRanges);
        }
        if (n('cardsTaken') > 0 && defenderId !== undefined) {
          const cards = buildText();
          cards.append(nameFor(attackerId), botHighlight(attackerId));
          cards.append(
            ` took ${n('cardsTaken')} card${n('cardsTaken') === 1 ? '' : 's'} from `,
          );
          cards.append(nameFor(defenderId), {
            ...defenderHighlight!,
            isBot: isBotFor(defenderId),
          });
          const taken = cards.finish();
          push(colorFor(attackerId), taken.text, taken.colorRanges);
        }
        if (p.troopsRefunded !== undefined)
          push(
            colorFor(attackerId),
            `${nameFor(attackerId)} got ${n('troopsRefunded')} troops back from ${place(n('defendingTerritoryId'), 'capital ')}`,
          );
        break;
      }
      case 'game:shipsBought':
        push(
          colorFor(n('playerId')),
          p.fromPool
            ? `${nameFor(n('playerId'))} deployed ${n('ships')} ships to ${place(n('seaTerritoryId'), 'sea territory ')}`
            : `${nameFor(n('playerId'))} built ${n('ships')} ships from ${place(n('sourceTerritoryId'), 'territory ')} to ${place(n('seaTerritoryId'), 'sea territory ')}`,
        );
        break;
      case 'game:sailed':
        push(
          colorFor(n('playerId')),
          `${nameFor(n('playerId'))} sailed ${moved('shipsAdded', 'shipsRemoved')} ships from ${place(n('fromSeaTerritoryId'), 'sea territory ')} to ${place(n('seaTerritoryId'), 'sea territory ')}`,
        );
        break;
      case 'game:seaAttacked': {
        const attackerId = n('attackerId');
        const defenderId = n('defenderId');
        const defenderHighlight = { color: colorFor(defenderId), badge: true };

        const b = buildText();
        b.append(nameFor(attackerId), botHighlight(attackerId));
        b.append(' attacked ');
        b.append(nameFor(defenderId), {
          ...defenderHighlight,
          isBot: isBotFor(defenderId),
        });
        b.append("'s ships in ");
        appendPlace(
          b,
          n('seaTerritoryId'),
          'sea territory ',
          defenderHighlight,
        );
        b.append(`: ${n('attackingShips')} vs `);
        b.append(String(n('defendingShips')), defenderHighlight);
        b.append(` ships, lost ${n('attackLosses')} and killed `);
        b.append(String(n('defenceLosses')), defenderHighlight);

        const { text, colorRanges } = b.finish();
        push(colorFor(attackerId), text, colorRanges);
        break;
      }
      case 'game:surrendered':
        push(colorFor(n('playerId')), `${nameFor(n('playerId'))} surrendered`);
        break;
      case 'game:pointsScored':
        logRound(n('roundNumber'));
        push(
          colorFor(n('playerId')),
          `${nameFor(n('playerId'))} scored ${n('points')} point${n('points') === 1 ? '' : 's'} (total ${n('total')})`,
        );
        break;
      case 'game:gameOver': {
        const winnerIds = p.winnerIds as number[];
        const b = buildText();
        b.append('Game over');
        winnerIds.forEach((id, index) => {
          b.append(
            index === 0
              ? ', won by '
              : index === winnerIds.length - 1
                ? ' and '
                : ', ',
          );
          b.append(nameFor(id), {
            color: colorFor(id),
            badge: true,
            isBot: isBotFor(id),
          });
        });
        const { text, colorRanges } = b.finish();
        push(NEUTRAL_LOG_COLOR, text, colorRanges);
        break;
      }
      case 'game:cardSetPlayed':
        push(
          colorFor(n('playerId')),
          `${nameFor(n('playerId'))} received ${n('troops') - n('territoryBonusCount') * 2} troops from a set`,
        );
        break;
      case 'game:turnStarted': {
        logRound(n('roundNumber'));
        const color = colorFor(n('playerId'));
        const name = nameFor(n('playerId'));
        const source = (key: string, label: string) => {
          if (n(key) > 0)
            push(color, `${name} received ${n(key)} troops from ${label}`);
        };
        source('troopsFromTerritories', 'territories');
        source('troopsFromBonuses', 'bonuses');
        source('troopsFromCapitals', 'capitals');
        source('troopsFromRoundTroops', 'round troops');
        source('troopsFromBounties', 'bounties');
        if (n('troopsWithheld') > 0)
          push(
            color,
            `${name} could not receive ${n('troopsWithheld')} troops (territory troop limit)`,
          );
        break;
      }
      case 'game:capitalPlacementStarted':
        push(NEUTRAL_LOG_COLOR, 'Started capital placement');
        break;
      case 'game:territoryClaimed': {
        const color = colorFor(n('playerId'));
        const name = nameFor(n('playerId'));
        push(color, `${name} claimed ${place(n('territoryId'), 'territory ')}`);
        push(
          color,
          `${name} deployed ${n('troops') ?? 1} troops to ${place(n('territoryId'), 'territory ')}`,
        );
        break;
      }
      case 'game:allianceFormed': {
        const actor = p.playerId as number | undefined;
        const withId = n('withId');
        const b = buildText();
        if (actor === undefined) {
          b.append('Formed an alliance with ');
        } else {
          b.append(nameFor(actor), botHighlight(actor));
          b.append(' formed an alliance with ');
        }
        b.append(nameFor(withId), botHighlight(withId));
        const { text, colorRanges } = b.finish();
        push(colorFor(actor ?? withId), text, colorRanges);
        break;
      }
      case 'game:allianceTerminated': {
        const actor = p.playerId as number | undefined;
        const withId = n('withId');
        const b = buildText();
        if (actor === undefined) {
          b.append('Terminated the alliance with ');
        } else {
          b.append(nameFor(actor), botHighlight(actor));
          b.append(' terminated the alliance with ');
        }
        b.append(nameFor(withId), botHighlight(withId));
        const { text, colorRanges } = b.finish();
        push(colorFor(actor ?? withId), text, colorRanges);
        break;
      }
    }
    return parts;
  };
}

export function formatLogEntriesWithFrames(
  entries: { type: string; payload: unknown; afterFrame: number }[],
  players: FormatPlayer[],
  placeNames: PlaceNames,
): (LogEntry & { afterFrame: number })[] {
  const format = createLogFormatter();
  const logs: (LogEntry & { afterFrame: number })[] = [];
  for (const entry of entries)
    for (const part of format(entry, players, placeNames))
      logs.push({ id: logs.length + 1, afterFrame: entry.afterFrame, ...part });
  return logs;
}
