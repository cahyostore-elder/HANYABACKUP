import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');

test('Phase 28 adds a repeatable release audit command', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['audit:release'], /phase10-release-audit/);
  assert.match(pkg.scripts['audit:release'], /release-preflight/);
});

test('Phase 28 CI runs build checks and all regression tests', () => {
  const workflow = read('.github/workflows/quality.yml');
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /node --test scripts\/\*\.test\.mjs/);
  assert.match(workflow, /npm run audit:release/);
});

test('Phase 28 documentation does not falsely claim production readiness', () => {
  const docs = read('PHASE28_RELEASE_READINESS.md');
  assert.match(docs, /not verified in this environment/i);
  assert.match(docs, /Preview/i);
  assert.match(docs, /service_role/i);
});
