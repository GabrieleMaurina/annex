import { DiceLuck, DiceRules, NO_LUCK } from './dice';
import { lossDistribution, outcomeLuck } from './lossDistribution';

export function roll(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function attack(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): {
  attackDice: number[];
  defenceDice: number[];
  attackLosses: number;
  defenceLosses: number;
  luck: DiceLuck;
} {
  const attackDice = Array.from({ length: attackingTroops }, () =>
    roll(dice.attackSides),
  ).sort((a, b) => b - a);
  const defenceDice = Array.from({ length: defendingTroops }, () =>
    roll(dice.defenceSides),
  ).sort((a, b) => b - a);

  let attackLosses = 0;
  let defenceLosses = 0;
  const pairs = Math.min(attackDice.length, defenceDice.length);
  for (let i = 0; i < pairs; i++) {
    if (attackDice[i] > defenceDice[i]) defenceLosses++;
    else if (attackDice[i] < defenceDice[i]) attackLosses++;
    else if (dice.ties === 'defence') attackLosses++;
    else if (dice.ties === 'attack') defenceLosses++;
  }

  const luck =
    attackLosses + defenceLosses > 0
      ? outcomeLuck(
          lossDistribution(attackDice.length, defenceDice.length, dice),
          attackLosses,
          defenceLosses,
        )
      : NO_LUCK;

  return { attackDice, defenceDice, attackLosses, defenceLosses, luck };
}
