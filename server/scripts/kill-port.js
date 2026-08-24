const { execSync } = require('child_process');

const port = 3000;

function run(command) {
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
      .map((line) => line.trim().split(/\s+/).pop())
      .filter(Boolean),
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
