import { execSync } from 'child_process';

const port = 3000;

function run(command: string): string {
  try {
    return execSync(command, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

if (process.platform === 'win32') {
  const output = run(`netstat -ano -p tcp | findstr :${port}`);
  const pids = new Set(
    output
      .split('\n')
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts[3] === 'LISTENING')
      .map((parts) => parts[4])
      .filter((pid) => pid && pid !== '0'),
  );
  for (const pid of pids) {
    run(`taskkill /F /PID ${pid}`);
  }
} else {
  const output = run(`lsof -ti tcp:${port}`);
  const pids = output.split('\n').filter(Boolean);
  for (const pid of pids) {
    run(`kill -9 ${pid}`);
  }
}
