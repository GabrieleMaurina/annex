import { playerColor } from '../lib/palette';
import type { LogEntry } from './useGameLogs';

const NEUTRAL_LOG_COLOR = '#6c757d';

export interface FormatPlayer {
  id: number;
  name: string;
  color: number;
}

interface LogPart {
  color: string;
  text: string;
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

    const parts: LogPart[] = [];
    const push = (color: string, text: string) => parts.push({ color, text });
    const p = entry.payload as Record<string, unknown>;
    const n = (key: string) => p[key] as number;
    const deploy = (playerId: number, territoryId: number, troops: number) =>
      push(
        colorFor(playerId),
        `Deployed ${troops} troops to territory #${territoryId + 1}`,
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
          `Fortified ${n('troops')} troops from territory #${n('fromTerritoryId') + 1} to territory #${n('territoryId') + 1}`,
        );
        break;
      case 'game:attackMoved':
        push(
          colorFor(lastConquestAttackerId),
          `Moved ${n('troops')} troops into conquered territory #${n('territoryId') + 1}`,
        );
        break;
      case 'game:entrenched':
        push(
          colorFor(n('playerId')),
          `Entrenched territory #${n('territoryId') + 1} with ${n('troops')} troops (now ${n('turnsRemaining')} turns)`,
        );
        break;
      case 'game:toxined':
        push(
          colorFor(n('playerId')),
          p.permanent
            ? `Released toxin on territory #${n('territoryId') + 1} permanently`
            : `Released toxin on territory #${n('territoryId') + 1} for ${n('roundsRemaining')} rounds`,
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
          push(colorFor(id), 'Eliminated by radiation');
        break;
      }
      case 'game:attacked': {
        if (p.conquered) lastConquestAttackerId = n('attackerId');
        let text = `${p.conquered ? 'Conquered' : 'Attacked'} territory #${n('defendingTerritoryId') + 1} from #${n('attackingTerritoryId') + 1}`;
        if (p.attackingTroops !== undefined && p.defendingTroops !== undefined)
          text += `: ${n('attackingTroops')} vs ${n('defendingTroops')} troops`;
        if (p.attackLosses !== undefined) text += `, lost ${n('attackLosses')}`;
        if (p.defenceLosses !== undefined)
          text += ` and killed ${n('defenceLosses')}`;
        push(colorFor(n('attackerId')), text);
        break;
      }
      case 'game:cardSetPlayed':
        push(
          colorFor(n('playerId')),
          `Received ${n('troops') - n('territoryBonusCount') * 2} troops from a set`,
        );
        break;
      case 'game:turnStarted': {
        const round = n('roundNumber');
        if (lastLoggedRound === null || round > lastLoggedRound) {
          lastLoggedRound = round;
          push(NEUTRAL_LOG_COLOR, `Started round ${round + 1}`);
        }
        const color = colorFor(n('playerId'));
        const source = (key: string, label: string) => {
          if (n(key) > 0)
            push(color, `Received ${n(key)} troops from ${label}`);
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
        push(color, `Claimed territory #${n('territoryId') + 1}`);
        push(color, `Deployed 1 troops to territory #${n('territoryId') + 1}`);
        break;
      }
      case 'game:allianceFormed': {
        const actor = p.playerId as number | undefined;
        push(
          colorFor(actor ?? n('withId')),
          actor === undefined
            ? `Formed an alliance with ${nameFor(n('withId'))}`
            : `${nameFor(actor)} formed an alliance with ${nameFor(n('withId'))}`,
        );
        break;
      }
      case 'game:allianceTerminated': {
        const actor = p.playerId as number | undefined;
        push(
          colorFor(actor ?? n('withId')),
          actor === undefined
            ? `Terminated the alliance with ${nameFor(n('withId'))}`
            : `${nameFor(actor)} terminated the alliance with ${nameFor(n('withId'))}`,
        );
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
