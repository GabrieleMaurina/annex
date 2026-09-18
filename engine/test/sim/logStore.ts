import * as fs from 'fs';
import * as path from 'path';
import { SummaryData } from './report';
import { SimGameResult } from './runGame';

export function writeGameLog(logDir: string, result: SimGameResult): void {
  const fileName = `game-${String(result.seed).padStart(7, '0')}.json`;
  fs.writeFileSync(
    path.join(logDir, fileName),
    JSON.stringify(result, null, 2),
  );
}

export function writeSummary(logDir: string, summary: SummaryData): void {
  fs.writeFileSync(
    path.join(logDir, 'summary.json'),
    JSON.stringify(summary, null, 2),
  );
}
