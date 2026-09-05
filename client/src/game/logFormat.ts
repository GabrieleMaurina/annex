import { playerColor } from '../lib/palette';
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

    const parts: LogPart[] = [];
    const push = (color: string, text: string, colorRanges?: LogColorRange[]) =>
      parts.push({ color, text, colorRanges });
    const p = entry.payload as Record<string, unknown>;
    const n = (key: string) => p[key] as number;
    const deploy = (playerId: number, territoryId: number, troops: number) =>
      push(
        colorFor(playerId),
        `${nameFor(playerId)} deployed ${troops} troops to territory #${territoryId + 1}`,
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
          `${nameFor(n('playerId'))} fortified ${n('troops')} troops from territory #${n('fromTerritoryId') + 1} to territory #${n('territoryId') + 1}`,
        );
        break;
      case 'game:attackMoved':
        push(
          colorFor(lastConquestAttackerId),
          `${nameFor(lastConquestAttackerId)} moved ${n('troops')} troops into conquered territory #${n('territoryId') + 1}`,
        );
        break;
      case 'game:entrenched':
        push(
          colorFor(n('playerId')),
          `${nameFor(n('playerId'))} entrenched territory #${n('territoryId') + 1} with ${n('troops')} troops (now ${n('turnsRemaining')} turns)`,
        );
        break;
      case 'game:toxined':
        push(
          colorFor(n('playerId')),
          p.permanent
            ? `${nameFor(n('playerId'))} released toxin on territory #${n('territoryId') + 1} permanently`
            : `${nameFor(n('playerId'))} released toxin on territory #${n('territoryId') + 1} for ${n('roundsRemaining')} rounds`,
        );
        break;
      case 'game:radiationChanged': {
        const newly = p.newlyRadiatedIds as number[];
        if (newly.length > 0)
          push(
            NEUTRAL_LOG_COLOR,
            `Radiation spread to territor${newly.length === 1 ? 'y' : 'ies'} ${newly.map((id) => `#${id + 1}`).join(', ')}`,
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
        b.append(' territory ');
        b.append(`#${n('defendingTerritoryId') + 1}`, defenderHighlight);
        b.append(` from #${n('attackingTerritoryId') + 1}`);
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
        break;
      }
      case 'game:cardSetPlayed':
        push(
          colorFor(n('playerId')),
          `${nameFor(n('playerId'))} received ${n('troops') - n('territoryBonusCount') * 2} troops from a set`,
        );
        break;
      case 'game:turnStarted': {
        const round = n('roundNumber');
        if (lastLoggedRound === null || round > lastLoggedRound) {
          lastLoggedRound = round;
          push(NEUTRAL_LOG_COLOR, `Started round ${round + 1}`);
        }
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
        break;
      }
      case 'game:capitalPlacementStarted':
        push(NEUTRAL_LOG_COLOR, 'Started capital placement');
        break;
      case 'game:territoryClaimed': {
        const color = colorFor(n('playerId'));
        const name = nameFor(n('playerId'));
        push(color, `${name} claimed territory #${n('territoryId') + 1}`);
        push(
          color,
          `${name} deployed 1 troops to territory #${n('territoryId') + 1}`,
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

export function formatLogEntries(
  entries: { type: string; payload: unknown }[],
  players: FormatPlayer[],
): LogEntry[] {
  const format = createLogFormatter();
  const logs: LogEntry[] = [];
  for (const entry of entries)
    for (const part of format(entry, players))
      logs.push({ id: logs.length + 1, ...part });
  return logs;
}
