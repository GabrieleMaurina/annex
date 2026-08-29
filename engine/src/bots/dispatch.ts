import { nextPhase } from '../lifecycle/misc';
import {
  attack,
  attackMove,
  attackSelectEnd,
  attackSelectStart,
} from '../territory/attack';
import { selectCapital } from '../territory/capital';
import { playCardSet } from '../territory/cards';
import { deploy } from '../territory/deploy';
import { entrench } from '../territory/entrench';
import {
  fortify,
  fortifySelectEnd,
  fortifySelectStart,
} from '../territory/fortify';
import { claimTerritory } from '../territory/territory';
import { placeTroop } from '../territory/troop';

type Payload = Record<string, unknown>;

export interface DispatchResult {
  ok: boolean;
  error?: string;
}

export function dispatchBotAction(
  playerId: number,
  event: string,
  payload: unknown,
): DispatchResult {
  const p = (payload ?? {}) as Payload;
  switch (event) {
    case 'game:claimTerritory':
      return claimTerritory(playerId, p.territoryId as number);
    case 'game:placeTroop':
      return placeTroop(playerId, p.territoryId as number, p.troops as number);
    case 'game:selectCapital':
      return selectCapital(playerId, p.territoryId as number);
    case 'game:playCardSet':
      return playCardSet(playerId, p.cards as (number | null)[]);
    case 'game:nextPhase':
      return nextPhase(playerId);
    case 'game:deploy':
      return deploy(playerId, p.territoryId as number, p.troops as number);
    case 'game:attackMove':
      return attackMove(playerId, p.troops as number);
    case 'game:attackSelectStart':
      return attackSelectStart(playerId, p.territoryId as number);
    case 'game:attackSelectEnd':
      return attackSelectEnd(playerId, p.territoryId as number);
    case 'game:attack':
      return attack(
        playerId,
        p.type as 'regular' | 'blitz',
        p.troops as number,
      );
    case 'game:fortifySelectStart':
      return fortifySelectStart(playerId, p.territoryId as number);
    case 'game:fortifySelectEnd':
      return fortifySelectEnd(playerId, p.territoryId as number);
    case 'game:fortify':
      return fortify(playerId, p.troops as number);
    case 'game:entrench':
      return entrench(playerId, p.territoryId as number, p.troops as number);
    default:
      return { ok: false, error: 'unknown bot action' };
  }
}
