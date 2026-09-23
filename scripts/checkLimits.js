const fs = require('fs');
const path = require('path');

const MAX_FILES_PER_FOLDER = 10;
const MAX_LINES_PER_FILE = 1000;
const SOURCE_FILE = /\.[jt]sx?$/;

const violations = [];

function checkFolder(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const sourceFiles = entries.filter(
    (e) => e.isFile() && SOURCE_FILE.test(e.name),
  );
  if (sourceFiles.length > MAX_FILES_PER_FOLDER)
    violations.push(
      `${dir}: ${sourceFiles.length} source files (max ${MAX_FILES_PER_FOLDER})`,
    );
  for (const file of sourceFiles) {
    const filePath = path.join(dir, file.name);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
    if (lines > MAX_LINES_PER_FILE)
      violations.push(
        `${filePath}: ${lines} lines (max ${MAX_LINES_PER_FILE})`,
      );
  }
  for (const entry of entries) {
    if (entry.isDirectory()) checkFolder(path.join(dir, entry.name));
  }
}

process.argv.slice(2).forEach(checkFolder);

if (violations.length > 0) {
  violations.forEach((v) => console.error(v));
  process.exit(1);
}
