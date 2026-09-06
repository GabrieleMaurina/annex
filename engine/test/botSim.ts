import { BotDifficulty } from '../src/types';
import {
  DIFFICULTIES,
  runMixedBatch,
  runSoloMatchup,
  setupSim,
} from './simCore';

function main(): void {
  setupSim();
  const gamesToRun = Number(process.argv[2] ?? 40);
  const roundCap = Number(process.argv[3] ?? 60);

  const batch = runMixedBatch(gamesToRun, roundCap);

  console.log('== bot sim ==');
  console.log(
    `games ${batch.games} | finished ${batch.finished} | dispatch failures ${batch.dispatchFailures}`,
  );
  console.log(`avg rounds ${batch.avgRounds.toFixed(1)}`);
  console.log(`wins by difficulty ${JSON.stringify(batch.wins)}`);
  for (const d of DIFFICULTIES)
    console.log(
      `  ${d}: conquests/turn avg ${batch.conquestsByDifficulty[d].toFixed(2)}`,
    );
  console.log(
    `plan ms p50 ${batch.planMsP50.toFixed(1)} p95 ${batch.planMsP95.toFixed(1)} max ${batch.planMsMax.toFixed(1)}`,
  );
  console.log(`objective mixes ${JSON.stringify(batch.objectiveMix)}`);

  console.log('== final territory share by difficulty (mixed games) ==');
  for (const d of DIFFICULTIES)
    console.log(
      `  ${d}: avg share ${(100 * batch.shareByDifficulty[d]).toFixed(1)}% | avg rank ${batch.rankByDifficulty[d].toFixed(2)}`,
    );

  console.log('== lone test bot vs field of 5 (fair share 16.7%) ==');
  const soloGames = Math.max(9, Math.round(gamesToRun / 2));
  for (const [test, field] of [
    ['hard', 'easy'],
    ['hard', 'medium'],
    ['medium', 'easy'],
  ] as [BotDifficulty, BotDifficulty][]) {
    const m = runSoloMatchup(test, field, soloGames, roundCap);
    console.log(
      `  ${test} among ${field}s: win ${m.winPct.toFixed(0)}% (${m.decided} decided) | avg share ${m.avgShare.toFixed(1)}%`,
    );
  }
}

main();
