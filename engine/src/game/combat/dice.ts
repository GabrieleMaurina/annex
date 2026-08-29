export function roll(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function attack(
  attackingTroops: number,
  defendingTroops: number,
): {
  attackDice: number[];
  defenceDice: number[];
  attackLosses: number;
  defenceLosses: number;
} {
  const attackDice = Array.from({ length: attackingTroops }, roll).sort(
    (a, b) => b - a,
  );
  const defenceDice = Array.from({ length: defendingTroops }, roll).sort(
    (a, b) => b - a,
  );

  let attackLosses = 0;
  let defenceLosses = 0;
  const pairs = Math.min(attackDice.length, defenceDice.length);
  for (let i = 0; i < pairs; i++) {
    if (attackDice[i] > defenceDice[i]) defenceLosses++;
    else attackLosses++;
  }

  return { attackDice, defenceDice, attackLosses, defenceLosses };
}

function allDiceRolls(diceCount: number): number[][] {
  let rolls: number[][] = [[]];
  for (let i = 0; i < diceCount; i++) {
    const next: number[][] = [];
    for (const roll of rolls) {
      for (let value = 1; value <= 6; value++) next.push([...roll, value]);
    }
    rolls = next;
  }
  return rolls.map((roll) => roll.sort((a, b) => b - a));
}

function lossDistribution(
  attackerDiceCount: number,
  defenderDiceCount: number,
): { attackLosses: number; defenceLosses: number; probability: number }[] {
  const attackerRolls = allDiceRolls(attackerDiceCount);
  const defenderRolls = allDiceRolls(defenderDiceCount);
  const pairs = Math.min(attackerDiceCount, defenderDiceCount);
  const counts = new Map<number, number>();

  for (const attackDice of attackerRolls) {
    for (const defenceDice of defenderRolls) {
      let attackLosses = 0;
      for (let i = 0; i < pairs; i++) {
        if (attackDice[i] <= defenceDice[i]) attackLosses++;
      }
      counts.set(attackLosses, (counts.get(attackLosses) ?? 0) + 1);
    }
  }

  const total = attackerRolls.length * defenderRolls.length;
  return Array.from(counts, ([attackLosses, count]) => ({
    attackLosses,
    defenceLosses: pairs - attackLosses,
    probability: count / total,
  }));
}

function winProbTable(
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): number[][] {
  const distributionCache = new Map<
    string,
    ReturnType<typeof lossDistribution>
  >();
  const getDistribution = (
    attackerDiceCount: number,
    defenderDiceCount: number,
  ) => {
    const key = `${attackerDiceCount},${defenderDiceCount}`;
    if (!distributionCache.has(key))
      distributionCache.set(
        key,
        lossDistribution(attackerDiceCount, defenderDiceCount),
      );
    return distributionCache.get(key)!;
  };

  const table: number[][] = Array.from({ length: attackingTroops + 1 }, () =>
    new Array(defendingTroops + 1).fill(0),
  );
  for (let a = 0; a <= attackingTroops; a++) table[a][0] = 1;

  for (let a = 1; a <= attackingTroops; a++) {
    for (let d = 1; d <= defendingTroops; d++) {
      const attackerDiceCount = Math.min(a, 3);
      const defenderDiceCount = Math.min(d, defendingDice);
      let probability = 0;
      for (const outcome of getDistribution(
        attackerDiceCount,
        defenderDiceCount,
      )) {
        probability +=
          outcome.probability *
          table[a - outcome.attackLosses][d - outcome.defenceLosses];
      }
      table[a][d] = probability;
    }
  }

  return table;
}

export function trueWinProb(
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): number {
  return winProbTable(attackingTroops, defendingTroops, defendingDice)[
    attackingTroops
  ][defendingTroops];
}

export function trueWinProbs(
  maxAttackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): number[] {
  return winProbTable(maxAttackingTroops, defendingTroops, defendingDice)
    .slice(1)
    .map((row) => row[defendingTroops]);
}

export function balancedWinProb(
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): number {
  return distortProbability(
    trueWinProb(attackingTroops, defendingTroops, defendingDice),
  );
}

export function balancedWinProbs(
  maxAttackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): number[] {
  return trueWinProbs(maxAttackingTroops, defendingTroops, defendingDice).map(
    distortProbability,
  );
}

const winGuaranteedProbability = 0.85;

export function battleStatistics(
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): {
  winProbability: number;
  attackerTroopsNeeded: number;
  attackerMean: number;
  attackerVariance: number;
  defenderMean: number;
  defenderVariance: number;
  attackerMeanAtInput: number;
  attackerVarianceAtInput: number;
} {
  const distributionCache = new Map<
    string,
    ReturnType<typeof lossDistribution>
  >();
  const getDistribution = (
    attackerDiceCount: number,
    defenderDiceCount: number,
  ) => {
    const key = `${attackerDiceCount},${defenderDiceCount}`;
    if (!distributionCache.has(key))
      distributionCache.set(
        key,
        lossDistribution(attackerDiceCount, defenderDiceCount),
      );
    return distributionCache.get(key)!;
  };

  const makeTable = () =>
    Array.from({ length: attackingTroops + 1 }, () =>
      new Array(defendingTroops + 1).fill(0),
    );
  const winProbabilityTable = makeTable();
  const attackerWinSum = makeTable();
  const attackerWinSumSquares = makeTable();
  const defenderWinSum = makeTable();
  const defenderWinSumSquares = makeTable();

  for (let a = 0; a <= attackingTroops; a++) {
    winProbabilityTable[a][0] = 1;
    attackerWinSum[a][0] = a;
    attackerWinSumSquares[a][0] = a * a;
  }
  for (let d = 0; d <= defendingTroops; d++) {
    defenderWinSum[0][d] = d;
    defenderWinSumSquares[0][d] = d * d;
  }

  for (let a = 1; a <= attackingTroops; a++) {
    for (let d = 1; d <= defendingTroops; d++) {
      const attackerDiceCount = Math.min(a, 3);
      const defenderDiceCount = Math.min(d, defendingDice);
      let winProbability = 0;
      let attackerSum = 0;
      let attackerSumSquares = 0;
      let defenderSum = 0;
      let defenderSumSquares = 0;
      for (const outcome of getDistribution(
        attackerDiceCount,
        defenderDiceCount,
      )) {
        const na = a - outcome.attackLosses;
        const nd = d - outcome.defenceLosses;
        winProbability += outcome.probability * winProbabilityTable[na][nd];
        attackerSum += outcome.probability * attackerWinSum[na][nd];
        attackerSumSquares +=
          outcome.probability * attackerWinSumSquares[na][nd];
        defenderSum += outcome.probability * defenderWinSum[na][nd];
        defenderSumSquares +=
          outcome.probability * defenderWinSumSquares[na][nd];
      }
      winProbabilityTable[a][d] = winProbability;
      attackerWinSum[a][d] = attackerSum;
      attackerWinSumSquares[a][d] = attackerSumSquares;
      defenderWinSum[a][d] = defenderSum;
      defenderWinSumSquares[a][d] = defenderSumSquares;
    }
  }

  const winProbability = winProbabilityTable[attackingTroops][defendingTroops];

  let attackerTroopsNeeded = attackingTroops;
  for (let a = 1; a <= attackingTroops; a++) {
    if (winProbabilityTable[a][defendingTroops] >= winGuaranteedProbability) {
      attackerTroopsNeeded = a;
      break;
    }
  }

  const attackerWinProbability =
    winProbabilityTable[attackerTroopsNeeded][defendingTroops];
  const attackerMean =
    attackerWinSum[attackerTroopsNeeded][defendingTroops] /
    attackerWinProbability;
  const attackerVariance =
    attackerWinSumSquares[attackerTroopsNeeded][defendingTroops] /
      attackerWinProbability -
    attackerMean * attackerMean;
  const defenderMean =
    defenderWinSum[attackingTroops][defendingTroops] / (1 - winProbability);
  const defenderVariance =
    defenderWinSumSquares[attackingTroops][defendingTroops] /
      (1 - winProbability) -
    defenderMean * defenderMean;

  const attackerMeanAtInput =
    attackerWinSum[attackingTroops][defendingTroops] / winProbability;
  const attackerVarianceAtInput =
    attackerWinSumSquares[attackingTroops][defendingTroops] / winProbability -
    attackerMeanAtInput * attackerMeanAtInput;

  return {
    winProbability,
    attackerTroopsNeeded,
    attackerMean,
    attackerVariance,
    defenderMean,
    defenderVariance,
    attackerMeanAtInput,
    attackerVarianceAtInput,
  };
}

function distortProbability(probability: number): number {
  const lowSaturation = 0.1;
  const lowMid = 0.25;
  const highMid = 0.75;
  const highSaturation = winGuaranteedProbability;

  if (probability <= lowSaturation) return 0;
  if (probability >= highSaturation) return 1;
  if (probability < lowMid) {
    const t = (lowMid - probability) / (lowMid - lowSaturation);
    return lowMid - lowMid * Math.sqrt(t);
  }
  if (probability > highMid) {
    const t = (probability - highMid) / (highSaturation - highMid);
    return highMid + (1 - highMid) * Math.sqrt(t);
  }
  return probability;
}

function sampleRemainingTroops(
  mean: number,
  variance: number,
  maxTroops: number,
): number {
  const standardDeviation = Math.sqrt(Math.max(variance, 0));
  const u1 = 1 - Math.random();
  const u2 = Math.random();
  const standardNormal =
    Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const sample = Math.round(mean + standardNormal * standardDeviation);
  return Math.min(Math.max(sample, 1), maxTroops);
}

export function balancedBlitz(
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): { attackLosses: number; defenceLosses: number } {
  const stats = battleStatistics(
    attackingTroops,
    defendingTroops,
    defendingDice,
  );
  const balancedProbability = distortProbability(stats.winProbability);

  if (Math.random() < balancedProbability) {
    const remaining = sampleRemainingTroops(
      stats.attackerMean,
      stats.attackerVariance,
      stats.attackerTroopsNeeded,
    );
    return {
      attackLosses: stats.attackerTroopsNeeded - remaining,
      defenceLosses: defendingTroops,
    };
  }

  const remaining = sampleRemainingTroops(
    stats.defenderMean,
    stats.defenderVariance,
    defendingTroops,
  );
  return {
    attackLosses: attackingTroops,
    defenceLosses: defendingTroops - remaining,
  };
}

export function trueBlitz(
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): { attackLosses: number; defenceLosses: number } {
  let remainingAttackers = attackingTroops;
  let remainingDefenders = defendingTroops;

  while (remainingAttackers > 0 && remainingDefenders > 0) {
    const result = attack(
      Math.min(remainingAttackers, 3),
      Math.min(remainingDefenders, defendingDice),
    );
    remainingAttackers -= result.attackLosses;
    remainingDefenders -= result.defenceLosses;
  }

  return {
    attackLosses: attackingTroops - remainingAttackers,
    defenceLosses: defendingTroops - remainingDefenders,
  };
}
