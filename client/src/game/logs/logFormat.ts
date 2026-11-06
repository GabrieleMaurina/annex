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
  bold?: boolean;
  label?: boolean;
}

interface LogPart {
  color: string;
  text: string;
  colorRanges?: LogColorRange[];
}

type LogHighlight = Omit<LogColorRange, 'start' | 'end'>;

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
  const line = (label?: string) => {
    text += '\n';
    if (label !== undefined) {
      append(`${label}:`, { label: true });
      text += ' ';
    }
  };
  return { append, line, finish: () => ({ text, colorRanges }) };
}

type TextBuilder = ReturnType<typeof buildText>;

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

const minus = (a: number | undefined, b: number | undefined) =>
  a === undefined || b === undefined ? undefined : a - b;

const TURN_SOURCES = [
  ['troopsFromTerritories', 'Territories'],
  ['troopsFromBonuses', 'Bonuses'],
  ['troopsFromCapitals', 'Capitals'],
  ['troopsFromRoundTroops', 'Round troops'],
  ['troopsFromBounties', 'Bounties'],
  ['troopsFromTurnOrder', 'Turn order'],
] as const;

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
    const badgeFor = (id: number | undefined): LogHighlight | undefined =>
      id === undefined ? undefined : { color: colorFor(id), badge: true };

    const parts: LogPart[] = [];
    const push = (color: string, text: string, colorRanges?: LogColorRange[]) =>
      parts.push({ color, text, colorRanges });
    const p = entry.payload as Record<string, unknown>;
    const n = (key: string) => p[key] as number;
    const optional = (key: string) => p[key] as number | undefined;
    const moved = (added: string, removed: string) =>
      (p[added] ?? p[removed]) as number;

    const log = (color: string, write: (b: TextBuilder) => void) => {
      const b = buildText();
      write(b);
      const { text, colorRanges } = b.finish();
      push(color, text, colorRanges);
    };
    const actor = (b: TextBuilder, id: number | undefined) =>
      b.append(nameFor(id), { bold: true, isBot: isBotFor(id) });
    const opponent = (b: TextBuilder, id: number) =>
      b.append(nameFor(id), { ...badgeFor(id), isBot: isBotFor(id) });
    const opponents = (b: TextBuilder, ids: number[]) =>
      ids.forEach((id, index) => {
        if (index > 0) b.append(', ');
        opponent(b, id);
      });
    const place = (
      b: TextBuilder,
      id: number,
      prefix: string,
      highlight?: LogHighlight,
    ) => {
      const name = placeNames.territories.get(id);
      if (name) {
        b.append(name, { ...highlight, bold: true });
      } else {
        b.append(prefix);
        b.append(`#${id + 1}`, { ...highlight, bold: true });
      }
    };
    const route = (
      b: TextBuilder,
      fromId: number,
      toId: number,
      toHighlight?: LogHighlight,
    ) => {
      b.line('Route');
      place(b, fromId, '');
      b.append(' → ');
      place(b, toId, '', toHighlight);
    };
    const versus = (
      b: TextBuilder,
      label: string,
      attack: number | undefined,
      defence: number | undefined,
      defenceHighlight?: LogHighlight,
    ) => {
      if (attack === undefined && defence === undefined) return;
      b.line(label);
      b.append(String(attack ?? '?'));
      b.append(' vs ');
      b.append(String(defence ?? '?'), defenceHighlight);
    };

    const logRound = (round: number) => {
      if (lastLoggedRound !== null && round <= lastLoggedRound) return;
      lastLoggedRound = round;
      push(NEUTRAL_LOG_COLOR, `Started round ${round + 1}`);
    };
    const deploy = (playerId: number, territoryId: number, troops: number) =>
      log(colorFor(playerId), (b) => {
        actor(b, playerId);
        b.append(` deployed ${plural(troops, 'troop')} to `);
        place(b, territoryId, 'territory ');
      });

    switch (entry.type) {
      case 'game:deployed':
        deploy(n('playerId'), n('territoryId'), n('troops'));
        break;
      case 'game:deployedMany': {
        const deposits = p.deposits as {
          territoryId: number;
          troops: number;
        }[];
        if (deposits.length === 1) {
          deploy(n('playerId'), deposits[0].territoryId, deposits[0].troops);
          break;
        }
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          b.append(
            ` deployed ${plural(
              deposits.reduce((sum, d) => sum + d.troops, 0),
              'troop',
            )}`,
          );
          for (const deposit of deposits) {
            b.line();
            place(b, deposit.territoryId, 'Territory ');
            b.append(`: ${deposit.troops}`);
          }
        });
        break;
      }
      case 'game:fortified':
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          b.append(
            ` fortified ${plural(moved('troopsAdded', 'troopsRemoved'), 'troop')}`,
          );
          route(b, n('fromTerritoryId'), n('territoryId'));
        });
        break;
      case 'game:attackMoved':
        log(colorFor(lastConquestAttackerId), (b) => {
          actor(b, lastConquestAttackerId);
          b.append(
            ` moved ${plural(moved('troopsAdded', 'troopsRemoved'), 'troop')} into `,
          );
          place(b, n('territoryId'), 'territory ');
          if (p.troopsRefunded !== undefined) {
            b.line('Refund');
            b.append(plural(n('troopsRefunded'), 'troop'));
          }
        });
        break;
      case 'game:entrenched':
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          b.append(' entrenched ');
          place(b, n('territoryId'), 'territory ');
          b.line('Troops');
          b.append(String(n('troops')));
          b.line('Duration');
          b.append(plural(n('turnsRemaining'), 'turn'));
        });
        break;
      case 'game:toxined':
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          b.append(' released toxin on ');
          place(b, n('territoryId'), 'territory ');
          b.line('Duration');
          b.append(
            p.permanent ? 'permanent' : plural(n('roundsRemaining'), 'round'),
          );
        });
        break;
      case 'game:unlocked':
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          b.append(` unlocked tile #${n('tileId') + 1}`);
          b.line('From');
          place(b, n('fromTerritoryId'), '');
          b.line('Cost');
          b.append(plural(n('cost'), 'troop'));
        });
        break;
      case 'game:switchFlipped':
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          b.append(` flipped switch #${n('switchId') + 1}`);
          b.line('From');
          place(b, n('fromTerritoryId'), '');
          b.line('Cost');
          b.append(plural(n('cost'), 'troop'));
        });
        break;
      case 'game:nukeLaunched': {
        const launcherId = n('playerId');
        const eliminatedIds = (p.eliminatedPlayerIds as number[]) ?? [];
        log(colorFor(launcherId), (b) => {
          actor(b, launcherId);
          if (p.intercepted) {
            b.append("'s nuke was intercepted");
            b.line('Target');
            place(b, n('targetTerritoryId'), '');
          } else {
            b.append(' nuked ');
            place(b, n('targetTerritoryId'), 'territory ');
          }
          if (eliminatedIds.length > 0) {
            b.line('Eliminated');
            opponents(b, eliminatedIds);
          }
        });
        break;
      }
      case 'game:radiationChanged': {
        const newly = p.newlyRadiatedIds as number[];
        if (newly.length > 0)
          log(NEUTRAL_LOG_COLOR, (b) => {
            if (newly.length === 1) {
              b.append('Radiation spread to ');
              place(b, newly[0], 'territory ');
              return;
            }
            b.append(`Radiation spread to ${newly.length} territories`);
            for (const id of newly) {
              b.line();
              place(b, id, 'Territory ');
            }
          });
        for (const id of p.eliminatedPlayerIds as number[])
          log(colorFor(id), (b) => {
            actor(b, id);
            b.append(' was eliminated by radiation');
          });
        break;
      }
      case 'game:attacked': {
        const attackerId = n('attackerId');
        const defenderId = p.defenderId as number | undefined;
        if (p.conquered) lastConquestAttackerId = attackerId;
        const defenderHighlight = badgeFor(defenderId);
        log(colorFor(attackerId), (b) => {
          actor(b, attackerId);
          b.append(' attacked ');
          if (defenderId !== undefined) opponent(b, defenderId);
          else
            b.append(
              p.conquered === undefined
                ? 'an unknown player'
                : 'an unowned territory',
            );
          route(
            b,
            n('attackingTerritoryId'),
            n('defendingTerritoryId'),
            defenderHighlight,
          );
          versus(
            b,
            'Troops',
            optional('attackingTroops'),
            optional('defendingTroops'),
            defenderHighlight,
          );
          versus(
            b,
            'Losses',
            optional('attackLosses'),
            optional('defenceLosses'),
            defenderHighlight,
          );
          versus(
            b,
            'Remaining',
            minus(optional('attackingTroops'), optional('attackLosses')),
            minus(optional('defendingTroops'), optional('defenceLosses')),
            defenderHighlight,
          );
          if (p.conquered) {
            b.line('Result');
            b.append('Conquered', { bold: true });
          }
          if (p.eliminated && defenderId !== undefined) {
            b.line('Eliminated');
            opponent(b, defenderId);
          }
          if (n('cardsTaken') > 0 && defenderId !== undefined) {
            b.line('Cards');
            b.append(`took ${plural(n('cardsTaken'), 'card')} from `);
            opponent(b, defenderId);
          }
          if (p.troopsRefunded !== undefined) {
            b.line('Refund');
            b.append(plural(n('troopsRefunded'), 'troop'));
          }
        });
        break;
      }
      case 'game:shipsBought':
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          if (p.fromPool) {
            b.append(` deployed ${plural(n('ships'), 'ship')} to `);
            place(b, n('seaTerritoryId'), 'sea ');
          } else {
            b.append(` built ${plural(n('ships'), 'ship')}`);
            route(b, n('sourceTerritoryId'), n('seaTerritoryId'));
          }
        });
        break;
      case 'game:sailed':
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          b.append(
            ` sailed ${plural(moved('shipsAdded', 'shipsRemoved'), 'ship')}`,
          );
          route(b, n('fromSeaTerritoryId'), n('seaTerritoryId'));
        });
        break;
      case 'game:seaAttacked': {
        const attackerId = n('attackerId');
        const defenderId = n('defenderId');
        const defenderHighlight = badgeFor(defenderId);
        log(colorFor(attackerId), (b) => {
          actor(b, attackerId);
          b.append(' attacked ');
          opponent(b, defenderId);
          b.append("'s ships");
          b.line('Sea');
          place(b, n('seaTerritoryId'), '', defenderHighlight);
          versus(
            b,
            'Ships',
            n('attackingShips'),
            n('defendingShips'),
            defenderHighlight,
          );
          versus(
            b,
            'Losses',
            n('attackLosses'),
            n('defenceLosses'),
            defenderHighlight,
          );
          versus(
            b,
            'Remaining',
            n('attackingShips') - n('attackLosses'),
            n('defendingShips') - n('defenceLosses'),
            defenderHighlight,
          );
        });
        break;
      }
      case 'game:surrendered':
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          b.append(' surrendered');
        });
        break;
      case 'game:pointsScored':
        logRound(n('roundNumber'));
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          b.append(` scored ${plural(n('points'), 'point')}`);
          b.line('Total');
          b.append(String(n('total')));
        });
        break;
      case 'game:gameOver': {
        const winnerIds = p.winnerIds as number[];
        log(NEUTRAL_LOG_COLOR, (b) => {
          b.append('Game over');
          if (p.drawReason) {
            b.line('Result');
            b.append(
              p.drawReason === 'agreed'
                ? 'Draw agreed'
                : `Stalemate (${p.drawReason})`,
            );
          }
          if (winnerIds.length > 0) {
            b.line(winnerIds.length === 1 ? 'Winner' : 'Winners');
            opponents(b, winnerIds);
          }
        });
        break;
      }
      case 'game:cardSetPlayed':
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          b.append(
            ` received ${plural(n('troops') - n('territoryBonusCount') * 2, 'troop')} from a set`,
          );
        });
        break;
      case 'game:turnStarted': {
        logRound(n('roundNumber'));
        const sources = TURN_SOURCES.filter(([key]) => n(key) > 0);
        const withheld = n('troopsWithheld') > 0;
        if (sources.length === 0 && !withheld) break;
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          b.append(
            ` received ${plural(
              sources.reduce((sum, [key]) => sum + n(key), 0),
              'troop',
            )}`,
          );
          for (const [key, label] of sources) {
            b.line(label);
            b.append(String(n(key)));
          }
          if (withheld) {
            b.line('Withheld');
            b.append(`${n('troopsWithheld')} (territory troop limit)`);
          }
        });
        break;
      }
      case 'game:capitalPlacementStarted':
        push(NEUTRAL_LOG_COLOR, 'Started capital placement');
        break;
      case 'game:territoryClaimed':
        log(colorFor(n('playerId')), (b) => {
          actor(b, n('playerId'));
          b.append(' claimed ');
          place(b, n('territoryId'), 'territory ');
          b.append(` with ${plural(n('troops') ?? 1, 'troop')}`);
        });
        break;
      case 'game:allianceFormed':
      case 'game:allianceTerminated': {
        const actorId = p.playerId as number | undefined;
        const withId = n('withId');
        const formed = entry.type === 'game:allianceFormed';
        log(colorFor(actorId ?? withId), (b) => {
          if (actorId === undefined) {
            b.append(
              formed
                ? 'Formed an alliance with '
                : 'Terminated the alliance with ',
            );
          } else {
            actor(b, actorId);
            b.append(
              formed
                ? ' formed an alliance with '
                : ' terminated the alliance with ',
            );
          }
          actor(b, withId);
        });
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
