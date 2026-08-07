import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { startServer, stopServer } from './helpers/server.mjs';

const TESTS_DIR = fileURLToPath(new URL('.', import.meta.url));
const PORT = 4173;

async function waitForServer(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server didn't respond at ${url} within ${timeoutMs}ms`);
}

function runTestFile(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(TESTS_DIR, file)], { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function main() {
  const entries = await readdir(TESTS_DIR);
  const testFiles = entries.filter((f) => f.endsWith('.test.mjs')).sort();

  if (testFiles.length === 0) {
    console.error('No *.test.mjs files found in tests/');
    process.exit(1);
  }

  console.log(`Starting static server on port ${PORT}...`);
  const server = await startServer(PORT);
  await waitForServer(`http://127.0.0.1:${PORT}/index.html`);
  console.log('Server ready.\n');

  const results = [];
  for (const file of testFiles) {
    console.log(`\n=== ${file} ===`);
    const passed = await runTestFile(file);
    results.push({ file, passed });
  }

  await stopServer(server);

  console.log('\n\n=== Summary ===');
  let allPassed = true;
  for (const { file, passed } of results) {
    console.log(`  ${passed ? '✅' : '❌'} ${file}`);
    if (!passed) allPassed = false;
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
