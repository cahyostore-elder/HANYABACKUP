import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('Phase 30 production check is registered and runbook describes its limits', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['audit:phase30'], /phase30-production-check\.mjs/);
  assert.match(pkg.scripts['audit:release'], /audit:phase30/);
  const doc = read('PHASE30_PRODUCTION_HARDENING.md');
  assert.match(doc, /cannot prove that credentials are correct/i);
  assert.match(doc, /roll back/i);
  assert.match(doc, /manual payment/i);
});

test('Phase 30 source guard scans frontend files without scanning its own test fixtures', () => {
  const script = read('scripts/phase30-production-check.mjs');
  assert.match(script, /walk\('src'\)/);
  assert.match(script, /service_role/);
  assert.match(script, /PRIVATE KEY/);
});

test('deployment runbook includes Preview, environment, database and payment gates', () => {
  const doc = read('PHASE30_PRODUCTION_HARDENING.md').toLowerCase();
  for (const term of ['vercel preview', 'migrations', 'publishable/anon key', 'payment receipt', 'roll back']) {
    assert.ok(doc.includes(term), `missing runbook topic: ${term}`);
  }
});
