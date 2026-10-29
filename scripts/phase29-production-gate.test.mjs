import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

test('release gate documents the real production blockers', () => {
  const docs = read('PHASE29_PRODUCTION_GATE.md');
  for (const phrase of ['Deploy a Preview', 'live Supabase', 'payment gateway', 'manual fulfillment', 'rollback']) {
    assert.ok(docs.toLowerCase().includes(phrase.toLowerCase()), `missing release gate item: ${phrase}`);
  }
});

test('production environment template contains placeholders, not credentials', () => {
  const env = read('.env.example');
  assert.match(env, /YOUR_PROJECT_REF/);
  assert.match(env, /PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE/);
  assert.doesNotMatch(env, /service_role|sb_secret_[A-Za-z0-9]+/i);
});

test('all Supabase migrations are present and have unique filenames', () => {
  const dir = path.join(root, 'supabase/migrations');
  assert.ok(existsSync(dir), 'migration directory missing');
  const files = readdirSync(dir).filter((name) => name.endsWith('.sql'));
  assert.ok(files.length >= 5, `expected schema migrations, found ${files.length}`);
  assert.equal(new Set(files).size, files.length, 'duplicate migration filenames found');
  for (const file of files) assert.ok(/^\d{8,14}_.+\.sql$/.test(file), `unexpected migration filename: ${file}`);
});

test('release commands and CI stay aligned', () => {
  const pkg = JSON.parse(read('package.json'));
  const ci = read('.github/workflows/quality.yml');
  assert.match(pkg.scripts['audit:release'], /release-preflight/);
  assert.match(ci, /npm ci/);
  assert.match(ci, /npm run check/);
  assert.match(ci, /node --test scripts\/\*\.test\.mjs/);
  assert.match(ci, /npm run audit:release/);
});

test('frontend configuration does not embed server-side Supabase secrets', () => {
  const files = ['src/lib/supabase.ts', '.env.example', 'vercel.json'];
  for (const file of files) {
    assert.doesNotMatch(read(file), /service_role|sb_secret_[A-Za-z0-9]+/i, `server-side secret marker in ${file}`);
  }
});

test('customer order status lookup remains scoped and avoids exposing account identifiers', () => {
  const sql = readdirSync(path.join(root, 'supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .map((name) => read(`supabase/migrations/${name}`)).join('\n');
  assert.match(sql, /lookup_order\s*\(/i);
  assert.match(sql, /search_path\s*=\s*pg_catalog,\s*public/i);
  assert.match(sql, /REVOKE\s+ALL\s+ON\s+FUNCTION/i);
});

test('local environment is optional, while generated and dependency directories remain ignored', () => {
  const localEnvExists = existsSync(path.join(root, '.env.local'));
  if (localEnvExists) {
    const localEnv = read('.env.local');
    assert.match(localEnv, /^VITE_SUPABASE_URL=https:\/\//m);
    assert.match(localEnv, /^VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_/m);
    assert.doesNotMatch(localEnv, /service_role|sb_secret_[A-Za-z0-9]+/i);
  }
  assert.equal(existsSync(path.join(root, '.env')), false);
  const gitignore = read('.gitignore');
  assert.match(gitignore, /^node_modules$/m);
  assert.match(gitignore, /^dist$/m);
});
