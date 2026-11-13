import { DiceTies, Game } from '../../types';

export const MAX_DICE = 10;
export const MIN_SIDES = 2;
export const MAX_SIDES = 20;
export const DEFAULT_SIDES = 6;

export interface DiceLuck {
  surplus: number;
  variance: number;
}

export const NO_LUCK: DiceLuck = { surplus: 0, variance: 0 };

export interface DiceRules {
  attack: number;
  defence: number;
  attackSides: number;
  defenceSides: number;
  ties: DiceTies;
}

export const TIES_INDEX: Record<DiceTies, number> = {
  defence: 0,
  attack: 1,
  tie: 2,
};

export function diceRulesKey(dice: DiceRules): number {
  return (
    (((dice.attack * (MAX_DICE + 1) + dice.defence) * (MAX_SIDES + 1) +
      dice.attackSides) *
      (MAX_SIDES + 1) +
      dice.defenceSides) *
      3 +
    TIES_INDEX[dice.ties]
  );
}

export function defenceDiceFor(game: Game, territoryId: number): number {
  if (
    game.capitalTerritoryIds.has(territoryId) ||
    (game.territoryEntrenchment.get(territoryId) ?? 0) > 0
  )
    return Math.min(MAX_DICE, game.defenceDice + 1);
  return game.defenceDice;
}

export function attackDiceFor(game: Game, territoryId: number): number {
  if ((game.territoryEntrenchment.get(territoryId) ?? 0) > 0)
    return Math.min(MAX_DICE, game.attackDice + 1);
  return game.attackDice;
}

export function gameDiceRules(
  game: Game,
  defence: number,
  attack: number = game.attackDice,
): DiceRules {
  return {
    attack,
    defence,
    attackSides: game.attackSides,
    defenceSides: game.defenceSides,
    ties: game.diceTies,
  };
}
